import { prisma } from "@/lib/db";
import type { DayPlan } from "@/lib/planner/scheduler";
import { zonedDateKey, zonedNow } from "@/lib/tz";
import { moveToTomorrow } from "@/lib/agendaMove";

/**
 * Close the day: what got done today and what is still open (tasks due today, overdue or on today's locked plan;
 * reminders whose time has passed; client work due today or overdue), plus "Roll to tomorrow", which moves the
 * open items to the same time tomorrow (09:00 when they had no time), like every other "Tomorrow" in Faida.
 */

const OPEN_EXCLUDED = ["DONE", "ARCHIVED", "CANCELLED"];

export interface OpenItem {
  key: string; // agenda key, e.g. "TASK:<id>", "REMINDER:<id>", "DELIVERABLE:<id>"
  title: string;
}

export interface DayStats {
  done: number;
  open: OpenItem[];
}

export async function dayStats(userId: string, now: Date = new Date()): Promise<DayStats> {
  const { startOfDay, endOfDay } = zonedNow(now);
  const [doneTasks, logged, doneWork, dueOpen, plan, lateReminders, openWork] = await Promise.all([
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
    // A reminder still due later tonight is not "left open"; one whose time has passed is
    prisma.reminder.findMany({
      where: { userId, isCompleted: false, dueAt: { lt: now } },
      select: { id: true, title: true },
      orderBy: { dueAt: "asc" },
      take: 50,
    }),
    prisma.businessDeliverable.findMany({
      where: { userId, status: { not: "COMPLETED" }, dueDate: { lt: endOfDay } },
      select: { id: true, title: true },
      orderBy: { dueDate: "asc" },
      take: 50,
    }),
  ]);

  // Work that was on today's locked plan and is still open counts as open too
  const planned = plan ? (plan.plan as unknown as DayPlan).slots.filter((s) => s.kind === "TASK" && s.taskId).map((s) => s.taskId!) : [];
  const plannedOpen = planned.length
    ? await prisma.task.findMany({ where: { userId, id: { in: planned }, status: { notIn: OPEN_EXCLUDED } }, select: { id: true, title: true } })
    : [];

  const open = new Map<string, OpenItem>();
  for (const t of [...dueOpen, ...plannedOpen]) open.set(`TASK:${t.id}`, { key: `TASK:${t.id}`, title: t.title });
  for (const r of lateReminders) open.set(`REMINDER:${r.id}`, { key: `REMINDER:${r.id}`, title: r.title });
  for (const w of openWork) open.set(`DELIVERABLE:${w.id}`, { key: `DELIVERABLE:${w.id}`, title: w.title });

  const doneIds = new Set([...doneTasks.map((t) => t.id), ...logged.map((l) => l.sourceId)]);
  return { done: doneIds.size + doneWork, open: [...open.values()] };
}

/** Moves today's open items to the same time tomorrow (09:00 when undated). Returns how many moved. */
export async function rollOpenToTomorrow(userId: string, now: Date = new Date()): Promise<number> {
  const { open } = await dayStats(userId, now);
  if (open.length === 0) return 0;
  return moveToTomorrow(userId, open.map((o) => o.key), now);
}
