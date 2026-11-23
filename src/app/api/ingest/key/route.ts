import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { hashKey, newKey } from "@/lib/mpesaImport";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store" };

/** GET: is M-Pesa auto-import set up?  POST: create a new key (replaces the old one; shown once).  DELETE: turn it off. */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  const [key, pending] = await Promise.all([
    prisma.ingestKey.findFirst({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
    prisma.financeTransaction.count({ where: { userId: user.id, needsReview: true } }),
  ]);
  return NextResponse.json(
    { success: true, active: Boolean(key), createdAt: key?.createdAt ?? null, lastUsedAt: key?.lastUsedAt ?? null, pending },
    { headers: NO_STORE }
  );
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  const key = newKey();
  await prisma.$transaction([
    prisma.ingestKey.deleteMany({ where: { userId: user.id } }),
    prisma.ingestKey.create({ data: { userId: user.id, keyHash: hashKey(key) } }),
  ]);
  return NextResponse.json({ success: true, key }, { headers: NO_STORE });
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  await prisma.ingestKey.deleteMany({ where: { userId: user.id } });
  return NextResponse.json({ success: true }, { headers: NO_STORE });
}
