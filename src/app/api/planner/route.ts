import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { byPriorityThenNewest } from "@/lib/priority";
import { calculateEnergyCost } from "@/lib/effort";
import { buildDayPlan, type BusyBlock, type PlanTask } from "@/lib/planner/scheduler";
import { zonedNow } from "@/lib/tz";
import { ValidationError, badRequest, safeFloat, safeInt } from "@/lib/validate";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const noCacheHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

function clockToMinutes(value: string | null | undefined): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(value || "");
  if (!m) return null;
  const mins = Number(m[1]) * 60 + Number(m[2]);
  return mins >= 0 && mins <= 24 * 60 ? mins : null;
}

/**
 * GET /api/planner?hours=4.5
 * The plan is rebuilt from the live data on every request (it is cheap), so it is always accurate: it
 * starts from the current time in the user's time zone and works around today's events and classes.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401, headers: noCacheHeaders });
    }

    const { searchParams } = new URL(req.url);
    const budgetMinutes = Math.round(safeFloat(searchParams.get("hours") || "4.5", 4.5, 0.25, 12) * 60);
    const startParam = clockToMinutes(searchParams.get("start"));
    const endHour = safeInt(searchParams.get("endHour"), 20, 12, 23);

    const local = zonedNow();
    const nowMin = local.hour * 60 + local.minute;
    const isoDow = local.dayOfWeek === 0 ? 7 : local.dayOfWeek;

    const [dbTasks, events, classes] = await Promise.all([
      prisma.task.findMany({
        where: { userId: user.id, status: { notIn: ["DONE", "ARCHIVED"] } },
        include: { project: true, course: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.calendarEvent.findMany({
        where: { userId: user.id, startTime: { lt: local.endOfDay }, endTime: { gt: local.startOfDay } },
        orderBy: { startTime: "asc" },
      }),
      prisma.academicClass.findMany({
        where: { userId: user.id, dayOfWeek: isoDow },
        include: { course: { select: { code: true, name: true } } },
      }),
    ]);
    dbTasks.sort(byPriorityThenNewest);

    const tasks: PlanTask[] = dbTasks.map((t) => ({
      id: t.id,
      title: t.title,
      priority: t.priority,
      estimatedMinutes: t.estimatedMinutes || 30,
      energyCost: calculateEnergyCost(t.title, t.estimatedMinutes || 30),
      dueDate: t.dueDate ? t.dueDate.toISOString() : null,
      projectName: t.course ? t.course.code : t.project?.name,
    }));

    const toLocalMin = (d: Date) => Math.round((d.getTime() - local.startOfDay.getTime()) / 60000);
    const busy: BusyBlock[] = [];
    const allDay: string[] = [];
    for (const e of events) {
      if (e.isAllDay) {
        allDay.push(e.title);
        continue;
      }
      busy.push({
        title: e.title,
        startMin: toLocalMin(e.startTime),
        endMin: Math.min(toLocalMin(e.endTime), 24 * 60),
        kind: "EVENT",
        location: e.location,
      });
    }
    for (const c of classes) {
      const start = clockToMinutes(c.startTime);
      const end = clockToMinutes(c.endTime);
      if (start === null || end === null || end <= start) continue;
      busy.push({
        title: `${c.course?.code ? c.course.code + ": " : ""}${c.title || "Class"}`,
        startMin: start,
        endMin: end,
        kind: "CLASS",
        location: c.location,
      });
    }

    const plan = buildDayPlan(tasks, busy, {
      nowMin,
      endOfDayMs: local.endOfDay.getTime(),
      budgetMinutes,
      dayEndMin: endHour * 60,
      startOverrideMin: startParam,
    });
    if (allDay.length > 0) plan.notes.push(`All day: ${allDay.join(", ")}.`);

    return NextResponse.json(
      {
        success: true,
        plan,
        now: { minutes: nowMin, dateLabel: `${local.year}-${String(local.month).padStart(2, "0")}-${String(local.day).padStart(2, "0")}` },
      },
      { headers: noCacheHeaders }
    );
  } catch (error: any) {
    if (error instanceof ValidationError) return badRequest(error.message);
    console.error("Error building daily plan:", error);
    return NextResponse.json({ success: false, error: "Failed to generate plan" }, { status: 500, headers: noCacheHeaders });
  }
}
