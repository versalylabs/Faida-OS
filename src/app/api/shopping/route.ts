import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ValidationError, badRequest, idOf, must, num, readBody, str } from "@/lib/validate";

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
    if (error instanceof ValidationError) return badRequest(error.message);
    console.error("Error fetching shopping items:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch shopping items" },
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

    const body = await readBody(req);
    const { name, quantity, category, preferredStore, estimatedPrice } = body;

    const cleanName = must(str(name, { max: 200, required: true }), "Item name is required (max 200 characters)");
    const cleanQuantity = must(str(typeof quantity === "number" ? String(quantity) : quantity, { max: 40 }), "Quantity is invalid") ?? "1";
    const cleanCategory = must(str(category, { max: 80 }), "Category is too long") ?? "Groceries";
    const cleanStore = must(str(preferredStore, { max: 120 }), "Store name is too long") ?? "Local Store";
    const cleanPrice = must(num(estimatedPrice, { min: 0, max: 1e9 }), "Estimated price must be a positive number");

    const item = await prisma.shoppingItem.create({
      data: {
        userId: user.id,
        name: cleanName,
        quantity: cleanQuantity,
        category: cleanCategory,
        preferredStore: cleanStore,
        estimatedPrice: cleanPrice,
      },
    });

    return NextResponse.json({ success: true, item }, { headers: noCacheHeaders });
  } catch (error: any) {
    if (error instanceof ValidationError) return badRequest(error.message);
    console.error("Error creating shopping item:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create shopping item" },
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

    const body = await readBody(req);
    const { id, isChecked, name, quantity, category, preferredStore, estimatedPrice } = body;

    const itemId = must(idOf(id), "Item ID required");

    const dataToUpdate: any = {};
    if (isChecked !== undefined) dataToUpdate.isChecked = Boolean(isChecked);
    if (name !== undefined) dataToUpdate.name = must(str(name, { max: 200, required: true }), "Item name is required (max 200 characters)");
    if (quantity !== undefined) dataToUpdate.quantity = must(str(typeof quantity === "number" ? String(quantity) : quantity, { max: 40 }), "Quantity is invalid") ?? "1";
    if (category !== undefined) dataToUpdate.category = must(str(category, { max: 80 }), "Category is too long") ?? "Groceries";
    if (preferredStore !== undefined) dataToUpdate.preferredStore = must(str(preferredStore, { max: 120 }), "Store name is too long") ?? "Local Store";
    if (estimatedPrice !== undefined) {
      dataToUpdate.estimatedPrice = must(num(estimatedPrice, { min: 0, max: 1e9 }), "Estimated price must be a positive number");
    }

    const existing = await prisma.shoppingItem.findFirst({
      where: { id: itemId, userId: user.id },
    });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Item not found" }, { status: 404, headers: noCacheHeaders });
    }

    const item = await prisma.shoppingItem.update({
      where: { id: itemId },
      data: dataToUpdate,
    });

    return NextResponse.json({ success: true, item }, { headers: noCacheHeaders });
  } catch (error: any) {
    if (error instanceof ValidationError) return badRequest(error.message);
    console.error("Error updating shopping item:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update shopping item" },
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
        const body = await readBody(req);
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
    if (error instanceof ValidationError) return badRequest(error.message);
    console.error("Error deleting shopping item:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete shopping item" },
      { status: 500, headers: noCacheHeaders }
    );
  }
}
