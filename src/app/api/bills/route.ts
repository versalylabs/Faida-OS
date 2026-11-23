import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { BillError, FREQUENCIES, dueAt, payBill } from "@/lib/bills";
import { ValidationError, badRequest, must, num, oneOf, ownedId, readBody, str } from "@/lib/validate";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store" };
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

/** GET: your bills (active first, soonest due first), plus the accounts and businesses to pick from. */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  const [bills, accounts, businesses] = await Promise.all([
    prisma.bill.findMany({ where: { userId: user.id }, orderBy: [{ active: "desc" }, { nextDueAt: "asc" }] }),
    prisma.financeAccount.findMany({ where: { userId: user.id }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.business.findMany({ where: { userId: user.id }, select: { id: true, name: true } }),
  ]);
  return NextResponse.json({ success: true, bills, accounts, businesses }, { headers: NO_STORE });
}

async function readFields(userId: string, body: Record<string, any>, partial: boolean) {
  const data: Record<string, unknown> = {};
  const has = (k: string) => body[k] !== undefined;

  if (!partial || has("name")) data.name = must(str(body.name, { max: 80, required: true }), "Give the bill a name (max 80 characters)");
  if (!partial || has("amount")) data.amount = must(num(body.amount, { min: 0.01, max: 10_000_000 }), "Amount must be more than 0, or left empty if it varies");
  if (!partial || has("category")) data.category = must(str(body.category, { max: 60 }), "Category is too long") ?? "Bills";
  if (!partial || has("paybill")) data.paybill = must(str(body.paybill, { max: 20 }), "Paybill or till number is too long");
  if (!partial || has("accountNo")) data.accountNo = must(str(body.accountNo, { max: 40 }), "Account number is too long");
  if (!partial || has("frequency")) data.frequency = must(oneOf(body.frequency, FREQUENCIES), "Choose how often it is due") ?? "MONTHLY";
  if (!partial || has("remindDaysBefore")) {
    data.remindDaysBefore = must(num(body.remindDaysBefore, { min: 0, max: 14, int: true }), "Remind 0 to 14 days before") ?? 2;
  }
  if (!partial || has("notes")) data.notes = must(str(body.notes, { max: 1000 }), "Notes are too long");
  if (!partial || has("nextDue")) {
    const key = typeof body.nextDue === "string" && DATE_KEY.test(body.nextDue) ? body.nextDue : null;
    if (!key) throw new ValidationError("Choose the next due date");
    data.nextDueAt = dueAt(key);
    data.anchorDay = Number(key.slice(8, 10));
  }
  if (!partial || has("accountId")) {
    const id = await ownedId("financeAccount", userId, body.accountId);
    if (id === undefined) throw new ValidationError("Account not found");
    data.accountId = id;
  }
  if (!partial || has("businessId")) {
    const id = await ownedId("business", userId, body.businessId);
    if (id === undefined) throw new ValidationError("Business not found");
    data.businessId = id;
  }
  if (has("active")) data.active = Boolean(body.active);
  return data;
}

/**
 * POST
 *   { ...fields }                                   add a bill
 *   { action: "paid", id, amount?, accountId? }      mark paid: logs the expense and lines up the next due date
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401, headers: NO_STORE });
    const body = await readBody(req);

    if (body.action === "paid") {
      const amount = must(num(body.amount, { min: 0.01, max: 10_000_000 }), "Amount must be more than 0");
      const accountId = body.accountId ? await ownedId("financeAccount", user.id, body.accountId) : null;
      if (accountId === undefined) return badRequest("Account not found", NO_STORE);
      const result = await payBill(user.id, String(body.id || ""), { amount, accountId });
      return NextResponse.json({ success: true, ...result }, { headers: NO_STORE });
    }

    const data = await readFields(user.id, body, false);
    const bill = await prisma.bill.create({ data: { ...(data as any), userId: user.id } });
    return NextResponse.json({ success: true, bill }, { headers: NO_STORE });
  } catch (error) {
    if (error instanceof ValidationError || error instanceof BillError) return badRequest(error.message, NO_STORE);
    console.error("Bill request failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ success: false, error: "Could not save the bill" }, { status: 500, headers: NO_STORE });
  }
}

/** PATCH { id, ...fields }: change a bill. */
export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401, headers: NO_STORE });
    const body = await readBody(req);
    const existing = await prisma.bill.findFirst({ where: { id: String(body.id || ""), userId: user.id }, select: { id: true } });
    if (!existing) return NextResponse.json({ success: false, error: "Bill not found" }, { status: 404, headers: NO_STORE });
    const data = await readFields(user.id, body, true);
    const bill = await prisma.bill.update({ where: { id: existing.id }, data: data as any });
    return NextResponse.json({ success: true, bill }, { headers: NO_STORE });
  } catch (error) {
    if (error instanceof ValidationError) return badRequest(error.message, NO_STORE);
    console.error("Bill update failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ success: false, error: "Could not save the bill" }, { status: 500, headers: NO_STORE });
  }
}

/** DELETE ?id=: remove a bill (payments already logged stay in Finance). */
export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  const id = new URL(req.url).searchParams.get("id") || "";
  const r = await prisma.bill.deleteMany({ where: { id, userId: user.id } });
  if (r.count === 0) return NextResponse.json({ success: false, error: "Bill not found" }, { status: 404, headers: NO_STORE });
  return NextResponse.json({ success: true }, { headers: NO_STORE });
}
