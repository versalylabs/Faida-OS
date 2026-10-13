import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

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
    console.error("Error fetching maintenance items:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch maintenance items" },
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

    const body = await req.json();
    const { title, area, frequencyDays, notes, nextDueAt } = body;

    if (!title || !title.trim() || !area) {
      return NextResponse.json(
        { success: false, error: "Title and area (COMPUTER, HOME, DEV, PERSONAL_ADMIN) are required" },
        { status: 400, headers: noCacheHeaders }
      );
    }

    const freq = parseInt(frequencyDays || "30", 10);
    if (isNaN(freq) || freq < 1) {
      return NextResponse.json(
        { success: false, error: "Frequency cadence must be at least 1 day" },
        { status: 400, headers: noCacheHeaders }
      );
    }

    const nextDue = nextDueAt
      ? new Date(nextDueAt)
      : new Date(Date.now() + freq * 86400000);

    const item = await prisma.maintenanceItem.create({
      data: {
        userId: user.id,
        title: title.trim(),
        area: area.trim(),
        frequencyDays: freq,
        nextDueAt: nextDue,
        notes: notes ? notes.trim() : null,
      },
    });

    return NextResponse.json({ success: true, item }, { headers: noCacheHeaders });
  } catch (error: any) {
    console.error("Error creating maintenance item:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create maintenance item" },
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

    const body = await req.json();
    const { id, action, title, area, frequencyDays, notes, nextDueAt } = body;

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
        where: { id },
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

    if (title !== undefined) {
      if (!title.trim()) {
        return NextResponse.json(
          { success: false, error: "Title cannot be empty" },
          { status: 400, headers: noCacheHeaders }
        );
      }
      updateData.title = title.trim();
    }

    if (area !== undefined) {
      updateData.area = area.trim();
    }

    if (frequencyDays !== undefined) {
      const freq = parseInt(frequencyDays, 10);
      if (isNaN(freq) || freq < 1) {
        return NextResponse.json(
          { success: false, error: "Cadence must be at least 1 day" },
          { status: 400, headers: noCacheHeaders }
        );
      }
      updateData.frequencyDays = freq;
    }

    if (notes !== undefined) {
      updateData.notes = notes ? notes.trim() : null;
    }

    if (nextDueAt !== undefined) {
      updateData.nextDueAt = nextDueAt ? new Date(nextDueAt) : existing.nextDueAt;
    }

    const updated = await prisma.maintenanceItem.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, item: updated }, { headers: noCacheHeaders });
  } catch (error: any) {
    console.error("Error updating maintenance item:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update maintenance item" },
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
        const body = await req.json();
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
    console.error("Error deleting maintenance item:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to delete maintenance item" },
      { status: 500, headers: noCacheHeaders }
    );
  }
}
