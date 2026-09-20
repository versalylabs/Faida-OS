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

const DEFAULT_SHOPPING_CATEGORIES = [
  { name: "Groceries", color: "#10b981" },
  { name: "Cereals", color: "#f59e0b" },
  { name: "Personal Care", color: "#ec4899" },
  { name: "Tech & Electronics", color: "#3b82f6" },
  { name: "Household", color: "#8b5cf6" },
  { name: "Supplies", color: "#06b6d4" },
];

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401, headers: noCacheHeaders });
    }

    let categories = await prisma.shoppingCategory.findMany({
      where: { userId: user.id },
      orderBy: { name: "asc" },
    });

    // Auto-seed default categories if user has none
    if (categories.length === 0) {
      for (const def of DEFAULT_SHOPPING_CATEGORIES) {
        await prisma.shoppingCategory.create({
          data: {
            userId: user.id,
            name: def.name,
            color: def.color,
          },
        }).catch(() => {});
      }

      categories = await prisma.shoppingCategory.findMany({
        where: { userId: user.id },
        orderBy: { name: "asc" },
      });
    }

    // Get item counts per category for this user
    const items = await prisma.shoppingItem.findMany({
      where: { userId: user.id },
      select: { category: true },
    });

    const categoryCounts: Record<string, number> = {};
    for (const item of items) {
      if (item.category) {
        categoryCounts[item.category] = (categoryCounts[item.category] || 0) + 1;
      }
    }

    const enrichedCategories = categories.map((cat) => ({
      ...cat,
      itemCount: categoryCounts[cat.name] || 0,
    }));

    return NextResponse.json({ success: true, categories: enrichedCategories }, { headers: noCacheHeaders });
  } catch (error: any) {
    console.error("Error fetching shopping categories:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch shopping categories" },
      { status: 500, headers: noCacheHeaders }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401, headers: noCacheHeaders });
    }

    const body = await req.json();
    const { name, color, icon } = body;

    if (!name || !name.trim()) {
      return NextResponse.json(
        { success: false, error: "Category name is required" },
        { status: 400, headers: noCacheHeaders }
      );
    }

    const trimmedName = name.trim();

    // Check for duplicate name for this user
    const existing = await prisma.shoppingCategory.findFirst({
      where: {
        userId: user.id,
        name: { equals: trimmedName, mode: "insensitive" },
      },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: "A category with this name already exists" },
        { status: 400, headers: noCacheHeaders }
      );
    }

    const category = await prisma.shoppingCategory.create({
      data: {
        userId: user.id,
        name: trimmedName,
        color: color || "#10b981",
        icon: icon || "Tag",
      },
    });

    return NextResponse.json({ success: true, category }, { headers: noCacheHeaders });
  } catch (error: any) {
    console.error("Error creating shopping category:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create shopping category" },
      { status: 500, headers: noCacheHeaders }
    );
  }
}

export async function PUT(req: NextRequest) {
  return handleUpdate(req);
}

export async function PATCH(req: NextRequest) {
  return handleUpdate(req);
}

async function handleUpdate(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401, headers: noCacheHeaders });
    }

    const body = await req.json();
    const { id, name, color, icon } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: "Category ID required" }, { status: 400, headers: noCacheHeaders });
    }

    const existing = await prisma.shoppingCategory.findFirst({
      where: { id, userId: user.id },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: "Category not found" }, { status: 404, headers: noCacheHeaders });
    }

    const trimmedName = name ? name.trim() : existing.name;

    // Check duplicate name if renamed
    if (name && trimmedName.toLowerCase() !== existing.name.toLowerCase()) {
      const duplicate = await prisma.shoppingCategory.findFirst({
        where: {
          userId: user.id,
          name: { equals: trimmedName, mode: "insensitive" },
          NOT: { id },
        },
      });

      if (duplicate) {
        return NextResponse.json(
          { success: false, error: "Another category with this name already exists" },
          { status: 400, headers: noCacheHeaders }
        );
      }
    }

    const updatedCategory = await prisma.shoppingCategory.update({
      where: { id },
      data: {
        name: trimmedName,
        color: color || existing.color,
        icon: icon || existing.icon,
      },
    });

    // If name changed, update existing shopping items to keep them in sync
    if (name && trimmedName !== existing.name) {
      await prisma.shoppingItem.updateMany({
        where: { userId: user.id, category: existing.name },
        data: { category: trimmedName },
      }).catch(() => {});
    }

    return NextResponse.json({ success: true, category: updatedCategory }, { headers: noCacheHeaders });
  } catch (error: any) {
    console.error("Error updating shopping category:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update shopping category" },
      { status: 500, headers: noCacheHeaders }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401, headers: noCacheHeaders });
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
      return NextResponse.json({ success: false, error: "Category ID required" }, { status: 400, headers: noCacheHeaders });
    }

    const existing = await prisma.shoppingCategory.findFirst({
      where: { id, userId: user.id },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: "Category not found" }, { status: 404, headers: noCacheHeaders });
    }

    // Reassign items in this category to Groceries or Uncategorized
    await prisma.shoppingItem.updateMany({
      where: { userId: user.id, category: existing.name },
      data: { category: "Groceries" },
    }).catch(() => {});

    await prisma.shoppingCategory.delete({ where: { id } });

    return NextResponse.json({ success: true, message: "Category deleted" }, { headers: noCacheHeaders });
  } catch (error: any) {
    console.error("Error deleting shopping category:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to delete shopping category" },
      { status: 500, headers: noCacheHeaders }
    );
  }
}
