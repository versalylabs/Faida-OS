import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { buildDailySchedule, replanRemainingSchedule, SchedulableTask, ScheduleSlot } from "@/lib/planner/scheduler";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const availableHours = parseFloat(searchParams.get("hours") || "4.5");
    const availableMinutes = Math.round(availableHours * 60);

    const rawTasks = await prisma.task.findMany({
      where: {
        userId: user.id,
        status: { not: "DONE" },
      },
      include: {
        project: true,
      },
      orderBy: [
        { priority: "desc" },
        { createdAt: "desc" },
      ],
    });

    const schedulableTasks: SchedulableTask[] = rawTasks.map((t) => ({
      id: t.id,
      title: t.title,
      priority: (t.priority as any) || "MEDIUM",
      estimatedMinutes: t.estimatedMinutes || 30,
      actualMinutes: t.actualMinutes || 0,
      status: (t.status as any) || "TODO",
      projectName: t.project?.name,
    }));

    const plan = buildDailySchedule(schedulableTasks, {
      availableMinutes,
      startHour: 9,
      startMinute: 0,
      bufferMinutes: 15,
    });

    return NextResponse.json({ success: true, plan });
  } catch (error: any) {
    console.error("Error building daily plan:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to generate plan" },
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
    const { availableMinutes = 270, startHour = 9, startMinute = 0 } = body;

    const rawTasks = await prisma.task.findMany({
      where: {
        userId: user.id,
        status: { not: "DONE" },
      },
      include: {
        project: true,
      },
      orderBy: [
        { priority: "desc" },
        { createdAt: "desc" },
      ],
    });

    const schedulableTasks: SchedulableTask[] = rawTasks.map((t) => ({
      id: t.id,
      title: t.title,
      priority: (t.priority as any) || "MEDIUM",
      estimatedMinutes: t.estimatedMinutes || 30,
      actualMinutes: t.actualMinutes || 0,
      status: (t.status as any) || "TODO",
      projectName: t.project?.name,
    }));

    const plan = buildDailySchedule(schedulableTasks, {
      availableMinutes,
      startHour,
      startMinute,
      bufferMinutes: 15,
    });

    return NextResponse.json({ success: true, plan });
  } catch (error: any) {
    console.error("Error generating custom daily plan:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to generate plan" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { currentSlots, completedSlotId, actualMinutesSpent } = body;

    if (!Array.isArray(currentSlots)) {
      return NextResponse.json(
        { success: false, error: "currentSlots array is required" },
        { status: 400 }
      );
    }

    const replannedSlots = replanRemainingSchedule(
      currentSlots,
      completedSlotId,
      actualMinutesSpent
    );

    // If a task was completed, update its status in DB (only if belongs to user)
    if (completedSlotId) {
      const slot = currentSlots.find((s: ScheduleSlot) => s.id === completedSlotId);
      if (slot && slot.taskId && slot.taskId !== "break") {
        await prisma.task.updateMany({
          where: { id: slot.taskId, userId: user.id },
          data: {
            status: "DONE",
            actualMinutes: actualMinutesSpent || slot.durationMinutes,
          },
        }).catch(() => {});
      }
    }

    return NextResponse.json({ success: true, slots: replannedSlots });
  } catch (error: any) {
    console.error("Error replanning schedule:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to replan schedule" },
      { status: 500 }
    );
  }
}
