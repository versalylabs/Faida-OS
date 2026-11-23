import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { buildWeeklyReview } from "@/lib/weeklyReview";

export const dynamic = "force-dynamic";

/** GET /api/review: this week's review (Monday to now) and what next week holds. */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  try {
    const review = await buildWeeklyReview(user.id);
    return NextResponse.json({ success: true, review }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Weekly review failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ success: false, error: "Could not build the review" }, { status: 500 });
  }
}
