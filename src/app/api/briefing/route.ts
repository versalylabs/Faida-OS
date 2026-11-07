import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { buildBriefing } from "@/lib/briefing";
import { serverError } from "@/lib/validate";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401, headers: noStore });
    const briefing = await buildBriefing(user.id);
    return NextResponse.json({ success: true, briefing }, { headers: noStore });
  } catch (error) {
    return serverError("Failed to build the briefing", error, noStore);
  }
}
