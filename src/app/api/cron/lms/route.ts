import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/db";
import { syncUser } from "@/lib/lms/sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorised(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // not configured: the job stays switched off
  const given = req.headers.get("authorization") || "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Daily background sync for everyone with a connected LMS (Vercel Cron sends the secret). */
export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ success: false, error: "Background sync is not configured" }, { status: 503 });
  }
  if (!authorised(req)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const deadline = Date.now() + 45_000;
  const connections = await prisma.lmsConnection.findMany({
    where: { status: { not: "INVALID" } },
    orderBy: { lastSyncAt: "asc" },
    take: 25,
    select: { userId: true },
  });

  let synced = 0;
  let skipped = 0;
  let failed = 0;
  for (const c of connections) {
    if (Date.now() > deadline) break;
    try {
      const result = await syncUser(c.userId, { auto: true });
      if (result.skipped) skipped++;
      else synced++;
    } catch {
      failed++;
    }
  }
  return NextResponse.json({ success: true, synced, skipped, failed });
}
