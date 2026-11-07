import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { runNotifications } from "@/lib/notify";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorised(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(req.headers.get("authorization") || "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * Sends the reminders that are due. Call it every 10-15 minutes from a scheduler (it is harmless to call
 * more often: nothing is ever sent twice). Needs the header  Authorization: Bearer <CRON_SECRET>.
 */
export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ success: false, error: "Reminders are not configured" }, { status: 503 });
  }
  if (!authorised(req)) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  try {
    const summary = await runNotifications();
    return NextResponse.json({ success: true, ...summary });
  } catch (error) {
    console.error("Reminder run failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ success: false, error: "Reminder run failed" }, { status: 500 });
  }
}
