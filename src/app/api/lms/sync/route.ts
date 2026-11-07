import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { MoodleTokenError } from "@/lib/lms/moodle";
import { syncUser } from "@/lib/lms/sync";
import { serverError } from "@/lib/validate";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const noStore = { "Cache-Control": "no-store" };

/**
 * Syncs the LMS now.  { auto: true } is the quiet check the app makes when it opens: it does
 * nothing unless the last sync is more than 8 hours old.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401, headers: noStore });

    const body = await req.json().catch(() => ({}));
    const auto = body && typeof body === "object" && body.auto === true;

    try {
      const summary = await syncUser(user.id, { auto, force: !auto });
      return NextResponse.json({ success: true, summary }, { headers: noStore });
    } catch (err) {
      if (err instanceof MoodleTokenError) {
        return NextResponse.json(
          { success: false, error: "Your LMS rejected the access key. Create a new one and reconnect.", needsReconnect: true },
          { status: 400, headers: noStore }
        );
      }
      return NextResponse.json(
        { success: false, error: "The LMS could not be reached right now. Your saved data is unchanged." },
        { status: 502, headers: noStore }
      );
    }
  } catch (error) {
    return serverError("Failed to sync the LMS", error, noStore);
  }
}
