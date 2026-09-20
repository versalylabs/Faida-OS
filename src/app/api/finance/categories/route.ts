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

// GET /api/finance/categories - Fetch user categories
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401, headers: noCacheHeaders });
    }

    let categories = await prisma.financeCategory.findMany({
      where: { userId: user.id },
      orderBy: { name: "asc" },
    });

    // Auto-seed default categories if user has none
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

    return NextResponse.json({ success: true, categories });
  } catch (error: any) {
    console.error("Error fetching categories:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch categories" },
      { status: 500 }
    );
  }
}

// POST /api/finance/categories - Create category
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name, type, color } = body;

    if (!name || !name.trim() || !type) {
      return NextResponse.json(
        { success: false, error: "Name and type (INCOME/EXPENSE) are required" },
        { status: 400 }
      );
    }

    const category = await prisma.financeCategory.create({
      data: {
        userId: user.id,
        name: name.trim(),
        type: type === "INCOME" ? "INCOME" : "EXPENSE",
        color: color || (type === "INCOME" ? "#10b981" : "#f43f5e"),
      },
    });

    return NextResponse.json({ success: true, category });
  } catch (error: any) {
    console.error("Error creating category:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create category" },
      { status: 500 }
    );
  }
}

// PATCH /api/finance/categories - Edit category
export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { id, name, type, color } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: "Category ID required" }, { status: 400 });
    }

    const existing = await prisma.financeCategory.findFirst({
      where: { id, userId: user.id },
    });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Category not found" }, { status: 404 });
    }

    const updated = await prisma.financeCategory.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(type !== undefined && { type }),
        ...(color !== undefined && { color }),
      },
    });

    return NextResponse.json({ success: true, category: updated });
  } catch (error: any) {
    console.error("Error updating category:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update category" },
      { status: 500 }
    );
  }
}

// DELETE /api/finance/categories - Delete category
export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    let id = searchParams.get("id");
    if (!id) {
      try {
        const body = await req.json();
        id = body.id;
      } catch {}
    }

    if (!id) {
      return NextResponse.json({ success: false, error: "Category ID required" }, { status: 400 });
    }

    const existing = await prisma.financeCategory.findFirst({
      where: { id, userId: user.id },
    });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Category not found" }, { status: 404 });
    }

    await prisma.financeCategory.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: "Category deleted" });
  } catch (error: any) {
    console.error("Error deleting category:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to delete category" },
      { status: 500 }
    );
  }
}
