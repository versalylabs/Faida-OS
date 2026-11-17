import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { zonedDateKey, zonedNow, zonedTime } from "@/lib/tz";
import { createEntry, defaultAccountId, deleteEntry, LedgerError, TRANSFER } from "@/lib/ledger";
import { ValidationError, badRequest, date, must, notFound, num, oneOf, ownedId, readBody, str } from "@/lib/validate";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const noCacheHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

/** Words that clearly mark spending as business spending. Money tagged to a business always counts as business. */
const BUSINESS_WORDS = ["business", "versaly", "straten", "client", "agency", "contractor", "marketing", "ads"];
const isBusinessCategory = (cat: string) => {
  const lower = cat.toLowerCase();
  return BUSINESS_WORDS.some((k) => lower.includes(k));
};

const PERIODS = ["month", "last", "30d", "year"] as const;

/** The date range a period covers, in the user's own time zone. */
function periodRange(period: (typeof PERIODS)[number], now = new Date()) {
  const z = zonedNow(now);
  const pad = (n: number) => String(n).padStart(2, "0");
  const key = (y: number, m: number) => {
    const d = new Date(Date.UTC(y, m - 1, 1));
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-01`;
  };
  if (period === "last") return { from: zonedTime(key(z.year, z.month - 1), "00:00"), to: z.startOfMonth, label: "Last month" };
  if (period === "30d") return { from: new Date(now.getTime() - 30 * 86400000), to: new Date(now.getTime() + 86400000), label: "Last 30 days" };
  if (period === "year") return { from: zonedTime(`${z.year}-01-01`, "00:00"), to: new Date(now.getTime() + 86400000), label: `${z.year}` };
  return { from: z.startOfMonth, to: new Date(now.getTime() + 86400000 * 31), label: "This month" };
}

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401, headers: noCacheHeaders });
    }

    const sp = new URL(req.url).searchParams;
    const period = (PERIODS as readonly string[]).includes(sp.get("period") || "") ? (sp.get("period") as (typeof PERIODS)[number]) : "month";
    const kind = sp.get("kind") || "all"; // all | income | expense | transfer
    const q = (sp.get("q") || "").trim().slice(0, 80);
    const limit = Math.min(500, Math.max(20, Math.trunc(Number(sp.get("limit"))) || 100));
    const accountFilter = sp.get("accountId") ? await ownedId("financeAccount", user.id, sp.get("accountId")) : null;
    if (sp.get("accountId") && !accountFilter) return notFound("Account not found", noCacheHeaders);

    const monthStart = zonedNow().startOfMonth;
    const range = periodRange(period);

    const listWhere: Record<string, unknown> = { userId: user.id };
    if (accountFilter) listWhere.accountId = accountFilter;
    if (kind === "income") Object.assign(listWhere, { amount: { gt: 0 }, type: { not: TRANSFER } });
    else if (kind === "expense") Object.assign(listWhere, { amount: { lt: 0 }, type: { not: TRANSFER } });
    else if (kind === "transfer") listWhere.type = TRANSFER;
    if (q) listWhere.OR = [{ description: { contains: q, mode: "insensitive" } }, { category: { contains: q, mode: "insensitive" } }];

    const [accountsRaw, budgets, categoriesRaw, monthTx, accountMonth, periodTx, listed] = await Promise.all([
      prisma.financeAccount.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } }),
      prisma.budget.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
      prisma.financeCategory.findMany({ where: { userId: user.id }, orderBy: { name: "asc" } }),
      // Budgets are monthly: spending is measured over the whole calendar month (in the user's time zone), not
      // just the rows shown in the list. Transfers move money between accounts and are never income or spending.
      prisma.financeTransaction.findMany({
        where: { userId: user.id, date: { gte: monthStart }, type: { not: TRANSFER } },
        select: { amount: true, category: true, businessId: true },
      }),
      prisma.financeTransaction.findMany({
        where: { userId: user.id, date: { gte: monthStart }, accountId: { not: null } },
        select: { amount: true, accountId: true, type: true },
      }),
      period === "month"
        ? Promise.resolve(null)
        : prisma.financeTransaction.findMany({
            where: { userId: user.id, date: { gte: range.from, lt: range.to }, type: { not: TRANSFER } },
            select: { amount: true, category: true },
          }),
      prisma.financeTransaction.findMany({
        where: listWhere,
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        take: limit + 1,
        include: { account: { select: { name: true, color: true } }, business: { select: { name: true } } },
      }),
    ]);

    // ---- this month's income and spending ----
    let totalIncome = 0;
    let totalExpense = 0;
    let personalExpense = 0;
    let businessExpense = 0;
    const expenseByCategory: Record<string, number> = {};
    const incomeByCategory: Record<string, number> = {};
    for (const tx of monthTx) {
      const cat = tx.category || "General";
      if (tx.amount > 0) {
        totalIncome += tx.amount;
        incomeByCategory[cat] = (incomeByCategory[cat] || 0) + tx.amount;
      } else {
        const abs = Math.abs(tx.amount);
        totalExpense += abs;
        if (tx.businessId || isBusinessCategory(cat)) businessExpense += abs;
        else personalExpense += abs;
        expenseByCategory[cat] = (expenseByCategory[cat] || 0) + abs;
      }
    }

    // ---- the breakdown the chart shows (the chosen period; this month reuses the numbers above) ----
    let breakdownIncome = incomeByCategory;
    let breakdownExpense = expenseByCategory;
    if (periodTx) {
      breakdownIncome = {};
      breakdownExpense = {};
      for (const tx of periodTx) {
        const cat = tx.category || "General";
        if (tx.amount > 0) breakdownIncome[cat] = (breakdownIncome[cat] || 0) + tx.amount;
        else breakdownExpense[cat] = (breakdownExpense[cat] || 0) + Math.abs(tx.amount);
      }
    }

    // ---- accounts (with default fallback auto-seed) ----
    let accounts = accountsRaw;
    if (accounts.length === 0) {
      await prisma.financeAccount.createMany({
        data: [
          { userId: user.id, name: "Card", type: "CARD", balance: 0, color: "#3b82f6" },
          { userId: user.id, name: "Cash", type: "CASH", balance: 0, color: "#10b981", isDefault: true },
          { userId: user.id, name: "Savings", type: "SAVINGS", balance: 0, color: "#8b5cf6" },
        ],
      });
      accounts = await prisma.financeAccount.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } });
    }

    // What moved in and out of each account this month (transfers included: they are real movements of that account)
    const perAccount = new Map<string, { in: number; out: number }>();
    for (const r of accountMonth) {
      if (!r.accountId) continue;
      const m = perAccount.get(r.accountId) ?? { in: 0, out: 0 };
      if (r.amount >= 0) m.in += r.amount;
      else m.out += Math.abs(r.amount);
      perAccount.set(r.accountId, m);
    }
    const accountsOut = accounts.map((a) => {
      const m = perAccount.get(a.id) ?? { in: 0, out: 0 };
      return { ...a, monthIn: Math.round(m.in), monthOut: Math.round(m.out) };
    });

    // ---- budgets ----
    const rec = (c: string) => budgets.find((b) => b.category === c);
    const overall = rec("Overall");
    const personalBudget = rec("Personal") ? rec("Personal")!.monthlyLimit : overall ? Math.round(overall.monthlyLimit * 0.6) : 0;
    const businessBudget = rec("Business") ? rec("Business")!.monthlyLimit : overall ? Math.round(overall.monthlyLimit * 0.4) : 0;
    const savingsTarget = rec("Savings") ? rec("Savings")!.monthlyLimit : 0;
    const monthlyBudget = overall ? overall.monthlyLimit : personalBudget + businessBudget;
    // Not capped at 100: overspending has to show as overspending
    const pct = (spent: number, limit: number) => (limit > 0 ? Math.round((spent / limit) * 100) : 0);

    // ---- savings: the balance you hold, and what you added to it this month ----
    const isSavings = (a: { type: string; name: string }) => a.type === "SAVINGS" || a.name.toLowerCase().includes("saving");
    const savingsIds = new Set(accounts.filter(isSavings).map((a) => a.id));
    const savingsBalance = accounts.filter(isSavings).reduce((s, a) => s + a.balance, 0);
    const savedThisMonth = accountMonth.filter((r) => r.accountId && savingsIds.has(r.accountId)).reduce((s, r) => s + r.amount, 0);

    // ---- categories (with default fallback auto-seed) ----
    let categories = categoriesRaw;
    if (categories.length === 0) {
      const defaultExpenses = [
        { name: "Groceries", color: "#f59e0b" },
        { name: "Food & Dining", color: "#06b6d4" },
        { name: "Rent & Utilities", color: "#8b5cf6" },
        { name: "Transport", color: "#14b8a6" },
        { name: "Tech & Subscriptions", color: "#3b82f6" },
        { name: "Health", color: "#10b981" },
        { name: "Shopping", color: "#ec4899" },
        { name: "Entertainment", color: "#f43f5e" },
      ];
      const defaultIncome = ["Salary", "Freelance", "Investments", "Business", "Gifts"];
      await prisma.financeCategory.createMany({
        data: [
          ...defaultExpenses.map((d) => ({ userId: user.id, name: d.name, type: "EXPENSE", color: d.color })),
          ...defaultIncome.map((name) => ({ userId: user.id, name, type: "INCOME", color: "#10b981" })),
        ],
      });
      categories = await prisma.financeCategory.findMany({ where: { userId: user.id }, orderBy: { name: "asc" } });
    }

    const hasMore = listed.length > limit;
    const transactions = listed.slice(0, limit);
    const round = (o: Record<string, number>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Math.round(v * 100) / 100]));

    return NextResponse.json(
      {
        success: true,
        transactions,
        hasMore,
        accounts: accountsOut,
        categories,
        metrics: {
          monthlyBudget,
          remainingBudget: monthlyBudget - totalExpense,
          budgetPercentUsed: pct(totalExpense, monthlyBudget),
          personalBudget,
          personalExpense,
          personalRemaining: personalBudget - personalExpense,
          personalPercentUsed: pct(personalExpense, personalBudget),
          businessBudget,
          businessExpense,
          businessRemaining: businessBudget - businessExpense,
          businessPercentUsed: pct(businessExpense, businessBudget),
          savingsTarget,
          savingsBalance,
          savedThisMonth,
          savingsPercent: savingsTarget > 0 ? Math.max(0, pct(savedThisMonth, savingsTarget)) : 0,
          totalLiquidBalance: accounts.reduce((s, a) => s + a.balance, 0),
          netCashFlow: totalIncome - totalExpense,
          totalIncome,
          totalExpense,
          categoryBreakdown: round(expenseByCategory),
          expenseCategoryBreakdown: round(expenseByCategory),
          incomeCategoryBreakdown: round(incomeByCategory),
          // The chart: whichever period was asked for
          breakdown: { period, label: range.label, expense: round(breakdownExpense), income: round(breakdownIncome) },
        },
        asOf: zonedDateKey(new Date()),
      },
      { headers: noCacheHeaders }
    );
  } catch (error: any) {
    if (error instanceof ValidationError) return badRequest(error.message);
    console.error("Error fetching finance data:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch finance" }, { status: 500, headers: noCacheHeaders });
  }
}

/** Log income or an expense. The chosen account's balance moves with it. */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await readBody(req);
    const { description, amount, type, category, isRecurring, accountId, date: dateIn } = body;

    const cleanDescription = must(str(description, { max: 300, required: true }), "Description is required (max 300 characters)");
    const cleanType = must(oneOf(type, ["INCOME", "EXPENSE"] as const, { required: true }), "Type must be INCOME or EXPENSE");
    const parsedAmount = must(num(amount, { min: -1e12, max: 1e12, required: true }), "Amount must be a valid number");
    if (parsedAmount === 0) throw new ValidationError("The amount must be more than 0");
    const cleanCategory = must(str(category, { max: 80 }), "Category is too long") ?? "General";
    const when = must(date(dateIn), "Date is invalid") ?? new Date();

    // No account given at all (quick capture, older clients): use the default account if one is set.
    // An explicit null means "do not touch any balance".
    let account: string | null;
    if (accountId === undefined) account = await defaultAccountId(user.id);
    else {
      const owned = await ownedId("financeAccount", user.id, accountId);
      if (owned === undefined) return notFound("Account not found", noCacheHeaders);
      account = owned;
    }

    const signed = cleanType === "EXPENSE" ? -Math.abs(parsedAmount) : Math.abs(parsedAmount);
    const transaction = await createEntry({
      userId: user.id,
      description: cleanDescription,
      amount: signed,
      type: cleanType,
      category: cleanCategory,
      date: when,
      isRecurring: isRecurring === true,
      accountId: account,
    });

    await prisma.activityLog.create({
      data: { action: "FINANCE_LOGGED", details: `Logged ${cleanType}: ${cleanDescription} (${signed > 0 ? "+" : ""}${signed} KES)` },
    });

    return NextResponse.json({ success: true, transaction });
  } catch (error: any) {
    if (error instanceof ValidationError) return badRequest(error.message);
    if (error instanceof LedgerError) return badRequest(error.message);
    console.error("Error logging transaction:", error);
    return NextResponse.json({ success: false, error: "Failed to log transaction" }, { status: 500 });
  }
}

// PATCH /api/finance - Update user budgets (Personal, Business, Savings, Overall)
export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await readBody(req);
    const { monthlyBudget, personalBudget, businessBudget, savingsTarget, category, amount } = body;

    const upsertBudget = async (cat: string, limitVal: number) => {
      const cleanLimit = Math.max(0, limitVal);
      const existing = await prisma.budget.findFirst({ where: { userId: user.id, category: cat } });
      if (existing) {
        return prisma.budget.update({ where: { id: existing.id }, data: { monthlyLimit: cleanLimit } });
      }
      return prisma.budget.create({
        data: { userId: user.id, category: cat, monthlyLimit: cleanLimit, monthYear: new Date().toISOString().slice(0, 7) },
      });
    };

    let updated = false;
    if (personalBudget !== undefined && num(personalBudget, { min: 0, max: 1e12 }) != null) {
      await upsertBudget("Personal", Number(personalBudget));
      updated = true;
    }
    if (businessBudget !== undefined && num(businessBudget, { min: 0, max: 1e12 }) != null) {
      await upsertBudget("Business", Number(businessBudget));
      updated = true;
    }
    if (savingsTarget !== undefined && num(savingsTarget, { min: 0, max: 1e12 }) != null) {
      await upsertBudget("Savings", Number(savingsTarget));
      updated = true;
    }
    if (monthlyBudget !== undefined && num(monthlyBudget, { min: 0, max: 1e12 }) != null) {
      await upsertBudget("Overall", Number(monthlyBudget));
      updated = true;
    }
    if (typeof category === "string" && category.trim() && category.length <= 80 && amount !== undefined && num(amount, { min: 0, max: 1e12 }) != null) {
      await upsertBudget(category, Number(amount));
      updated = true;
    }

    if (!updated) {
      return NextResponse.json({ success: false, error: "No valid budget value provided" }, { status: 400 });
    }
    return NextResponse.json({ success: true }, { headers: noCacheHeaders });
  } catch (error: any) {
    if (error instanceof ValidationError) return badRequest(error.message);
    console.error("Error updating budget:", error);
    return NextResponse.json({ success: false, error: "Failed to update budget" }, { status: 500, headers: noCacheHeaders });
  }
}

/** Delete a transaction. Its effect on the account balance is taken back out (both halves of a transfer). */
export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const id = new URL(req.url).searchParams.get("id");
    if (!id) {
      return NextResponse.json({ success: false, error: "Transaction ID required" }, { status: 400 });
    }
    const removed = await deleteEntry(user.id, id);
    return NextResponse.json({ success: true, removed });
  } catch (error: any) {
    if (error instanceof LedgerError) return NextResponse.json({ success: false, error: error.message }, { status: 404 });
    console.error("Error deleting transaction:", error);
    return NextResponse.json({ success: false, error: "Failed to delete transaction" }, { status: 500 });
  }
}
