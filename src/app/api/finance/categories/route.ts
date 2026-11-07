import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ValidationError, badRequest, color, idOf, must, oneOf, readBody, str } from "@/lib/validate";

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
    if (error instanceof ValidationError) return badRequest(error.message);
    console.error("Error fetching categories:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch categories" },
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

    const body = await readBody(req);
    const { name, type, color: colorIn } = body;

    const cleanName = must(str(name, { max: 80, required: true }), "Name is required (max 80 characters)");
    const cleanType = must(oneOf(type, ["INCOME", "EXPENSE"] as const, { required: true }), "Type must be INCOME or EXPENSE");
    const cleanColor = must(color(colorIn), "Color must be a hex value like #10b981");

    const category = await prisma.financeCategory.create({
      data: {
        userId: user.id,
        name: cleanName,
        type: cleanType,
        color: cleanColor || (cleanType === "INCOME" ? "#10b981" : "#f43f5e"),
      },
    });

    return NextResponse.json({ success: true, category });
  } catch (error: any) {
    if (error instanceof ValidationError) return badRequest(error.message);
    console.error("Error creating category:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create category" },
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

    const body = await readBody(req);
    const { id, name, type, color: colorIn } = body;

    const categoryId = must(idOf(id), "Category ID required");
    const patchName = name !== undefined ? must(str(name, { max: 80, required: true }), "Name is required (max 80 characters)") : undefined;
    const patchType = type !== undefined ? must(oneOf(type, ["INCOME", "EXPENSE"] as const, { required: true }), "Type must be INCOME or EXPENSE") : undefined;
    const patchColor = colorIn !== undefined ? must(color(colorIn), "Color must be a hex value like #10b981") : undefined;

    const existing = await prisma.financeCategory.findFirst({
      where: { id: categoryId, userId: user.id },
    });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Category not found" }, { status: 404 });
    }

    const updated = await prisma.financeCategory.update({
      where: { id: categoryId },
      data: {
        ...(patchName !== undefined && { name: patchName }),
        ...(patchType !== undefined && { type: patchType }),
        ...(patchColor && { color: patchColor }),
      },
    });

    return NextResponse.json({ success: true, category: updated });
  } catch (error: any) {
    if (error instanceof ValidationError) return badRequest(error.message);
    console.error("Error updating category:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update category" },
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
        const body = await readBody(req);
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
    if (error instanceof ValidationError) return badRequest(error.message);
    console.error("Error deleting category:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete category" },
      { status: 500 }
    );
  }
}
