import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const transactions = await prisma.financeTransaction.findMany({
      where: { userId: user.id },
      orderBy: { date: "desc" },
      take: 100,
    });

    let totalIncome = 0;
    let totalExpense = 0;
    const categoryBreakdown: Record<string, number> = {};

    transactions.forEach((tx) => {
      if (tx.amount > 0) {
        totalIncome += tx.amount;
      } else {
        totalExpense += Math.abs(tx.amount);
        const cat = tx.category || "General";
        categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + Math.abs(tx.amount);
      }
    });

    // Check user's budgets or fallback
    const userBudgets = await prisma.budget.findMany({
      where: { userId: user.id },
    });
    const monthlyBudget =
      userBudgets.length > 0
        ? userBudgets.reduce((acc, b) => acc + b.monthlyLimit, 0)
        : user.email === "khalwaleted@gmail.com"
        ? 310000
        : 0;

    const remainingBudget = monthlyBudget - totalExpense;
    const budgetPercentUsed =
      monthlyBudget > 0 ? Math.min(100, Math.round((totalExpense / monthlyBudget) * 100)) : 0;

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

    // Categories (with default fallback auto-seed)
    let categories = await prisma.financeCategory.findMany({
      where: { userId: user.id },
      orderBy: { name: "asc" },
    });

    if (categories.length === 0) {
      const defaultExpenses = [
        "Groceries",
        "Food & Dining",
        "Rent & Utilities",
        "Transport",
        "Tech & Subscriptions",
        "Health",
        "Shopping",
        "Entertainment",
      ];
      const defaultIncome = ["Salary", "Freelance", "Investments", "Business", "Gifts"];

      for (const name of defaultExpenses) {
        await prisma.financeCategory.create({
          data: { userId: user.id, name, type: "EXPENSE", color: "#f43f5e" },
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

    return NextResponse.json({
      success: true,
      transactions,
      accounts,
      categories,
      metrics: {
        monthlyBudget,
        remainingBudget,
        budgetPercentUsed,
        totalIncome,
        totalExpense,
        categoryBreakdown,
      },
    });
  } catch (error: any) {
    console.error("Error fetching finance data:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch finance" },
      { status: 500 }
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

// PATCH /api/finance - Update user monthly budget
export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { monthlyBudget } = body;

    if (monthlyBudget === undefined || isNaN(parseFloat(monthlyBudget))) {
      return NextResponse.json(
        { success: false, error: "Valid monthlyBudget number is required" },
        { status: 400 }
      );
    }

    const limit = Math.max(0, parseFloat(monthlyBudget));

    // Look for existing primary budget entry for this user
    const existingBudget = await prisma.budget.findFirst({
      where: { userId: user.id },
    });

    if (existingBudget) {
      await prisma.budget.update({
        where: { id: existingBudget.id },
        data: { monthlyLimit: limit },
      });
    } else {
      await prisma.budget.create({
        data: {
          userId: user.id,
          category: "Overall",
          monthlyLimit: limit,
          monthYear: new Date().toISOString().slice(0, 7),
        },
      });
    }

    return NextResponse.json({ success: true, monthlyBudget: limit });
  } catch (error: any) {
    console.error("Error updating monthly budget:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update budget" },
      { status: 500 }
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
