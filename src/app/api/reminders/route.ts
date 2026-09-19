import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const rawReminders = await prisma.reminder.findMany({
      where: { userId: user.id },
      orderBy: { dueAt: "asc" },
    });

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 86400000);

    const reminders = rawReminders.map((r) => {
      let dynamicState: "OVERDUE" | "DUE_TODAY" | "UPCOMING" | "COMPLETED" = "UPCOMING";
      if (r.isCompleted) {
        dynamicState = "COMPLETED";
      } else if (r.dueAt < now) {
        dynamicState = "OVERDUE";
      } else if (r.dueAt >= todayStart && r.dueAt < todayEnd) {
        dynamicState = "DUE_TODAY";
      } else {
        dynamicState = "UPCOMING";
      }

      return {
        ...r,
        escalationState: dynamicState,
      };
    });

    return NextResponse.json({ success: true, reminders });
  } catch (error: any) {
    console.error("Error fetching reminders:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch reminders" },
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
    const { title, description, dueAt, recurrence } = body;

    if (!title || !dueAt) {
      return NextResponse.json(
        { success: false, error: "Title and due date are required" },
        { status: 400 }
      );
    }

    const entity = await prisma.entity.create({
      data: {
        userId: user.id,
        type: "REMINDER",
        title: title.trim(),
        content: description,
        status: "ACTIVE",
      },
    });

    const reminder = await prisma.reminder.create({
      data: {
        userId: user.id,
        entityId: entity.id,
        title: title.trim(),
        description,
        dueAt: new Date(dueAt),
        recurrence,
        escalationState: "UPCOMING",
      },
    });

    return NextResponse.json({ success: true, reminder });
  } catch (error: any) {
    console.error("Error creating reminder:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create reminder" },
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
    const { id, isCompleted } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: "Reminder ID required" }, { status: 400 });
    }

    const existing = await prisma.reminder.findFirst({
      where: { id, userId: user.id },
    });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Reminder not found" }, { status: 404 });
    }

    const reminder = await prisma.reminder.update({
      where: { id },
      data: {
        isCompleted: isCompleted ?? true,
        escalationState: isCompleted ? "COMPLETED" : "UPCOMING",
      },
    });

    return NextResponse.json({ success: true, reminder });
  } catch (error: any) {
    console.error("Error updating reminder:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update reminder" },
      { status: 500 }
    );
  }
}
