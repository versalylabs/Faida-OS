import { prisma } from "@/lib/db";
import { zonedDateKey, zonedNow, zonedTime } from "@/lib/tz";

/**
 * The one meaning of "Tomorrow" across Faida (Calendar, notification buttons, the planner, close the day):
 * the same time of day on the date `days` after today (Nairobi time), or 09:00 when the item has no time yet.
 */
export function sameTimeLater(d: Date | null | undefined, now: Date = new Date(), days = 1): Date {
  const key = new Date(Date.parse(`${zonedDateKey(now)}T12:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
  if (!d) return zonedTime(key, "09:00");
  const z = zonedNow(d);
  return zonedTime(key, `${z.hour}:${z.minute}`);
}

/**
 * Moves agenda items (by their agenda key, e.g. "TASK:<id>", "REMINDER:<id>") to tomorrow, keeping each one's
 * time of day, so an all-day item stays all-day and a 3 pm reminder becomes 3 pm tomorrow. Used by the
 * Calendar's "Tomorrow" and "Move all to tomorrow", and by close the day. Only the user's own records are
 * touched; tasks are logged as defers so Lazy Mode, today's plan and the weekly review count them the same way.
 */
export async function moveToTomorrow(userId: string, keys: string[], now: Date = new Date()): Promise<number> {
  const sameTimeTomorrow = (d: Date | null) => sameTimeLater(d, now, 1);

  const ids = (source: string) =>
    [...new Set(keys.filter((k) => k.startsWith(`${source}:`)).map((k) => k.split(":")[1]).filter(Boolean))].slice(0, 200);

  let moved = 0;

  const tasks = await prisma.task.findMany({ where: { userId, id: { in: ids("TASK") } }, select: { id: true, dueDate: true, estimatedMinutes: true } });
  for (const t of tasks) {
    await prisma.task.update({ where: { id: t.id }, data: { dueDate: sameTimeTomorrow(t.dueDate) } });
  }
  if (tasks.length) {
    await prisma.effortEvent.createMany({ data: tasks.map((t) => ({ userId, type: "DEFER", taskId: t.id, minutes: t.estimatedMinutes || 0 })) });
  }
  moved += tasks.length;

  const reminders = await prisma.reminder.findMany({ where: { userId, id: { in: ids("REMINDER") } }, select: { id: true, dueAt: true } });
  for (const r of reminders) await prisma.reminder.update({ where: { id: r.id }, data: { dueAt: sameTimeTomorrow(r.dueAt), isCompleted: false } });
  moved += reminders.length;

  const work = await prisma.businessDeliverable.findMany({ where: { userId, id: { in: ids("DELIVERABLE") } }, select: { id: true, dueDate: true } });
  for (const d of work) {
    await prisma.businessDeliverable.update({ where: { id: d.id }, data: { dueDate: sameTimeTomorrow(d.dueDate) } });
  }
  moved += work.length;

  const upkeep = await prisma.maintenanceItem.findMany({ where: { userId, id: { in: ids("MAINTENANCE") } }, select: { id: true, nextDueAt: true } });
  for (const m of upkeep) await prisma.maintenanceItem.update({ where: { id: m.id }, data: { nextDueAt: sameTimeTomorrow(m.nextDueAt) } });
  moved += upkeep.length;

  return moved;
}
