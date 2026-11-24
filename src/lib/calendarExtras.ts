import { prisma } from "@/lib/db";
import type { AgendaItem } from "@/lib/agenda";
import { nextDue } from "@/lib/bills";
import { formatClock, type DayPlan } from "@/lib/planner/scheduler";
import { zonedDateKey, zonedTime } from "@/lib/tz";

/**
 * Extra rows for the Calendar only (not the shared agenda, so reminders, Today and the briefing do not
 * double up): the blocks of each locked daily plan, and bills, including their next occurrences inside the
 * range (rent next month shows up too). Overdue bills are returned separately for "Needs attention".
 */
export async function calendarExtras(userId: string, from: Date, to: Date, now: Date = new Date()) {
  const fromKey = zonedDateKey(from);
  const toKey = zonedDateKey(new Date(to.getTime() - 1));

  const [plans, bills] = await Promise.all([
    prisma.dailyPlan.findMany({ where: { userId, dateKey: { gte: fromKey, lte: toKey } } }),
    prisma.bill.findMany({ where: { userId, active: true, nextDueAt: { lt: to } } }),
  ]);

  // Plan blocks, ticked when their task is done
  const taskIds = new Set<string>();
  for (const p of plans) for (const s of (p.plan as unknown as DayPlan).slots) if (s.kind === "TASK" && s.taskId) taskIds.add(s.taskId);
  const done = new Set(
    taskIds.size
      ? (await prisma.task.findMany({ where: { userId, id: { in: [...taskIds] }, status: "DONE" }, select: { id: true } })).map((t) => t.id)
      : []
  );
  const items: AgendaItem[] = [];
  for (const p of plans) {
    for (const s of (p.plan as unknown as DayPlan).slots) {
      if (s.kind !== "TASK" || !s.taskId) continue;
      items.push({
        key: `PLAN:${s.taskId}:${p.dateKey}:${s.startMin}`,
        id: s.taskId,
        source: "PLAN",
        category: "PLAN",
        title: s.title,
        subtitle: `Planned focus · ${s.endMin - s.startMin} min${s.part ? ` · part ${s.part.index} of ${s.part.total}` : ""}`,
        start: zonedTime(p.dateKey, formatClock(s.startMin)).toISOString(),
        end: zonedTime(p.dateKey, formatClock(s.endMin)).toISOString(),
        allDay: false,
        done: done.has(s.taskId),
        priority: s.priority ?? null,
        color: null,
        href: "/planner",
        url: null,
        canToggle: true, // ticks the task
        canEdit: false,
      });
    }
  }

  // Bills: the current due date and the ones after it inside the range
  const kes = (n: number) => `KES ${Math.round(n).toLocaleString("en-KE")}`;
  const overdue: AgendaItem[] = [];
  for (const b of bills) {
    const billItem = (at: Date, upcoming: boolean): AgendaItem => ({
      key: `BILL:${b.id}:${zonedDateKey(at)}`,
      id: b.id,
      source: "BILL",
      category: "MONEY",
      title: `${b.name}${b.amount ? ` · ${kes(b.amount)}` : ""}`,
      subtitle: [b.paybill ? `Paybill/till ${b.paybill}` : "", b.accountNo ? `acc ${b.accountNo}` : "", upcoming ? "" : "unpaid"].filter(Boolean).join(" · ") || "Bill",
      start: at.toISOString(),
      end: null,
      allDay: true,
      done: false,
      priority: null,
      color: null,
      href: "/finance#bills",
      url: null,
      canToggle: false,
      canEdit: false,
    });
    let at: Date | null = b.nextDueAt;
    if (zonedDateKey(at) < zonedDateKey(now)) overdue.push(billItem(at, false));
    for (let i = 0; at && at < to && i < 14; i++) {
      if (at >= from) items.push(billItem(at, i > 0));
      at = nextDue(at, b.frequency, b.anchorDay);
    }
  }
  return { items, overdue };
}
