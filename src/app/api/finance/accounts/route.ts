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
    console.error("Error fetching accounts:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch accounts" },
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

    const body = await req.json();
    const { name, type, balance, color } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ success: false, error: "Account name is required" }, { status: 400 });
    }

    const account = await prisma.financeAccount.create({
      data: {
        userId: user.id,
        name: name.trim(),
        type: type || "CASH",
        balance: parseFloat(balance) || 0,
        color: color || "#10b981",
      },
    });

    return NextResponse.json({ success: true, account }, { headers: noCacheHeaders });
  } catch (error: any) {
    console.error("Error creating account:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create account" },
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

    const body = await req.json();
    const { id, name, type, balance, color } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: "Account ID is required" }, { status: 400, headers: noCacheHeaders });
    }

    const existing = await prisma.financeAccount.findFirst({
      where: { id, userId: user.id },
    });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Account not found" }, { status: 404, headers: noCacheHeaders });
    }

    const updated = await prisma.financeAccount.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(type !== undefined && { type }),
        ...(balance !== undefined && { balance: parseFloat(balance) }),
        ...(color !== undefined && { color }),
      },
    });

    return NextResponse.json({ success: true, account: updated }, { headers: noCacheHeaders });
  } catch (error: any) {
    console.error("Error updating account:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update account" },
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
        const body = await req.json();
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
    console.error("Error deleting account:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to delete account" },
      { status: 500, headers: noCacheHeaders }
    );
  }
}
