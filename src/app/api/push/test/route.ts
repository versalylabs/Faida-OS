import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isPushConfigured, sendTestNotification } from "@/lib/notify";
import { serverError } from "@/lib/validate";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const noStore = { "Cache-Control": "no-store" };

/** Sends a test notification to every device registered for the signed-in student. */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401, headers: noStore });
    if (!isPushConfigured()) {
      return NextResponse.json({ success: false, error: "Notifications are not set up on the server yet." }, { status: 503, headers: noStore });
    }
    const result = await sendTestNotification(user.id);
    if (result.devices === 0) {
      return NextResponse.json({ success: false, error: "No device is registered yet. Turn notifications on first." }, { status: 400, headers: noStore });
    }
    return NextResponse.json(
      {
        success: result.sent > 0,
        ...result,
        error: result.sent === 0 ? "The message could not be delivered. Try turning notifications off and on again." : undefined,
      },
      { headers: noStore }
    );
  } catch (error) {
    return serverError("Failed to send the test notification", error, noStore);
  }
}
