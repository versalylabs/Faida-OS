import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { LedgerError, createTransfer } from "@/lib/ledger";
import { ValidationError, badRequest, date, must, notFound, num, ownedId, readBody, str } from "@/lib/validate";

export const dynamic = "force-dynamic";

const noCache = { "Cache-Control": "no-store, no-cache, must-revalidate" };

/** Move money from one of your accounts to another (cash to M-Pesa, bank to savings...). Not income, not spending. */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401, headers: noCache });

    const body = await readBody(req);
    const fromId = await ownedId("financeAccount", user.id, body.fromAccountId);
    const toId = await ownedId("financeAccount", user.id, body.toAccountId);
    if (!fromId || !toId) return notFound("Account not found", noCache);
    const amount = must(num(body.amount, { min: 0, max: 1e12, required: true }), "Amount must be a number");
    const when = must(date(body.date), "Date is invalid") ?? new Date();
    const note = must(str(body.note, { max: 120 }), "Note is too long");

    const result = await createTransfer({ userId: user.id, fromId, toId, amount, date: when, note });
    return NextResponse.json({ success: true, ...result }, { headers: noCache });
  } catch (error: any) {
    if (error instanceof ValidationError || error instanceof LedgerError) return badRequest(error.message);
    console.error("Error recording transfer:", error);
    return NextResponse.json({ success: false, error: "Failed to record the transfer" }, { status: 500, headers: noCache });
  }
}
