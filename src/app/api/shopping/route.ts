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

    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");

    const where: any = { userId: user.id };
    if (category && category !== "ALL") {
      where.category = category;
    }

    const items = await prisma.shoppingItem.findMany({
      where,
      orderBy: [
        { isChecked: "asc" },
        { createdAt: "desc" },
      ],
    });

    const pendingCount = items.filter((i) => !i.isChecked).length;
    const completedCount = items.filter((i) => i.isChecked).length;

    return NextResponse.json({
      success: true,
      items,
      pendingCount,
      completedCount,
    }, { headers: noCacheHeaders });
  } catch (error: any) {
    console.error("Error fetching shopping items:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch shopping items" },
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
    const { name, quantity, category, preferredStore, estimatedPrice } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ success: false, error: "Item name is required" }, { status: 400, headers: noCacheHeaders });
    }

    const item = await prisma.shoppingItem.create({
      data: {
        userId: user.id,
        name: name.trim(),
        quantity: quantity || "1",
        category: category || "Groceries",
        preferredStore: preferredStore || "Local Store",
        estimatedPrice: estimatedPrice ? parseFloat(estimatedPrice) : null,
      },
    });

    return NextResponse.json({ success: true, item }, { headers: noCacheHeaders });
  } catch (error: any) {
    console.error("Error creating shopping item:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create shopping item" },
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
    const { id, isChecked, name, quantity, category, preferredStore, estimatedPrice } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: "Item ID required" }, { status: 400, headers: noCacheHeaders });
    }

    const existing = await prisma.shoppingItem.findFirst({
      where: { id, userId: user.id },
    });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Item not found" }, { status: 404, headers: noCacheHeaders });
    }

    const dataToUpdate: any = {};
    if (isChecked !== undefined) dataToUpdate.isChecked = Boolean(isChecked);
    if (name !== undefined) dataToUpdate.name = name.trim();
    if (quantity !== undefined) dataToUpdate.quantity = quantity;
    if (category !== undefined) dataToUpdate.category = category;
    if (preferredStore !== undefined) dataToUpdate.preferredStore = preferredStore;
    if (estimatedPrice !== undefined) {
      dataToUpdate.estimatedPrice = estimatedPrice ? parseFloat(estimatedPrice) : null;
    }

    const item = await prisma.shoppingItem.update({
      where: { id },
      data: dataToUpdate,
    });

    return NextResponse.json({ success: true, item }, { headers: noCacheHeaders });
  } catch (error: any) {
    console.error("Error updating shopping item:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update shopping item" },
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
      return NextResponse.json({ success: false, error: "Item ID required" }, { status: 400, headers: noCacheHeaders });
    }

    const existing = await prisma.shoppingItem.findFirst({
      where: { id, userId: user.id },
    });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Item not found" }, { status: 404, headers: noCacheHeaders });
    }

    await prisma.shoppingItem.delete({ where: { id } });
    return NextResponse.json({ success: true }, { headers: noCacheHeaders });
  } catch (error: any) {
    console.error("Error deleting shopping item:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to delete shopping item" },
      { status: 500, headers: noCacheHeaders }
    );
  }
}
