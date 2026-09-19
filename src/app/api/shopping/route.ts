import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const items = await prisma.shoppingItem.findMany({
      where: { userId: user.id },
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
    });
  } catch (error: any) {
    console.error("Error fetching shopping items:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch shopping items" },
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
    const { name, quantity, category, preferredStore, estimatedPrice } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ success: false, error: "Item name is required" }, { status: 400 });
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

    return NextResponse.json({ success: true, item });
  } catch (error: any) {
    console.error("Error creating shopping item:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create shopping item" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { id, isChecked } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: "Item ID required" }, { status: 400 });
    }

    const existing = await prisma.shoppingItem.findFirst({
      where: { id, userId: user.id },
    });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Item not found" }, { status: 404 });
    }

    const item = await prisma.shoppingItem.update({
      where: { id },
      data: { isChecked: isChecked ?? true },
    });

    return NextResponse.json({ success: true, item });
  } catch (error: any) {
    console.error("Error updating shopping item:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update shopping item" },
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
      return NextResponse.json({ success: false, error: "Item ID required" }, { status: 400 });
    }

    const existing = await prisma.shoppingItem.findFirst({
      where: { id, userId: user.id },
    });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Item not found" }, { status: 404 });
    }

    await prisma.shoppingItem.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting shopping item:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to delete shopping item" },
      { status: 500 }
    );
  }
}
