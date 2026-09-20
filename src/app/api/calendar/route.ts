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

// GET /api/calendar - Fetch events and reminders with connected tasks and notes
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401, headers: noCacheHeaders });
    }

    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month"); // e.g. "2026-09"

    let eventDateFilter: any = {};
    let reminderDateFilter: any = {};

    if (month) {
      const [yearStr, monthStr] = month.split("-");
      const year = parseInt(yearStr, 10);
      const m = parseInt(monthStr, 10) - 1;
      const startOfMonth = new Date(year, m, 1);
      const endOfMonth = new Date(year, m + 1, 0, 23, 59, 59);

      eventDateFilter = {
        startTime: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      };
      reminderDateFilter = {
        dueAt: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      };
    }

    const [events, reminders, tasks, notes] = await Promise.all([
      prisma.calendarEvent.findMany({
        where: {
          userId: user.id,
          ...eventDateFilter,
        },
        include: {
          task: {
            select: { id: true, title: true, status: true, priority: true },
          },
          note: {
            select: { id: true, title: true },
          },
        },
        orderBy: { startTime: "asc" },
      }),
      prisma.reminder.findMany({
        where: {
          userId: user.id,
          ...reminderDateFilter,
        },
        include: {
          task: {
            select: { id: true, title: true, status: true, priority: true },
          },
          note: {
            select: { id: true, title: true },
          },
        },
        orderBy: { dueAt: "asc" },
      }),
      prisma.task.findMany({
        where: { userId: user.id, status: { not: "DONE" } },
        select: { id: true, title: true, status: true, priority: true },
        take: 50,
      }),
      prisma.note.findMany({
        where: { userId: user.id },
        select: { id: true, title: true },
        take: 50,
      }),
    ]);

    return NextResponse.json({
      success: true,
      events,
      reminders,
      availableTasks: tasks,
      availableNotes: notes,
    });
  } catch (error: any) {
    console.error("Error fetching calendar data:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch calendar data" },
      { status: 500 }
    );
  }
}

// POST /api/calendar - Create a calendar event or reminder
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      itemType, // "EVENT" or "REMINDER"
      title,
      description,
      date,
      startTime,
      endTime,
      location,
      isAllDay,
      recurrence,
      taskId,
      noteId,
    } = body;

    if (!title || !title.trim()) {
      return NextResponse.json({ success: false, error: "Title is required" }, { status: 400 });
    }

    // Verify task belongs to user if provided
    if (taskId) {
      const task = await prisma.task.findFirst({
        where: { id: taskId, userId: user.id },
      });
      if (!task) {
        return NextResponse.json({ success: false, error: "Linked task not found" }, { status: 404 });
      }
    }

    // Verify note belongs to user if provided
    if (noteId) {
      const note = await prisma.note.findFirst({
        where: { id: noteId, userId: user.id },
      });
      if (!note) {
        return NextResponse.json({ success: false, error: "Linked note not found" }, { status: 404 });
      }
    }

    if (itemType === "REMINDER") {
      const dueAtDate = new Date(date || Date.now());

      const entity = await prisma.entity.create({
        data: {
          userId: user.id,
          type: "REMINDER",
          title: title.trim(),
          content: description || null,
          status: "ACTIVE",
        },
      });

      const reminder = await prisma.reminder.create({
        data: {
          userId: user.id,
          entityId: entity.id,
          title: title.trim(),
          description: description || null,
          dueAt: dueAtDate,
          recurrence: recurrence || null,
          taskId: taskId || null,
          noteId: noteId || null,
        },
        include: {
          task: { select: { id: true, title: true, status: true, priority: true } },
          note: { select: { id: true, title: true } },
        },
      });

      return NextResponse.json({ success: true, item: reminder, itemType: "REMINDER" });
    } else {
      // Default: EVENT
      const start = new Date(startTime || date || Date.now());
      const end = new Date(endTime || new Date(start.getTime() + 60 * 60 * 1000));

      const event = await prisma.calendarEvent.create({
        data: {
          userId: user.id,
          title: title.trim(),
          description: description || null,
          startTime: start,
          endTime: end,
          location: location || null,
          isAllDay: isAllDay || false,
          taskId: taskId || null,
          noteId: noteId || null,
        },
        include: {
          task: { select: { id: true, title: true, status: true, priority: true } },
          note: { select: { id: true, title: true } },
        },
      });

      return NextResponse.json({ success: true, item: event, itemType: "EVENT" });
    }
  } catch (error: any) {
    console.error("Error creating calendar item:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create calendar item" },
      { status: 500 }
    );
  }
}

