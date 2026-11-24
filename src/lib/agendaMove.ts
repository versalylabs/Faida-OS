import { prisma } from "@/lib/db";
import { zonedDateKey, zonedNow, zonedTime } from "@/lib/tz";

/**
 * Moves agenda items (by their agenda key, e.g. "TASK:<id>", "REMINDER:<id>") to tomorrow, keeping each one's
 * time of day, so an all-day item stays all-day and a 3 pm reminder becomes 3 pm tomorrow. Used by the
 * Calendar's "Tomorrow" and "Move all to tomorrow". Only the user's own records are touched; tasks are
 * logged as defers so Lazy Mode, today's plan and the weekly review count them the same way.
 */
export async function moveToTomorrow(userId: string, keys: string[], now: Date = new Date()): Promise<number> {
  const tomorrowKey = new Date(Date.parse(`${zonedDateKey(now)}T12:00:00Z`) + 86400000).toISOString().slice(0, 10);
  const sameTimeTomorrow = (d: Date) => {
    const z = zonedNow(d);
    return zonedTime(tomorrowKey, `${z.hour}:${z.minute}`);
  };

  const ids = (source: string) =>
    [...new Set(keys.filter((k) => k.startsWith(`${source}:`)).map((k) => k.split(":")[1]).filter(Boolean))].slice(0, 200);

  let moved = 0;

  const tasks = await prisma.task.findMany({ where: { userId, id: { in: ids("TASK") } }, select: { id: true, dueDate: true, estimatedMinutes: true } });
  for (const t of tasks) {
    await prisma.task.update({ where: { id: t.id }, data: { dueDate: t.dueDate ? sameTimeTomorrow(t.dueDate) : zonedTime(tomorrowKey, "09:00") } });
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
    await prisma.businessDeliverable.update({ where: { id: d.id }, data: { dueDate: d.dueDate ? sameTimeTomorrow(d.dueDate) : zonedTime(tomorrowKey, "09:00") } });
  }
  moved += work.length;

  const upkeep = await prisma.maintenanceItem.findMany({ where: { userId, id: { in: ids("MAINTENANCE") } }, select: { id: true, nextDueAt: true } });
  for (const m of upkeep) await prisma.maintenanceItem.update({ where: { id: m.id }, data: { nextDueAt: sameTimeTomorrow(m.nextDueAt) } });
  moved += upkeep.length;

  return moved;
}
