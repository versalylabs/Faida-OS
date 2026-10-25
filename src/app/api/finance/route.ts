import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

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

    const transactions = await prisma.financeTransaction.findMany({
      where: { userId: user.id },
      orderBy: { date: "desc" },
      take: 100,
    });

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

    transactions.forEach((tx) => {
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
    let accounts = await prisma.financeAccount.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
    });

    if (accounts.length === 0) {
      const defaults = [
        { name: "Card", type: "CARD", balance: user.email === "khalwaleted@gmail.com" ? 75000 : 0, color: "#3b82f6" },
        { name: "Cash", type: "CASH", balance: user.email === "khalwaleted@gmail.com" ? 15000 : 0, color: "#10b981" },
        { name: "Savings", type: "SAVINGS", balance: user.email === "khalwaleted@gmail.com" ? 220000 : 0, color: "#8b5cf6" },
      ];
      for (const d of defaults) {
        await prisma.financeAccount.create({
          data: { userId: user.id, ...d },
        });
      }
      accounts = await prisma.financeAccount.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "asc" },
      });
    }

    // Check user's budgets or fallback
    const userBudgets = await prisma.budget.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });

    const overallBudgetRec = userBudgets.find((b) => b.category === "Overall");
    const personalBudgetRec = userBudgets.find((b) => b.category === "Personal");
    const businessBudgetRec = userBudgets.find((b) => b.category === "Business");
    const savingsBudgetRec = userBudgets.find((b) => b.category === "Savings");

    // Limits
    const personalBudget = personalBudgetRec
      ? personalBudgetRec.monthlyLimit
      : user.email === "khalwaleted@gmail.com"
      ? 120000
      : overallBudgetRec
      ? Math.round(overallBudgetRec.monthlyLimit * 0.6)
      : 0;

    const businessBudget = businessBudgetRec
      ? businessBudgetRec.monthlyLimit
      : user.email === "khalwaleted@gmail.com"
      ? 80000
      : overallBudgetRec
      ? Math.round(overallBudgetRec.monthlyLimit * 0.4)
      : 0;

    const savingsTarget = savingsBudgetRec
      ? savingsBudgetRec.monthlyLimit
      : user.email === "khalwaleted@gmail.com"
      ? 100000
      : 50000;

    const monthlyBudget = overallBudgetRec
      ? overallBudgetRec.monthlyLimit
      : personalBudget + businessBudget > 0
      ? personalBudget + businessBudget
      : user.email === "khalwaleted@gmail.com"
      ? 200000
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
    let categories = await prisma.financeCategory.findMany({
      where: { userId: user.id },
      orderBy: { name: "asc" },
    });

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

      for (const d of defaultExpenses) {
        await prisma.financeCategory.create({
          data: { userId: user.id, name: d.name, type: "EXPENSE", color: d.color },
        });
      }
      for (const name of defaultIncome) {
        await prisma.financeCategory.create({
          data: { userId: user.id, name, type: "INCOME", color: "#10b981" },
        });
      }

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
    console.error("Error fetching finance data:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch finance" },
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

    const body = await req.json();
    const { description, amount, type, category, isRecurring } = body;

    if (!description || amount === undefined || !type) {
      return NextResponse.json(
        { success: false, error: "Description, amount, and type are required" },
        { status: 400 }
      );
    }

    const parsedAmount = parseFloat(amount);
    const finalAmount = type === "EXPENSE" ? -Math.abs(parsedAmount) : Math.abs(parsedAmount);

    const transaction = await prisma.financeTransaction.create({
      data: {
        userId: user.id,
        description: description.trim(),
        amount: finalAmount,
        type,
        category: category || "General",
        isRecurring: isRecurring || false,
      },
    });

    // Log to activity log
    await prisma.activityLog.create({
      data: {
        action: "FINANCE_LOGGED",
        details: `Logged ${type}: ${description} (${finalAmount > 0 ? "+" : ""}${finalAmount} KES)`,
      },
    });

    return NextResponse.json({ success: true, transaction });
  } catch (error: any) {
    console.error("Error logging transaction:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to log transaction" },
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

    const body = await req.json();
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

    if (personalBudget !== undefined && !isNaN(parseFloat(personalBudget))) {
      await upsertBudget("Personal", parseFloat(personalBudget));
      updated = true;
    }

    if (businessBudget !== undefined && !isNaN(parseFloat(businessBudget))) {
      await upsertBudget("Business", parseFloat(businessBudget));
      updated = true;
    }

    if (savingsTarget !== undefined && !isNaN(parseFloat(savingsTarget))) {
      await upsertBudget("Savings", parseFloat(savingsTarget));
      updated = true;
    }

    if (monthlyBudget !== undefined && !isNaN(parseFloat(monthlyBudget))) {
      await upsertBudget("Overall", parseFloat(monthlyBudget));
      updated = true;
    }

    if (category && amount !== undefined && !isNaN(parseFloat(amount))) {
      await upsertBudget(category, parseFloat(amount));
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
    console.error("Error updating budget:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update budget" },
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
    console.error("Error deleting transaction:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to delete transaction" },
      { status: 500 }
    );
  }
}
