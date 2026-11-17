import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { LedgerError, updateEntry } from "@/lib/ledger";
import { ValidationError, badRequest, date, must, notFound, num, oneOf, ownedId, readBody, str } from "@/lib/validate";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const noCache = { "Cache-Control": "no-store, no-cache, must-revalidate" };

/**
 * Edit a transaction: description, amount, type, category, date, account. The account balances are corrected
 * (the old amount comes off its account, the new one goes onto the new account).
 */
export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401, headers: noCache });

    const body = await readBody(req);
    const { id, description, amount, type, category, isRecurring, accountId, date: dateIn, applyToBalance } = body;
    if (typeof id !== "string" || !id || id.length > 100) throw new ValidationError("Transaction ID is required");

    const existing = await prisma.financeTransaction.findFirst({ where: { id, userId: user.id } });
    if (!existing) return notFound("Transaction not found", noCache);

    const nextType = type !== undefined ? must(oneOf(type, ["INCOME", "EXPENSE"] as const, { required: true }), "Type must be INCOME or EXPENSE") : existing.amount >= 0 ? "INCOME" : "EXPENSE";
    const patch: Parameters<typeof updateEntry>[2] = {};
    if (type !== undefined) patch.type = nextType;
    if (amount !== undefined || type !== undefined) {
      const abs = amount !== undefined ? must(num(amount, { min: 0, max: 1e12, required: true }), "Amount must be a number, 0 or more") : Math.abs(existing.amount);
      if (abs === 0) throw new ValidationError("The amount must be more than 0");
      patch.amount = nextType === "EXPENSE" ? -Math.abs(abs) : Math.abs(abs);
    }
    if (description !== undefined) patch.description = must(str(description, { max: 300, required: true }), "Description is required (max 300 characters)");
    if (category !== undefined) patch.category = must(str(category, { max: 80 }), "Category is too long") ?? "General";
    if (dateIn !== undefined) patch.date = must(date(dateIn, { required: true }), "Date is invalid");
    if (isRecurring !== undefined) patch.isRecurring = isRecurring === true;
    if (accountId !== undefined) {
      const owned = await ownedId("financeAccount", user.id, accountId);
      if (owned === undefined) return notFound("Account not found", noCache);
      patch.accountId = owned;
    }
    if (applyToBalance === true) patch.applyToBalance = true;

    const transaction = await updateEntry(user.id, id, patch);
    return NextResponse.json({ success: true, transaction }, { headers: noCache });
  } catch (error: any) {
    if (error instanceof ValidationError || error instanceof LedgerError) return badRequest(error.message);
    console.error("Error updating transaction:", error);
    return NextResponse.json({ success: false, error: "Failed to update transaction" }, { status: 500, headers: noCache });
  }
}
