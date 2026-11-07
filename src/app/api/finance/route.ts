import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { zonedNow } from "@/lib/tz";
import { ValidationError, badRequest, must, num, oneOf, readBody, str } from "@/lib/validate";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const noCacheHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401, headers: noCacheHeaders });
    }

    // The four reads are independent: start them together so the page pays for one database
    // round trip instead of four in a row.
    const accountsQuery = prisma.financeAccount.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
    });
    const budgetsQuery = prisma.budget.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });
    const categoriesQuery = prisma.financeCategory.findMany({
      where: { userId: user.id },
      orderBy: { name: "asc" },
    });
    // Budgets are monthly, so spending is measured over *this calendar month* (in the user's time zone) and
    // over every transaction in it, not just the latest 100. The list shown on the page is still the latest 100.
    const monthStart = zonedNow().startOfMonth;
    const [transactions, monthTransactions] = await Promise.all([
      prisma.financeTransaction.findMany({
        where: { userId: user.id },
        orderBy: { date: "desc" },
        take: 100,
      }),
      prisma.financeTransaction.findMany({
        where: { userId: user.id, date: { gte: monthStart } },
        select: { amount: true, category: true },
      }),
    ]);

    let totalIncome = 0;
    let totalExpense = 0;
    let personalExpense = 0;
    let businessExpense = 0;
    const categoryBreakdown: Record<string, number> = {};
    const expenseCategoryBreakdown: Record<string, number> = {};
    const incomeCategoryBreakdown: Record<string, number> = {};

    const isBusinessCategory = (cat: string) => {
      const lower = cat.toLowerCase();
      const keywords = [
        "business",
        "marketing",
        "ads",
        "tech",
        "software",
        "cloud",
        "contractor",
        "office",
        "hosting",
        "tools",
        "versaly",
        "straten",
        "client",
        "agency",
        "development",
        "freelance expense",
      ];
      return keywords.some((k) => lower.includes(k));
    };

    monthTransactions.forEach((tx) => {
      const cat = tx.category || "General";
      if (tx.amount > 0) {
        totalIncome += tx.amount;
        incomeCategoryBreakdown[cat] = (incomeCategoryBreakdown[cat] || 0) + tx.amount;
      } else {
        const absAmt = Math.abs(tx.amount);
        totalExpense += absAmt;
        if (isBusinessCategory(cat)) {
          businessExpense += absAmt;
        } else {
          personalExpense += absAmt;
        }
        categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + absAmt;
        expenseCategoryBreakdown[cat] = (expenseCategoryBreakdown[cat] || 0) + absAmt;
      }
    });

    // Accounts (with default fallback auto-seed)
    let accounts = await accountsQuery;

    if (accounts.length === 0) {
      const defaults = [
        { name: "Card", type: "CARD", balance: 0, color: "#3b82f6" },
        { name: "Cash", type: "CASH", balance: 0, color: "#10b981" },
        { name: "Savings", type: "SAVINGS", balance: 0, color: "#8b5cf6" },
      ];
      await prisma.financeAccount.createMany({
        data: defaults.map((d) => ({ userId: user.id, ...d })),
      });
      accounts = await prisma.financeAccount.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "asc" },
      });
    }

    // Check user's budgets or fallback
    const userBudgets = await budgetsQuery;

    const overallBudgetRec = userBudgets.find((b) => b.category === "Overall");
    const personalBudgetRec = userBudgets.find((b) => b.category === "Personal");
    const businessBudgetRec = userBudgets.find((b) => b.category === "Business");
    const savingsBudgetRec = userBudgets.find((b) => b.category === "Savings");

    // Limits
    const personalBudget = personalBudgetRec
      ? personalBudgetRec.monthlyLimit
      : overallBudgetRec
      ? Math.round(overallBudgetRec.monthlyLimit * 0.6)
      : 0;

    const businessBudget = businessBudgetRec
      ? businessBudgetRec.monthlyLimit
      : overallBudgetRec
      ? Math.round(overallBudgetRec.monthlyLimit * 0.4)
      : 0;

    const savingsTarget = savingsBudgetRec
      ? savingsBudgetRec.monthlyLimit
      : 0;

    const monthlyBudget = overallBudgetRec
      ? overallBudgetRec.monthlyLimit
      : personalBudget + businessBudget > 0
      ? personalBudget + businessBudget
      : 0;

    // Remaining & percentages
    const remainingBudget = monthlyBudget - totalExpense;
    const budgetPercentUsed =
      monthlyBudget > 0 ? Math.min(100, Math.round((totalExpense / monthlyBudget) * 100)) : 0;

    const personalRemaining = personalBudget - personalExpense;
    const personalPercentUsed =
      personalBudget > 0 ? Math.min(100, Math.round((personalExpense / personalBudget) * 100)) : 0;

    const businessRemaining = businessBudget - businessExpense;
    const businessPercentUsed =
      businessBudget > 0 ? Math.min(100, Math.round((businessExpense / businessBudget) * 100)) : 0;

    // Savings & Liquidity
    const savingsBalance = accounts
      .filter((a) => a.type === "SAVINGS" || a.name.toLowerCase().includes("saving"))
      .reduce((sum, a) => sum + a.balance, 0);

    const savingsPercent =
      savingsTarget > 0 ? Math.min(100, Math.round((savingsBalance / savingsTarget) * 100)) : 0;

    const totalLiquidBalance = accounts.reduce((sum, a) => sum + a.balance, 0);
    const netCashFlow = totalIncome - totalExpense;

    // Categories (with default fallback auto-seed)
    let categories = await categoriesQuery;

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

      categories = await prisma.financeCategory.findMany({
        where: { userId: user.id },
        orderBy: { name: "asc" },
      });
    }

    return NextResponse.json(
      {
        success: true,
        transactions,
        accounts,
        categories,
        metrics: {
          monthlyBudget,
          remainingBudget,
          budgetPercentUsed,
          personalBudget,
          personalExpense,
          personalRemaining,
          personalPercentUsed,
          businessBudget,
          businessExpense,
          businessRemaining,
          businessPercentUsed,
          savingsTarget,
          savingsBalance,
          savingsPercent,
          totalLiquidBalance,
          netCashFlow,
          totalIncome,
          totalExpense,
          categoryBreakdown,
          expenseCategoryBreakdown,
          incomeCategoryBreakdown,
        },
      },
      { headers: noCacheHeaders }
    );
  } catch (error: any) {
    if (error instanceof ValidationError) return badRequest(error.message);
    console.error("Error fetching finance data:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch finance" },
      { status: 500, headers: noCacheHeaders }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await readBody(req);
    const { description, amount, type, category, isRecurring } = body;

    const cleanDescription = must(str(description, { max: 300, required: true }), "Description is required (max 300 characters)");
    const cleanType = must(oneOf(type, ["INCOME", "EXPENSE"] as const, { required: true }), "Type must be INCOME or EXPENSE");
    const parsedAmount = must(num(amount, { min: -1e12, max: 1e12, required: true }), "Amount must be a valid number");
    const cleanCategory = must(str(category, { max: 80 }), "Category is too long") ?? "General";

    const finalAmount = cleanType === "EXPENSE" ? -Math.abs(parsedAmount) : Math.abs(parsedAmount);

    const transaction = await prisma.financeTransaction.create({
      data: {
        userId: user.id,
        description: cleanDescription,
        amount: finalAmount,
        type: cleanType,
        category: cleanCategory,
        isRecurring: isRecurring === true,
      },
    });

    // Log to activity log
    await prisma.activityLog.create({
      data: {
        action: "FINANCE_LOGGED",
        details: `Logged ${cleanType}: ${cleanDescription} (${finalAmount > 0 ? "+" : ""}${finalAmount} KES)`,
      },
    });

    return NextResponse.json({ success: true, transaction });
  } catch (error: any) {
    if (error instanceof ValidationError) return badRequest(error.message);
    console.error("Error logging transaction:", error);
    return NextResponse.json(
      { success: false, error: "Failed to log transaction" },
      { status: 500 }
    );
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
      const existing = await prisma.budget.findFirst({
        where: { userId: user.id, category: cat },
      });
      if (existing) {
        return prisma.budget.update({
          where: { id: existing.id },
          data: { monthlyLimit: cleanLimit },
        });
      } else {
        return prisma.budget.create({
          data: {
            userId: user.id,
            category: cat,
            monthlyLimit: cleanLimit,
            monthYear: new Date().toISOString().slice(0, 7),
          },
        });
      }
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
      return NextResponse.json(
        { success: false, error: "No valid budget value provided" },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true }, { headers: noCacheHeaders });
  } catch (error: any) {
    if (error instanceof ValidationError) return badRequest(error.message);
    console.error("Error updating budget:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update budget" },
      { status: 500, headers: noCacheHeaders }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, error: "Transaction ID required" }, { status: 400 });
    }

    const existing = await prisma.financeTransaction.findFirst({
      where: { id, userId: user.id },
    });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Transaction not found" }, { status: 404 });
    }

    await prisma.financeTransaction.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error instanceof ValidationError) return badRequest(error.message);
    console.error("Error deleting transaction:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete transaction" },
      { status: 500 }
    );
  }
}
