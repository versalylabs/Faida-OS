import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { RECURRENCES, ValidationError, badRequest, idOf, must, notFound, oneOf, ownedId, readBody, str } from "@/lib/validate";
import { date as parseDate } from "@/lib/validate";

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
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
        return NextResponse.json({ success: false, error: "month must look like 2026-09" }, { status: 400, headers: noCacheHeaders });
      }
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
    }, { headers: noCacheHeaders });
  } catch (error: any) {
    if (error instanceof ValidationError) return badRequest(error.message);
    console.error("Error fetching calendar data:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch calendar data" },
      { status: 500, headers: noCacheHeaders }
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

    const body = await readBody(req);
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

    const cleanTitle = must(str(title, { max: 300, required: true }), "Title is required (max 300 characters)");
    const cleanDescription = must(str(description, { max: 10000 }), "Description is too long");
    const cleanLocation = must(str(location, { max: 300 }), "Location is too long");
    const cleanRecurrence = must(oneOf(recurrence, RECURRENCES), "Invalid recurrence");
    if (itemType !== undefined && itemType !== "EVENT" && itemType !== "REMINDER") {
      throw new ValidationError("itemType must be EVENT or REMINDER");
    }
    const cleanDate = must(parseDate(date), "Date is invalid");
    const cleanStart = must(parseDate(startTime), "Start time is invalid");
    const cleanEnd = must(parseDate(endTime), "End time is invalid");

    // Linked records must belong to the signed-in user.
    const linkedTaskId = await ownedId("task", user.id, taskId);
    if (linkedTaskId === undefined) {
      return NextResponse.json({ success: false, error: "Linked task not found" }, { status: 404 });
    }
    const linkedNoteId = await ownedId("note", user.id, noteId);
    if (linkedNoteId === undefined) {
      return NextResponse.json({ success: false, error: "Linked note not found" }, { status: 404 });
    }

    if (itemType === "REMINDER") {
      const dueAtDate = cleanDate ?? new Date();

      const entity = await prisma.entity.create({
        data: {
          userId: user.id,
          type: "REMINDER",
          title: cleanTitle,
          content: cleanDescription,
          status: "ACTIVE",
        },
      });

      const reminder = await prisma.reminder.create({
        data: {
          userId: user.id,
          entityId: entity.id,
          title: cleanTitle,
          description: cleanDescription,
          dueAt: dueAtDate,
          recurrence: cleanRecurrence,
          taskId: linkedTaskId,
          noteId: linkedNoteId,
        },
        include: {
          task: { select: { id: true, title: true, status: true, priority: true } },
          note: { select: { id: true, title: true } },
        },
      });

      return NextResponse.json({ success: true, item: reminder, itemType: "REMINDER" });
    } else {
      // Default: EVENT
      const start = cleanStart ?? cleanDate ?? new Date();
      const end = cleanEnd ?? new Date(start.getTime() + 60 * 60 * 1000);
      if (end < start) throw new ValidationError("End time must be after start time");

      const event = await prisma.calendarEvent.create({
        data: {
          userId: user.id,
          title: cleanTitle,
          description: cleanDescription,
          startTime: start,
          endTime: end,
          location: cleanLocation,
          isAllDay: isAllDay === true,
          taskId: linkedTaskId,
          noteId: linkedNoteId,
        },
        include: {
          task: { select: { id: true, title: true, status: true, priority: true } },
          note: { select: { id: true, title: true } },
        },
      });

      return NextResponse.json({ success: true, item: event, itemType: "EVENT" });
    }
  } catch (error: any) {
    if (error instanceof ValidationError) return badRequest(error.message);
    console.error("Error creating calendar item:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create calendar item" },
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

    const body = await readBody(req);
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

    const itemId = must(idOf(id), "Item ID is required");
    const patchTitle = title !== undefined ? must(str(title, { max: 300, required: true }), "Title is required (max 300 characters)") : undefined;
    const patchDescription = description !== undefined ? must(str(description, { max: 10000 }), "Description is too long") : undefined;
    const patchLocation = location !== undefined ? must(str(location, { max: 300 }), "Location is too long") : undefined;
    const patchStart = startTime !== undefined ? must(parseDate(startTime, { required: true }), "Start time is invalid") : undefined;
    const patchEnd = endTime !== undefined ? must(parseDate(endTime, { required: true }), "End time is invalid") : undefined;
    const patchDue = dueAt !== undefined ? must(parseDate(dueAt, { required: true }), "Due date is invalid") : undefined;
    if (isCompleted !== undefined && typeof isCompleted !== "boolean") throw new ValidationError("isCompleted must be true or false");
    if (isAllDay !== undefined && typeof isAllDay !== "boolean") throw new ValidationError("isAllDay must be true or false");
    let patchTaskId: string | null | undefined;
    if (taskId !== undefined) {
      patchTaskId = await ownedId("task", user.id, taskId);
      if (patchTaskId === undefined) return NextResponse.json({ success: false, error: "Linked task not found" }, { status: 404 });
    }
    let patchNoteId: string | null | undefined;
    if (noteId !== undefined) {
      patchNoteId = await ownedId("note", user.id, noteId);
      if (patchNoteId === undefined) return NextResponse.json({ success: false, error: "Linked note not found" }, { status: 404 });
    }

    if (itemType === "REMINDER") {
      const existing = await prisma.reminder.findFirst({
        where: { id: itemId, userId: user.id },
      });
      if (!existing) {
        return NextResponse.json({ success: false, error: "Reminder not found" }, { status: 404 });
      }

      const updated = await prisma.reminder.update({
        where: { id: itemId },
        data: {
          ...(patchTitle !== undefined && { title: patchTitle }),
          ...(patchDescription !== undefined && { description: patchDescription }),
          ...(patchDue !== undefined && { dueAt: patchDue }),
          ...(isCompleted !== undefined && {
            isCompleted,
            escalationState: isCompleted ? "COMPLETED" : "UPCOMING",
          }),
          ...(patchTaskId !== undefined && { taskId: patchTaskId }),
          ...(patchNoteId !== undefined && { noteId: patchNoteId }),
        },
        include: {
          task: { select: { id: true, title: true, status: true, priority: true } },
          note: { select: { id: true, title: true } },
        },
      });

      return NextResponse.json({ success: true, item: updated, itemType: "REMINDER" });
    } else {
      const existing = await prisma.calendarEvent.findFirst({
        where: { id: itemId, userId: user.id },
      });
      if (!existing) {
        return NextResponse.json({ success: false, error: "Event not found" }, { status: 404 });
      }

      const updated = await prisma.calendarEvent.update({
        where: { id: itemId },
        data: {
          ...(patchTitle !== undefined && { title: patchTitle }),
          ...(patchDescription !== undefined && { description: patchDescription }),
          ...(patchStart !== undefined && { startTime: patchStart }),
          ...(patchEnd !== undefined && { endTime: patchEnd }),
          ...(patchLocation !== undefined && { location: patchLocation }),
          ...(isAllDay !== undefined && { isAllDay }),
          ...(patchTaskId !== undefined && { taskId: patchTaskId }),
          ...(patchNoteId !== undefined && { noteId: patchNoteId }),
        },
        include: {
          task: { select: { id: true, title: true, status: true, priority: true } },
          note: { select: { id: true, title: true } },
        },
      });

      return NextResponse.json({ success: true, item: updated, itemType: "EVENT" });
    }
  } catch (error: any) {
    if (error instanceof ValidationError) return badRequest(error.message);
    console.error("Error updating calendar item:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update calendar item" },
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
    if (error instanceof ValidationError) return badRequest(error.message);
    console.error("Error deleting calendar item:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete calendar item" },
      { status: 500 }
    );
  }
}