// PATCH /api/calendar - Update event or reminder
export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      id,
      itemType, // "EVENT" or "REMINDER"
      title,
      description,
      startTime,
      endTime,
      dueAt,
      isCompleted,
      location,
      isAllDay,
      taskId,
      noteId,
    } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: "Item ID is required" }, { status: 400 });
    }

    if (itemType === "REMINDER") {
      const existing = await prisma.reminder.findFirst({
        where: { id, userId: user.id },
      });
      if (!existing) {
        return NextResponse.json({ success: false, error: "Reminder not found" }, { status: 404 });
      }

      const updated = await prisma.reminder.update({
        where: { id },
        data: {
          ...(title !== undefined && { title: title.trim() }),
          ...(description !== undefined && { description }),
          ...(dueAt !== undefined && { dueAt: new Date(dueAt) }),
          ...(isCompleted !== undefined && {
            isCompleted,
            escalationState: isCompleted ? "COMPLETED" : "UPCOMING",
          }),
          ...(taskId !== undefined && { taskId: taskId || null }),
          ...(noteId !== undefined && { noteId: noteId || null }),
        },
        include: {
          task: { select: { id: true, title: true, status: true, priority: true } },
          note: { select: { id: true, title: true } },
        },
      });

      return NextResponse.json({ success: true, item: updated, itemType: "REMINDER" });
    } else {
      const existing = await prisma.calendarEvent.findFirst({
        where: { id, userId: user.id },
      });
      if (!existing) {
        return NextResponse.json({ success: false, error: "Event not found" }, { status: 404 });
      }

      const updated = await prisma.calendarEvent.update({
        where: { id },
        data: {
          ...(title !== undefined && { title: title.trim() }),
          ...(description !== undefined && { description }),
          ...(startTime !== undefined && { startTime: new Date(startTime) }),
          ...(endTime !== undefined && { endTime: new Date(endTime) }),
          ...(location !== undefined && { location }),
          ...(isAllDay !== undefined && { isAllDay }),
          ...(taskId !== undefined && { taskId: taskId || null }),
          ...(noteId !== undefined && { noteId: noteId || null }),
        },
        include: {
          task: { select: { id: true, title: true, status: true, priority: true } },
          note: { select: { id: true, title: true } },
        },
      });

      return NextResponse.json({ success: true, item: updated, itemType: "EVENT" });
    }
  } catch (error: any) {
    console.error("Error updating calendar item:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update calendar item" },
      { status: 500 }
    );
  }
}

// DELETE /api/calendar - Delete event or reminder
export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const itemType = searchParams.get("itemType"); // "EVENT" or "REMINDER"

    if (!id) {
      return NextResponse.json({ success: false, error: "ID is required" }, { status: 400 });
    }

    if (itemType === "REMINDER") {
      const existing = await prisma.reminder.findFirst({
        where: { id, userId: user.id },
      });
      if (!existing) {
        return NextResponse.json({ success: false, error: "Reminder not found" }, { status: 404 });
      }
      await prisma.reminder.delete({ where: { id } });
      if (existing.entityId) {
        await prisma.entity.delete({ where: { id: existing.entityId } }).catch(() => {});
      }
    } else {
      const existing = await prisma.calendarEvent.findFirst({
        where: { id, userId: user.id },
      });
      if (!existing) {
        return NextResponse.json({ success: false, error: "Event not found" }, { status: 404 });
      }
      await prisma.calendarEvent.delete({ where: { id } });
    }

    return NextResponse.json({ success: true, message: "Deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting calendar item:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to delete calendar item" },
      { status: 500 }
    );
  }
}
