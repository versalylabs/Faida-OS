import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { PURCHASE_CATEGORIES } from "@/lib/businessMath";
import { ValidationError, badRequest, date, must, notFound, num, oneOf, ownedId, readBody, str } from "@/lib/validate";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const noCacheHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

const CATEGORIES = PURCHASE_CATEGORIES.map((c) => c.value) as readonly string[];
const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
const STATUSES = ["WISHLIST", "PLANNED", "BOUGHT"] as const;

/** Only http(s) links are kept, so a pasted value can never become a script link. */
function cleanLink(value: unknown): string | null {
  const v = must(str(value, { max: 500 }), "Link is too long");
  if (!v) return null;
  try {
    const u = new URL(v);
    if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("bad protocol");
    return u.toString();
  } catch {
    throw new ValidationError("Link must start with http:// or https://");
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401, headers: noCacheHeaders });
    }
    const businessFilter = new URL(req.url).searchParams.get("businessId");
    const businessId = businessFilter ? await ownedId("business", user.id, businessFilter) : null;
    if (businessFilter && !businessId) return notFound("Business not found", noCacheHeaders);

    const purchases = await prisma.businessPurchase.findMany({
      where: { userId: user.id, ...(businessId ? { businessId } : {}) },
      orderBy: [{ createdAt: "desc" }],
    });
    return NextResponse.json({ success: true, purchases }, { headers: noCacheHeaders });
  } catch (error: any) {
    if (error instanceof ValidationError) return badRequest(error.message);
    console.error("Error loading purchases:", error);
    return NextResponse.json({ success: false, error: "Failed to load purchases" }, { status: 500, headers: noCacheHeaders });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401, headers: noCacheHeaders });
    }
    const body = await readBody(req);
    const ownedBusinessId = await ownedId("business", user.id, body.businessId);
    if (!ownedBusinessId) return notFound("Business not found", noCacheHeaders);

    const purchase = await prisma.businessPurchase.create({
      data: {
        userId: user.id,
        businessId: ownedBusinessId,
        name: must(str(body.name, { max: 200, required: true }), "Name is required (max 200 characters)"),
        category: must(oneOf(body.category, CATEGORIES, { required: false }), "Invalid category") ?? "EQUIPMENT",
        estimatedCost: must(num(body.estimatedCost, { min: 0, max: 1e12 }), "Cost must be a number, 0 or more") ?? 0,
        priority: must(oneOf(body.priority, PRIORITIES), "Invalid priority") ?? "MEDIUM",
        neededBy: must(date(body.neededBy), "Needed-by date is invalid"),
        link: cleanLink(body.link),
        notes: must(str(body.notes, { max: 2000 }), "Notes are too long"),
        status: "WISHLIST",
      },
    });
    return NextResponse.json({ success: true, purchase }, { headers: noCacheHeaders });
  } catch (error: any) {
    if (error instanceof ValidationError) return badRequest(error.message);
    console.error("Error creating purchase:", error);
    return NextResponse.json({ success: false, error: "Failed to save purchase" }, { status: 500, headers: noCacheHeaders });
  }
}

/**
 * Edit a purchase. Marking one BOUGHT can also record the money as a business expense (logExpense: true),
 * once: it only happens on the change to BOUGHT.
 */
export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401, headers: noCacheHeaders });
    }
    const body = await readBody(req);
    if (typeof body.id !== "string" || !body.id || body.id.length > 100) throw new ValidationError("Purchase ID is required");

    const existing = await prisma.businessPurchase.findFirst({ where: { id: body.id, userId: user.id } });
    if (!existing) return notFound("Purchase not found", noCacheHeaders);

    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = must(str(body.name, { max: 200, required: true }), "Name is required (max 200 characters)");
    if (body.category !== undefined) data.category = must(oneOf(body.category, CATEGORIES, { required: true }), "Invalid category");
    if (body.estimatedCost !== undefined) data.estimatedCost = must(num(body.estimatedCost, { min: 0, max: 1e12, required: true }), "Cost must be a number, 0 or more");
    if (body.priority !== undefined) data.priority = must(oneOf(body.priority, PRIORITIES, { required: true }), "Invalid priority");
    if (body.neededBy !== undefined) data.neededBy = must(date(body.neededBy), "Needed-by date is invalid");
    if (body.link !== undefined) data.link = cleanLink(body.link);
    if (body.notes !== undefined) data.notes = must(str(body.notes, { max: 2000 }), "Notes are too long");

    const nextStatus = body.status !== undefined ? must(oneOf(body.status, STATUSES, { required: true }), "Invalid status") : existing.status;
    if (body.status !== undefined) data.status = nextStatus;

    const becomesBought = nextStatus === "BOUGHT" && existing.status !== "BOUGHT";
    const leavesBought = nextStatus !== "BOUGHT" && existing.status === "BOUGHT";
    if (becomesBought) {
      const cost = body.actualCost !== undefined ? must(num(body.actualCost, { min: 0, max: 1e12, required: true }), "Actual cost must be a number, 0 or more") : (existing.actualCost ?? existing.estimatedCost);
      data.actualCost = cost;
      data.purchasedAt = must(date(body.purchasedAt), "Purchase date is invalid") ?? new Date();
    } else if (leavesBought) {
      data.purchasedAt = null;
    } else if (body.actualCost !== undefined) {
      data.actualCost = must(num(body.actualCost, { min: 0, max: 1e12 }), "Actual cost must be a number, 0 or more");
    }

    const purchase = await prisma.businessPurchase.update({ where: { id: existing.id }, data });

    let expenseLogged = false;
    if (becomesBought && body.logExpense === true) {
      const amount = Number(purchase.actualCost ?? purchase.estimatedCost ?? 0);
      if (amount > 0) {
        const category = PURCHASE_CATEGORIES.find((c) => c.value === purchase.category)?.expenseCategory ?? "Other expense";
        await prisma.financeTransaction.create({
          data: {
            userId: user.id,
            businessId: purchase.businessId,
            description: `Purchase: ${purchase.name}`,
            amount: -Math.abs(amount),
            type: "EXPENSE",
            category,
            date: purchase.purchasedAt ?? new Date(),
          },
        });
        expenseLogged = true;
      }
    }

    return NextResponse.json({ success: true, purchase, expenseLogged }, { headers: noCacheHeaders });
  } catch (error: any) {
    if (error instanceof ValidationError) return badRequest(error.message);
    console.error("Error updating purchase:", error);
    return NextResponse.json({ success: false, error: "Failed to update purchase" }, { status: 500, headers: noCacheHeaders });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401, headers: noCacheHeaders });
    }
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ success: false, error: "Purchase ID is required" }, { status: 400, headers: noCacheHeaders });
    const result = await prisma.businessPurchase.deleteMany({ where: { id, userId: user.id } });
    if (result.count === 0) return notFound("Purchase not found", noCacheHeaders);
    return NextResponse.json({ success: true }, { headers: noCacheHeaders });
  } catch (error: any) {
    console.error("Error deleting purchase:", error);
    return NextResponse.json({ success: false, error: "Failed to delete purchase" }, { status: 500, headers: noCacheHeaders });
  }
}
