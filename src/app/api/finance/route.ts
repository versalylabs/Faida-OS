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
      take: 50,
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
    const monthlyBudget = userBudgets.reduce((acc, b) => acc + b.monthlyLimit, 0) || (user.email === "khalwaleted@gmail.com" ? 310000 : 0);
    const remainingBudget = monthlyBudget - totalExpense;
    const budgetPercentUsed = monthlyBudget > 0 ? Math.min(100, Math.round((totalExpense / monthlyBudget) * 100)) : 0;

    return NextResponse.json({
      success: true,
      transactions,
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
