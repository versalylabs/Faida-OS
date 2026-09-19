import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
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

    return NextResponse.json({ success: true, items });
  } catch (error: any) {
    console.error("Error fetching maintenance items:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch maintenance items" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { title, area, frequencyDays, notes } = body;

    if (!title || !area) {
      return NextResponse.json(
        { success: false, error: "Title and area (COMPUTER, HOME, DEV, PERSONAL_ADMIN) are required" },
        { status: 400 }
      );
    }

    const freq = parseInt(frequencyDays || "30", 10);
    const nextDue = new Date(Date.now() + freq * 86400000);

    const item = await prisma.maintenanceItem.create({
      data: {
        userId: user.id,
        title: title.trim(),
        area,
        frequencyDays: freq,
        nextDueAt: nextDue,
        notes,
      },
    });

    return NextResponse.json({ success: true, item });
  } catch (error: any) {
    console.error("Error creating maintenance item:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create maintenance item" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: "Item ID is required" }, { status: 400 });
    }

    const existing = await prisma.maintenanceItem.findFirst({
      where: { id, userId: user.id },
    });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Item not found" }, { status: 404 });
    }

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

    return NextResponse.json({ success: true, item: updated });
  } catch (error: any) {
    console.error("Error updating maintenance item:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to complete maintenance" },
      { status: 500 }
    );
  }
}
