import { prisma } from "@/lib/db";
import { byPriorityThenNewest } from "@/lib/priority";
import { calculateEnergyCost } from "@/lib/effort";
import { buildDayPlan, type BusyBlock, type DayPlan, type PlanTask } from "@/lib/planner/scheduler";
import { zonedDateKey, zonedNow } from "@/lib/tz";
import { safeFloat, safeInt } from "@/lib/validate";

/**
 * The daily plan, live or locked in. Shared by the Daily Planner (/api/planner) and the "Lock plan" button on the
 * morning summary notification.
 */

export function clockToMinutes(value: string | null | undefined): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(value || "");
  if (!m) return null;
  const mins = Number(m[1]) * 60 + Number(m[2]);
  return mins >= 0 && mins <= 24 * 60 ? mins : null;
}

export interface PlanParams {
  budgetMinutes: number;
  startParam: number | null;
  endHour: number;
}

export function paramsFrom(get: (k: string) => string | null): PlanParams {
  return {
    budgetMinutes: Math.round(safeFloat(get("hours") || "4.5", 4.5, 0.25, 12) * 60),
    startParam: clockToMinutes(get("start")),
    endHour: safeInt(get("endHour"), 20, 12, 23),
  };
}

export function dayKeyBefore(dateKey: string): string {
  return new Date(Date.parse(`${dateKey}T12:00:00Z`) - 86400000).toISOString().slice(0, 10);
}

/** Task ids on a plan's timeline. */
export function plannedTaskIds(plan: DayPlan): string[] {
  return [...new Set(plan.slots.filter((s) => s.kind === "TASK" && s.taskId).map((s) => s.taskId!))];
}

/**
 * Builds today's plan from the live data: open tasks (minus the ones moved to tomorrow today), today's
 * events and classes. Work that was in yesterday's locked plan but is still open is carried over and goes
 * first after overdue and due-today work.
 */
export async function buildLivePlan(userId: string, p: PlanParams) {
  const local = zonedNow();
  const nowMin = local.hour * 60 + local.minute;
  const isoDow = local.dayOfWeek === 0 ? 7 : local.dayOfWeek;
  const todayKey = zonedDateKey(new Date());

  const [dbTasks, events, classes, deferredToday, yesterday] = await Promise.all([
    prisma.task.findMany({
      where: { userId, status: { notIn: ["DONE", "ARCHIVED"] } },
      include: { project: true, course: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.calendarEvent.findMany({
      where: { userId, startTime: { lt: local.endOfDay }, endTime: { gt: local.startOfDay } },
      orderBy: { startTime: "asc" },
    }),
    prisma.academicClass.findMany({
      where: { userId, dayOfWeek: isoDow },
      include: { course: { select: { code: true, name: true } } },
    }),
    prisma.effortEvent.findMany({
      where: { userId, type: "DEFER", createdAt: { gte: local.startOfDay } },
      select: { taskId: true },
    }),
    prisma.dailyPlan.findUnique({ where: { userId_dateKey: { userId, dateKey: dayKeyBefore(todayKey) } } }),
  ]);
  dbTasks.sort(byPriorityThenNewest);

  // "Move to tomorrow" today means: not today.
  const deferred = new Set(deferredToday.map((e) => e.taskId).filter(Boolean) as string[]);
  const carried = new Set(yesterday ? plannedTaskIds(yesterday.plan as unknown as DayPlan) : []);

  const tasks: PlanTask[] = dbTasks
    .filter((t) => !deferred.has(t.id))
    .map((t) => ({
      id: t.id,
      title: t.title,
      priority: t.priority,
      estimatedMinutes: t.estimatedMinutes || 30,
      energyCost: calculateEnergyCost(t.title, t.estimatedMinutes || 30),
      dueDate: t.dueDate ? t.dueDate.toISOString() : null,
      projectName: t.course ? t.course.code : t.project?.name,
      carriedOver: carried.has(t.id),
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
    budgetMinutes: p.budgetMinutes,
    dayEndMin: p.endHour * 60,
    startOverrideMin: p.startParam,
  });
  const carriedCount = tasks.filter((t) => t.carriedOver).length;
  if (carriedCount === 1) plan.notes.push("1 task from yesterday's plan is still open, so it goes first.");
  else if (carriedCount > 1) plan.notes.push(`${carriedCount} tasks from yesterday's plan are still open, so they go first.`);
  if (allDay.length > 0) plan.notes.push(`All day: ${allDay.join(", ")}.`);

  const dateLabel = `${local.year}-${String(local.month).padStart(2, "0")}-${String(local.day).padStart(2, "0")}`;
  return { plan, nowMin, todayKey, dateLabel, deferred };
}

/** A locked plan as it stands now: finished work is ticked, work moved to tomorrow or dropped is removed. */
export async function lockedView(userId: string, saved: DayPlan, deferred: Set<string>): Promise<DayPlan> {
  const ids = plannedTaskIds(saved);
  const rows = ids.length
    ? await prisma.task.findMany({ where: { userId, id: { in: ids } }, select: { id: true, status: true } })
    : [];
  const status = new Map(rows.map((r) => [r.id, r.status]));
  const slots = saved.slots
    .filter((s) => s.kind !== "TASK" || !s.taskId || (status.has(s.taskId) && status.get(s.taskId) !== "ARCHIVED" && !deferred.has(s.taskId)))
    .map((s) => (s.kind === "TASK" && s.taskId ? { ...s, done: status.get(s.taskId) === "DONE" } : s));
  return { ...saved, slots };
}

/**
 * Locks in today's plan, built fresh from now. Locking again later keeps the blocks already behind you and
 * replans the rest of the day.
 */
export async function lockPlan(userId: string, params: PlanParams) {
  const todayKey = zonedDateKey(new Date());
  const live = await buildLivePlan(userId, params);
  const existing = await prisma.dailyPlan.findUnique({ where: { userId_dateKey: { userId, dateKey: todayKey } } });

  let plan: DayPlan = live.plan;
  if (existing) {
    const before = (existing.plan as unknown as DayPlan).slots.filter((s) => s.endMin <= live.nowMin);
    plan = { ...live.plan, slots: [...before, ...live.plan.slots].sort((a, b) => a.startMin - b.startMin) };
  }
  // Ticks are worked out when the plan is shown, never stored.
  plan = { ...plan, slots: plan.slots.map(({ done: _done, ...s }) => s) };

  const saved = await prisma.dailyPlan.upsert({
    where: { userId_dateKey: { userId, dateKey: todayKey } },
    create: { userId, dateKey: todayKey, budgetMinutes: params.budgetMinutes, plan: plan as any },
    update: { budgetMinutes: params.budgetMinutes, plan: plan as any },
  });
  return { plan, saved, live };
}

/** The focus time to use when locking without choosing: the last locked plan's, else 4.5 hours. */
export async function usualBudgetMinutes(userId: string): Promise<number> {
  const last = await prisma.dailyPlan.findFirst({ where: { userId }, orderBy: { dateKey: "desc" }, select: { budgetMinutes: true } });
  return last?.budgetMinutes ?? 270;
}
