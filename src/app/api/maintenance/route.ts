import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ValidationError, badRequest, date, idOf, must, num, readBody, str } from "@/lib/validate";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const noCacheHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401, headers: noCacheHeaders }
      );
    }

    const rawItems = await prisma.maintenanceItem.findMany({
      where: { userId: user.id },
      orderBy: { nextDueAt: "asc" },
    });

    const now = new Date();
    const threeDaysFromNow = new Date(now.getTime() + 3 * 86400000);

    const items = rawItems.map((item) => {
      let status: "OVERDUE" | "DUE_SOON" | "ON_TRACK" = "ON_TRACK";
      if (item.nextDueAt < now) {
        status = "OVERDUE";
      } else if (item.nextDueAt <= threeDaysFromNow) {
        status = "DUE_SOON";
      }

      return {
        ...item,
        status,
      };
    });

    return NextResponse.json({ success: true, items }, { headers: noCacheHeaders });
  } catch (error: any) {
    if (error instanceof ValidationError) return badRequest(error.message);
    console.error("Error fetching maintenance items:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch maintenance items" },
      { status: 500, headers: noCacheHeaders }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401, headers: noCacheHeaders }
      );
    }

    const body = await readBody(req);
    const { title, area, frequencyDays, notes, nextDueAt } = body;

    const cleanTitle = must(str(title, { max: 200, required: true }), "Title is required (max 200 characters)");
    const cleanArea = must(str(area, { max: 40, required: true }), "Area (COMPUTER, HOME, DEV, PERSONAL_ADMIN) is required");
    const freq = must(num(frequencyDays ?? 30, { min: 1, max: 3650, int: true, required: true }), "Frequency cadence must be a whole number of days between 1 and 3650");
    const cleanNotes = must(str(notes, { max: 5000 }), "Notes are too long");
    const nextDue = must(date(nextDueAt), "Next due date is invalid") ?? new Date(Date.now() + freq * 86400000);

    const item = await prisma.maintenanceItem.create({
      data: {
        userId: user.id,
        title: cleanTitle,
        area: cleanArea,
        frequencyDays: freq,
        nextDueAt: nextDue,
        notes: cleanNotes,
      },
    });

    return NextResponse.json({ success: true, item }, { headers: noCacheHeaders });
  } catch (error: any) {
    if (error instanceof ValidationError) return badRequest(error.message);
    console.error("Error creating maintenance item:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create maintenance item" },
      { status: 500, headers: noCacheHeaders }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401, headers: noCacheHeaders }
      );
    }

    const body = await readBody(req);
    const { id, action, title, area, frequencyDays, notes, nextDueAt } = body;

    const itemId = must(idOf(id), "Item ID is required");

    const existing = await prisma.maintenanceItem.findFirst({
      where: { id: itemId, userId: user.id },
    });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Maintenance item not found" },
        { status: 404, headers: noCacheHeaders }
      );
    }

    // 1. Completion / Reset Action (explicitly requested or default when no edit fields passed)
    const isCompleteAction =
      action === "COMPLETE" ||
      (action === undefined &&
        title === undefined &&
        area === undefined &&
        frequencyDays === undefined &&
        notes === undefined &&
        nextDueAt === undefined);

    if (isCompleteAction) {
      const now = new Date();
      const nextDue = new Date(now.getTime() + existing.frequencyDays * 86400000);

      const updated = await prisma.maintenanceItem.update({
        where: { id: itemId },
        data: {
          lastCompletedAt: now,
          nextDueAt: nextDue,
        },
      });

      await prisma.activityLog.create({
        data: {
          action: "MAINTENANCE_DONE",
          details: `Completed recurring maintenance: ${updated.title}`,
        },
      });

      return NextResponse.json({ success: true, item: updated }, { headers: noCacheHeaders });
    }

    // 2. Edit Action
    const updateData: any = {};
    if (title !== undefined) updateData.title = must(str(title, { max: 200, required: true }), "Title cannot be empty (max 200 characters)");
    if (area !== undefined) updateData.area = must(str(area, { max: 40, required: true }), "Area is invalid");
    if (frequencyDays !== undefined) {
      updateData.frequencyDays = must(num(frequencyDays, { min: 1, max: 3650, int: true, required: true }), "Cadence must be a whole number of days between 1 and 3650");
    }
    if (notes !== undefined) updateData.notes = must(str(notes, { max: 5000 }), "Notes are too long");
    if (nextDueAt !== undefined) {
      updateData.nextDueAt = must(date(nextDueAt), "Next due date is invalid") ?? existing.nextDueAt;
    }

    const updated = await prisma.maintenanceItem.update({
      where: { id: itemId },
      data: updateData,
    });

    return NextResponse.json({ success: true, item: updated }, { headers: noCacheHeaders });
  } catch (error: any) {
    if (error instanceof ValidationError) return badRequest(error.message);
    console.error("Error updating maintenance item:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update maintenance item" },
      { status: 500, headers: noCacheHeaders }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401, headers: noCacheHeaders }
      );
    }

    const { searchParams } = new URL(req.url);
    let id = searchParams.get("id");

    if (!id) {
      try {
        const body = await readBody(req);
        id = body?.id;
      } catch {}
    }

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Item ID is required" },
        { status: 400, headers: noCacheHeaders }
      );
    }

    const existing = await prisma.maintenanceItem.findFirst({
      where: { id, userId: user.id },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Maintenance item not found" },
        { status: 404, headers: noCacheHeaders }
      );
    }

    await prisma.maintenanceItem.delete({
      where: { id },
    });

    return NextResponse.json(
      { success: true, message: "Maintenance task deleted successfully" },
      { headers: noCacheHeaders }
    );
  } catch (error: any) {
    if (error instanceof ValidationError) return badRequest(error.message);
    console.error("Error deleting maintenance item:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete maintenance item" },
      { status: 500, headers: noCacheHeaders }
    );
  }
}
