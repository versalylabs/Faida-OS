import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { computeMrr } from "@/lib/businessMath";
import { LedgerError, createEntry, defaultAccountId, deleteEntry, updateEntry } from "@/lib/ledger";
import { zonedDateKey, zonedNow, zonedTime } from "@/lib/tz";
import { ValidationError, badRequest, date, must, notFound, num, oneOf, ownedId, readBody, str } from "@/lib/validate";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const noCacheHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

// Months are the user's own calendar months (Nairobi time), not UTC ones
const monthKey = (d: Date) => zonedDateKey(d).slice(0, 7);
const keyOf = (year: number, month: number) => {
  const d = new Date(Date.UTC(year, month - 1, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

/**
 * Business money: everything paid in or out that belongs to one of the businesses, plus the cash accounts
 * and what is still to buy. Transactions live in the same table as personal finance, so the Finance page and
 * this one always agree.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401, headers: noCacheHeaders });
    }

    const { searchParams } = new URL(req.url);
    const businessFilter = searchParams.get("businessId");
    const businessId = businessFilter ? await ownedId("business", user.id, businessFilter) : null;
    if (businessFilter && !businessId) return notFound("Business not found", noCacheHeaders);

    const z = zonedNow();
    const monthStart = z.startOfMonth;
    const firstKey = keyOf(z.year, z.month - 5);
    const sixMonthsAgo = zonedTime(`${firstKey}-01`, "00:00");
    const where = { userId: user.id, businessId: businessId ?? { not: null } };

    const [businesses, history, recent, accounts, purchases] = await Promise.all([
      prisma.business.findMany({
        where: { userId: user.id },
        select: { id: true, name: true, slug: true, color: true, clients: { select: { id: true, name: true, status: true, contractType: true, contractValue: true, billingCycle: true } } },
        orderBy: { createdAt: "asc" },
      }),
      prisma.financeTransaction.findMany({
        where: { ...where, date: { gte: sixMonthsAgo } },
        select: { businessId: true, clientId: true, amount: true, category: true, date: true },
      }),
      prisma.financeTransaction.findMany({
        where,
        orderBy: { date: "desc" },
        take: 150,
        include: { business: { select: { name: true, slug: true, color: true } }, client: { select: { name: true } } },
      }),
      prisma.financeAccount.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } }),
      prisma.businessPurchase.findMany({
        where: { userId: user.id, ...(businessId ? { businessId } : {}) },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    // Last six months, in and out
    const months: { key: string; income: number; expense: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      months.push({ key: keyOf(z.year, z.month - i), income: 0, expense: 0 });
    }
    const thisMonthKey = keyOf(z.year, z.month);
    const perBusiness = new Map<string, { income: number; expense: number }>();
    const expenseByCategory: Record<string, number> = {};
    const incomeByClient: Record<string, number> = {};

    for (const t of history) {
      const slot = months.find((m) => m.key === monthKey(t.date));
      if (slot) {
        if (t.amount > 0) slot.income += t.amount;
        else slot.expense += Math.abs(t.amount);
      }
      if (monthKey(t.date) === thisMonthKey && t.businessId) {
        const b = perBusiness.get(t.businessId) ?? { income: 0, expense: 0 };
        if (t.amount > 0) {
          b.income += t.amount;
          if (t.clientId) incomeByClient[t.clientId] = (incomeByClient[t.clientId] || 0) + t.amount;
        } else {
          b.expense += Math.abs(t.amount);
          const cat = t.category || "Other expense";
          expenseByCategory[cat] = (expenseByCategory[cat] || 0) + Math.abs(t.amount);
        }
        perBusiness.set(t.businessId, b);
      }
    }

    const shown = businessId ? businesses.filter((b) => b.id === businessId) : businesses;
    const perBusinessRows = shown.map((b) => {
      const m = perBusiness.get(b.id) ?? { income: 0, expense: 0 };
      const expectedMonthly = computeMrr(b.clients);
      return {
        id: b.id,
        name: b.name,
        slug: b.slug,
        color: b.color,
        income: Math.round(m.income),
        expense: Math.round(m.expense),
        net: Math.round(m.income - m.expense),
        expectedMonthly,
        // what active retainers should bring in this month that has not been recorded as paid yet
        stillToCollect: Math.max(0, expectedMonthly - Math.round(m.income)),
      };
    });

    // Per-client: who has paid this month and who has not (active recurring clients only)
    const clientRows = shown.flatMap((b) =>
      b.clients
        .filter((c) => c.status === "ACTIVE")
        .map((c) => ({
          id: c.id,
          name: c.name,
          businessId: b.id,
          businessName: b.name,
          expected: computeMrr([c]),
          paidThisMonth: Math.round(incomeByClient[c.id] || 0),
        }))
        .filter((c) => c.expected > 0 || c.paidThisMonth > 0)
    );

    const openPurchases = purchases.filter((p) => p.status !== "BOUGHT");
    const totalIncome = perBusinessRows.reduce((a, b) => a + b.income, 0);
    const totalExpense = perBusinessRows.reduce((a, b) => a + b.expense, 0);

    return NextResponse.json(
      {
        success: true,
        month: { key: thisMonthKey, income: totalIncome, expense: totalExpense, net: totalIncome - totalExpense },
        perBusiness: perBusinessRows,
        clients: clientRows,
        months: months.map((m) => ({ key: m.key, income: Math.round(m.income), expense: Math.round(m.expense) })),
        expenseByCategory: Object.entries(expenseByCategory)
          .map(([category, amount]) => ({ category, amount: Math.round(amount) }))
          .sort((a, b) => b.amount - a.amount),
        transactions: recent,
        accounts: accounts.map((a) => ({ id: a.id, name: a.name, type: a.type, balance: a.balance, color: a.color, isDefault: a.isDefault })),
        totalBalance: accounts.reduce((a, x) => a + x.balance, 0),
        purchases,
        purchaseSummary: {
          openCount: openPurchases.length,
          openEstimate: Math.round(openPurchases.reduce((a, p) => a + (p.estimatedCost || 0), 0)),
        },
      },
      { headers: noCacheHeaders }
    );
  } catch (error: any) {
    if (error instanceof ValidationError) return badRequest(error.message);
    console.error("Error loading business finance:", error);
    return NextResponse.json({ success: false, error: "Failed to load business finance" }, { status: 500, headers: noCacheHeaders });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401, headers: noCacheHeaders });
    }

    const body = await readBody(req);
    const { businessId, clientId, type, amount, category, description, date: dateIn, accountId } = body;

    const ownedBusinessId = await ownedId("business", user.id, businessId);
    if (!ownedBusinessId) return notFound("Business not found", noCacheHeaders);
    const cleanType = must(oneOf(type, ["INCOME", "EXPENSE"] as const, { required: true }), "Type must be INCOME or EXPENSE");
    const parsed = must(num(amount, { min: 0, max: 1e12, required: true }), "Amount must be a number, 0 or more");
    const cleanDescription = must(str(description, { max: 300, required: true }), "Description is required (max 300 characters)");
    const cleanCategory = must(str(category, { max: 80 }), "Category is too long") ?? (cleanType === "INCOME" ? "Client payment" : "Other expense");
    const when = must(date(dateIn), "Date is invalid") ?? new Date();

    let ownedClientId: string | null = null;
    if (clientId) {
      const client = await prisma.businessClient.findFirst({ where: { id: String(clientId), userId: user.id, businessId: ownedBusinessId }, select: { id: true } });
      if (!client) return notFound("Client not found in this business", noCacheHeaders);
      ownedClientId = client.id;
    }

    // No account named: use the default account. An explicit null means "do not touch any balance".
    let account: string | null;
    if (accountId === undefined) account = await defaultAccountId(user.id);
    else {
      const owned = await ownedId("financeAccount", user.id, accountId);
      if (owned === undefined) return notFound("Account not found", noCacheHeaders);
      account = owned;
    }

    const transaction = await createEntry({
      userId: user.id,
      businessId: ownedBusinessId,
      clientId: ownedClientId,
      description: cleanDescription,
      amount: cleanType === "EXPENSE" ? -Math.abs(parsed) : Math.abs(parsed),
      type: cleanType,
      category: cleanCategory,
      date: when,
      accountId: account,
    });
    return NextResponse.json({ success: true, transaction }, { headers: noCacheHeaders });
  } catch (error: any) {
    if (error instanceof ValidationError || error instanceof LedgerError) return badRequest(error.message);
    console.error("Error logging business transaction:", error);
    return NextResponse.json({ success: false, error: "Failed to save transaction" }, { status: 500, headers: noCacheHeaders });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401, headers: noCacheHeaders });
    }

    const body = await readBody(req);
    const { id, type, amount, category, description, date: dateIn, clientId, accountId, applyToBalance } = body;
    if (typeof id !== "string" || !id || id.length > 100) throw new ValidationError("Transaction ID is required");

    const existing = await prisma.financeTransaction.findFirst({ where: { id, userId: user.id, businessId: { not: null } } });
    if (!existing) return notFound("Transaction not found", noCacheHeaders);

    const nextType = type !== undefined ? must(oneOf(type, ["INCOME", "EXPENSE"] as const, { required: true }), "Type must be INCOME or EXPENSE") : existing.amount >= 0 ? "INCOME" : "EXPENSE";
    const patch: Parameters<typeof updateEntry>[2] = {};
    if (type !== undefined) patch.type = nextType;
    if (amount !== undefined || type !== undefined) {
      const abs = amount !== undefined ? must(num(amount, { min: 0, max: 1e12, required: true }), "Amount must be a number, 0 or more") : Math.abs(existing.amount);
      patch.amount = nextType === "EXPENSE" ? -Math.abs(abs) : Math.abs(abs);
    }
    if (category !== undefined) patch.category = must(str(category, { max: 80 }), "Category is too long") ?? "General";
    if (description !== undefined) patch.description = must(str(description, { max: 300, required: true }), "Description is required (max 300 characters)");
    if (dateIn !== undefined) patch.date = must(date(dateIn, { required: true }), "Date is invalid");
    if (clientId !== undefined) {
      if (!clientId) patch.clientId = null;
      else {
        const client = await prisma.businessClient.findFirst({ where: { id: String(clientId), userId: user.id, businessId: existing.businessId! }, select: { id: true } });
        if (!client) return notFound("Client not found in this business", noCacheHeaders);
        patch.clientId = client.id;
      }
    }
    if (accountId !== undefined) {
      const owned = await ownedId("financeAccount", user.id, accountId);
      if (owned === undefined) return notFound("Account not found", noCacheHeaders);
      patch.accountId = owned;
    }
    if (applyToBalance === true) patch.applyToBalance = true;

    const transaction = await updateEntry(user.id, id, patch);
    return NextResponse.json({ success: true, transaction }, { headers: noCacheHeaders });
  } catch (error: any) {
    if (error instanceof ValidationError || error instanceof LedgerError) return badRequest(error.message);
    console.error("Error updating business transaction:", error);
    return NextResponse.json({ success: false, error: "Failed to update transaction" }, { status: 500, headers: noCacheHeaders });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401, headers: noCacheHeaders });
    }
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ success: false, error: "Transaction ID is required" }, { status: 400, headers: noCacheHeaders });

    const row = await prisma.financeTransaction.findFirst({ where: { id, userId: user.id, businessId: { not: null } }, select: { id: true } });
    if (!row) return notFound("Transaction not found", noCacheHeaders);
    await deleteEntry(user.id, id);
    return NextResponse.json({ success: true }, { headers: noCacheHeaders });
  } catch (error: any) {
    console.error("Error deleting business transaction:", error);
    return NextResponse.json({ success: false, error: "Failed to delete transaction" }, { status: 500, headers: noCacheHeaders });
  }
}
