import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { RECURRENCES, ValidationError, badRequest, date, idOf, must, oneOf, readBody, str } from "@/lib/validate";

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
    if (error instanceof ValidationError) return badRequest(error.message);
    console.error("Error fetching reminders:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch reminders" },
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

    const body = await readBody(req);
    const { title, description, dueAt, recurrence } = body;

    const cleanTitle = must(str(title, { max: 300, required: true }), "Title is required (max 300 characters)");
    const cleanDue = must(date(dueAt, { required: true }), "A valid due date is required");
    const cleanDescription = must(str(description, { max: 10000 }), "Description is too long");
    const cleanRecurrence = must(oneOf(recurrence, RECURRENCES), "Invalid recurrence");

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
        dueAt: cleanDue,
        recurrence: cleanRecurrence,
        escalationState: "UPCOMING",
      },
    });

    return NextResponse.json({ success: true, reminder });
  } catch (error: any) {
    if (error instanceof ValidationError) return badRequest(error.message);
    console.error("Error creating reminder:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create reminder" },
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

    const body = await readBody(req);
    const { id, isCompleted } = body;

    const reminderId = must(idOf(id), "Reminder ID required");
    if (isCompleted !== undefined && typeof isCompleted !== "boolean") {
      throw new ValidationError("isCompleted must be true or false");
    }

    const existing = await prisma.reminder.findFirst({
      where: { id: reminderId, userId: user.id },
    });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Reminder not found" }, { status: 404 });
    }

    const reminder = await prisma.reminder.update({
      where: { id: reminderId },
      data: {
        isCompleted: isCompleted ?? true,
        escalationState: isCompleted ? "COMPLETED" : "UPCOMING",
      },
    });

    return NextResponse.json({ success: true, reminder });
  } catch (error: any) {
    if (error instanceof ValidationError) return badRequest(error.message);
    console.error("Error updating reminder:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update reminder" },
      { status: 500 }
    );
  }
}
