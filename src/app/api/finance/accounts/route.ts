import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ValidationError, badRequest, color, idOf, must, num, readBody, safeFloat, str } from "@/lib/validate";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const noCacheHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

// GET /api/finance/accounts - Fetch user accounts
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401, headers: noCacheHeaders });
    }

    let accounts = await prisma.financeAccount.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
    });

    // Auto-create initial default accounts if none exist
    if (accounts.length === 0) {
      const defaults = [
        { name: "Card", type: "CARD", balance: 0, color: "#3b82f6" },
        { name: "Cash", type: "CASH", balance: 0, color: "#10b981" },
        { name: "Savings", type: "SAVINGS", balance: 0, color: "#8b5cf6" },
      ];
      for (const d of defaults) {
        await prisma.financeAccount.create({
          data: {
            userId: user.id,
            ...d,
          },
        });
      }
      accounts = await prisma.financeAccount.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "asc" },
      });
    }

    return NextResponse.json({ success: true, accounts }, { headers: noCacheHeaders });
  } catch (error: any) {
    if (error instanceof ValidationError) return badRequest(error.message);
    console.error("Error fetching accounts:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch accounts" },
      { status: 500, headers: noCacheHeaders }
    );
  }
}

// POST /api/finance/accounts - Create a new account
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401, headers: noCacheHeaders });
    }

    const body = await readBody(req);
    const { name, type, balance, color: colorIn } = body;

    const cleanName = must(str(name, { max: 120, required: true }), "Account name is required (max 120 characters)");
    const cleanType = must(str(type, { max: 40 }), "Account type is invalid") ?? "CASH";
    const cleanColor = must(color(colorIn), "Color must be a hex value like #10b981") ?? "#10b981";

    const account = await prisma.financeAccount.create({
      data: {
        userId: user.id,
        name: cleanName,
        type: cleanType,
        balance: safeFloat(balance, 0),
        color: cleanColor,
      },
    });

    return NextResponse.json({ success: true, account }, { headers: noCacheHeaders });
  } catch (error: any) {
    if (error instanceof ValidationError) return badRequest(error.message);
    console.error("Error creating account:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create account" },
      { status: 500, headers: noCacheHeaders }
    );
  }
}

// PATCH /api/finance/accounts - Update account name, type, balance, or color
export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401, headers: noCacheHeaders });
    }

    const body = await readBody(req);
    const { id, name, type, balance, color: colorIn } = body;

    const accountId = must(idOf(id), "Account ID is required");
    const patchName = name !== undefined ? must(str(name, { max: 120, required: true }), "Account name is required (max 120 characters)") : undefined;
    const patchType = type !== undefined ? must(str(type, { max: 40, required: true }), "Account type is invalid") : undefined;
    const patchBalance = balance !== undefined ? must(num(balance, { min: -1e12, max: 1e12, required: true }), "Balance must be a valid number") : undefined;
    const patchColor = colorIn !== undefined ? must(color(colorIn), "Color must be a hex value like #10b981") : undefined;

    const existing = await prisma.financeAccount.findFirst({
      where: { id: accountId, userId: user.id },
    });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Account not found" }, { status: 404, headers: noCacheHeaders });
    }

    const updated = await prisma.financeAccount.update({
      where: { id: accountId },
      data: {
        ...(patchName !== undefined && { name: patchName }),
        ...(patchType !== undefined && { type: patchType }),
        ...(patchBalance !== undefined && { balance: patchBalance }),
        ...(patchColor && { color: patchColor }),
      },
    });

    return NextResponse.json({ success: true, account: updated }, { headers: noCacheHeaders });
  } catch (error: any) {
    if (error instanceof ValidationError) return badRequest(error.message);
    console.error("Error updating account:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update account" },
      { status: 500, headers: noCacheHeaders }
    );
  }
}

// DELETE /api/finance/accounts - Delete account
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
      return NextResponse.json({ success: false, error: "Account ID is required" }, { status: 400, headers: noCacheHeaders });
    }

    const existing = await prisma.financeAccount.findFirst({
      where: { id, userId: user.id },
    });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Account not found" }, { status: 404, headers: noCacheHeaders });
    }

    await prisma.financeAccount.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: "Account deleted" }, { headers: noCacheHeaders });
  } catch (error: any) {
    if (error instanceof ValidationError) return badRequest(error.message);
    console.error("Error deleting account:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete account" },
      { status: 500, headers: noCacheHeaders }
    );
  }
}
