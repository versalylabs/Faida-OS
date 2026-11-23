import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { deleteEntry } from "@/lib/ledger";
import { rememberMerchant } from "@/lib/mpesaImport";
import { ValidationError, badRequest, must, readBody, str } from "@/lib/validate";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store" };

/** GET: money logged automatically (M-Pesa auto-import) that has not been checked yet. */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  const [items, categories, businesses] = await Promise.all([
    prisma.financeTransaction.findMany({
      where: { userId: user.id, needsReview: true },
      orderBy: { date: "desc" },
      take: 100,
      select: { id: true, description: true, amount: true, type: true, category: true, date: true, businessId: true },
    }),
    prisma.financeCategory.findMany({ where: { userId: user.id }, select: { name: true, type: true }, orderBy: { name: "asc" } }),
    prisma.business.findMany({ where: { userId: user.id }, select: { id: true, name: true } }),
  ]);
  return NextResponse.json({ success: true, items, categories, businesses }, { headers: NO_STORE });
}

/**
 * POST
 *   { action: "confirm", ids? }                    mark as checked (all of them when no ids are given)
 *   { action: "file", id, category, businessId? }  set the category, remember it for this merchant, mark checked
 *   { action: "remove", id }                       not a real transaction: delete it (its balance change is undone)
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401, headers: NO_STORE });
    const body = await readBody(req);

    if (body.action === "confirm") {
      const ids = Array.isArray(body.ids) ? body.ids.filter((x: unknown) => typeof x === "string").slice(0, 200) : null;
      const r = await prisma.financeTransaction.updateMany({
        where: { userId: user.id, needsReview: true, ...(ids ? { id: { in: ids } } : {}) },
        data: { needsReview: false },
      });
      return NextResponse.json({ success: true, confirmed: r.count }, { headers: NO_STORE });
    }

    const id = typeof body.id === "string" ? body.id : "";
    const tx = id ? await prisma.financeTransaction.findFirst({ where: { id, userId: user.id } }) : null;
    if (!tx) return NextResponse.json({ success: false, error: "Transaction not found" }, { status: 404, headers: NO_STORE });

    if (body.action === "file") {
      const category = must(str(body.category, { max: 60, required: true }), "Choose a category");
      let businessId: string | null = null;
      if (typeof body.businessId === "string" && body.businessId) {
        const b = await prisma.business.findFirst({ where: { id: body.businessId, userId: user.id }, select: { id: true } });
        businessId = b?.id ?? null;
      }
      await prisma.financeTransaction.update({ where: { id }, data: { category, businessId, needsReview: false } });
      const remembered = await rememberMerchant(user.id, tx.description, category, businessId);
      return NextResponse.json({ success: true, remembered }, { headers: NO_STORE });
    }

    if (body.action === "remove") {
      await deleteEntry(user.id, id);
      // Its M-Pesa fee row goes with it.
      if (tx.externalRef) {
        const fee = await prisma.financeTransaction.findFirst({ where: { userId: user.id, externalRef: `${tx.externalRef}:fee` }, select: { id: true } });
        if (fee) await deleteEntry(user.id, fee.id);
      }
      return NextResponse.json({ success: true }, { headers: NO_STORE });
    }

    return badRequest("Unknown review action");
  } catch (error) {
    if (error instanceof ValidationError) return badRequest(error.message);
    console.error("Review action failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ success: false, error: "Could not save that" }, { status: 500, headers: NO_STORE });
  }
}
