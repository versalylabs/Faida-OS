import { prisma } from "@/lib/db";
import type { DayPlan } from "@/lib/planner/scheduler";
import { zonedDateKey, zonedNow } from "@/lib/tz";

/**
 * Close the day: what got done today and what is still open (due today, overdue, or on today's locked plan),
 * plus the "Roll to tomorrow" action that moves the open work to tomorrow morning.
 */

const OPEN_EXCLUDED = ["DONE", "ARCHIVED", "CANCELLED"];

export interface DayStats {
  done: number;
  open: { id: string; title: string }[];
}

export async function dayStats(userId: string, now: Date = new Date()): Promise<DayStats> {
  const { startOfDay, endOfDay } = zonedNow(now);
  const [doneTasks, logged, doneWork, dueOpen, plan] = await Promise.all([
    prisma.task.findMany({ where: { userId, status: "DONE", updatedAt: { gte: startOfDay, lt: endOfDay } }, select: { id: true } }),
    prisma.completionLog.findMany({ where: { userId, completedAt: { gte: startOfDay, lt: endOfDay } }, select: { sourceId: true } }),
    prisma.businessDeliverable.count({ where: { userId, status: "COMPLETED", completedAt: { gte: startOfDay, lt: endOfDay } } }),
    prisma.task.findMany({
      where: { userId, status: { notIn: OPEN_EXCLUDED }, dueDate: { lt: endOfDay } },
      select: { id: true, title: true },
      orderBy: { dueDate: "asc" },
      take: 50,
    }),
    prisma.dailyPlan.findUnique({ where: { userId_dateKey: { userId, dateKey: zonedDateKey(now) } }, select: { plan: true } }),
  ]);

  // Work that was on today's locked plan and is still open counts as open too
  const planned = plan ? (plan.plan as unknown as DayPlan).slots.filter((s) => s.kind === "TASK" && s.taskId).map((s) => s.taskId!) : [];
  const plannedOpen = planned.length
    ? await prisma.task.findMany({ where: { userId, id: { in: planned }, status: { notIn: OPEN_EXCLUDED } }, select: { id: true, title: true } })
    : [];

  const open = new Map<string, { id: string; title: string }>();
  for (const t of [...dueOpen, ...plannedOpen]) open.set(t.id, t);

  const doneIds = new Set([...doneTasks.map((t) => t.id), ...logged.map((l) => l.sourceId)]);
  return { done: doneIds.size + doneWork, open: [...open.values()] };
}

/** Moves today's open work (due today, overdue, or on today's plan) to 09:00 tomorrow. Returns how many moved. */
export async function rollOpenToTomorrow(userId: string, now: Date = new Date()): Promise<number> {
  const { open } = await dayStats(userId, now);
  if (open.length === 0) return 0;
  const { startOfDay } = zonedNow(now);
  const tomorrowNine = new Date(startOfDay.getTime() + 86400000 + 9 * 3600000);
  const ids = open.map((t) => t.id);
  const tasks = await prisma.task.findMany({ where: { userId, id: { in: ids } }, select: { id: true, estimatedMinutes: true } });
  await prisma.task.updateMany({ where: { userId, id: { in: ids } }, data: { dueDate: tomorrowNine } });
  // Logged like the planner's "Move to tomorrow", so Lazy Mode's "energy kept" and today's plan see it.
  await prisma.effortEvent.createMany({
    data: tasks.map((t) => ({ userId, type: "DEFER", taskId: t.id, minutes: t.estimatedMinutes || 0 })),
  });
  return tasks.length;
}
