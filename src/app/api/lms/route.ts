import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getLmsOverview } from "@/lib/lms/overview";
import { ValidationError, badRequest, idOf, must, oneOf, readBody, serverError } from "@/lib/validate";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };

/** Connection state, unit progress, things that need attention and the activity feed. */
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401, headers: noStore });
    const overview = await getLmsOverview(user.id);
    return NextResponse.json({ success: true, ...overview }, { headers: noStore });
  } catch (error) {
    return serverError("Failed to load LMS data", error, noStore);
  }
}

/**
 * Small actions on the feed:
 *   { action: "markAllRead" }
 *   { action: "dismiss", itemId, dismissed: true|false }   hide a task that does not need doing
 */
export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401, headers: noStore });

    const body = await readBody(req);
    const action = must(oneOf(body.action, ["markAllRead", "dismiss"] as const, { required: true }), "Unknown action");

    if (action === "markAllRead") {
      await prisma.lmsActivity.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
    } else {
      const itemId = must(idOf(body.itemId), "Item is required");
      await prisma.lmsItem.updateMany({
        where: { id: itemId, userId: user.id },
        data: { dismissed: body.dismissed !== false },
      });
    }
    return NextResponse.json({ success: true }, { headers: noStore });
  } catch (error) {
    if (error instanceof ValidationError) return badRequest(error.message, noStore);
    return serverError("Failed to update LMS data", error, noStore);
  }
}

/** Disconnects the LMS. What was already imported stays; the stored access key is erased. */
export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401, headers: noStore });
    await prisma.lmsConnection.deleteMany({ where: { userId: user.id } });
    return NextResponse.json({ success: true }, { headers: noStore });
  } catch (error) {
    return serverError("Failed to disconnect the LMS", error, noStore);
  }
}
