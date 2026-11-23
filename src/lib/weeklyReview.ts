import { prisma } from "@/lib/db";
import { computeKpiRows } from "@/lib/kpiRows";
import { staleDays } from "@/lib/projectNext";
import { zonedDateKey, zonedNow, zonedTime } from "@/lib/tz";

/**
 * The weekly review: what the week (Monday to now, Nairobi time) produced and what next week holds.
 * Read by the /review page and summed up in the Sunday evening notification.
 */

const DAY = 86400000;

export interface WeeklyReview {
  week: { start: string; end: string; label: string };
  finished: { tasks: number; deliverables: number; focusMinutes: number; plansLocked: number; recent: { title: string; kind: string; at: string }[] };
  money: {
    in: number;
    out: number;
    net: number;
    fees: number;
    topSpending: { category: string; amount: number }[];
    byBusiness: { name: string; in: number; out: number }[];
    billsPaid: string[];
  };
  stalled: { id: string; name: string; days: number }[];
  kpis: { business: string; name: string; unit: string; value: number; target: number; percent: number | null }[];
  nextWeek: {
    cats: { title: string; at: string; course: string | null }[];
    assignments: { title: string; at: string }[];
    deliverables: { title: string; at: string }[];
    bills: { name: string; amount: number | null; at: string; overdue: boolean }[];
    tasksDue: number;
  };
  overdueTasks: number;
}

/** Monday 00:00 (Nairobi) of the week containing `now`, as a YYYY-MM-DD key. */
export function weekStartKey(now: Date = new Date()): string {
  const z = zonedNow(now);
  const back = (z.dayOfWeek + 6) % 7; // Monday = 0 days back
  return new Date(Date.UTC(z.year, z.month - 1, z.day - back, 12)).toISOString().slice(0, 10);
}

const addDays = (key: string, days: number) => new Date(Date.parse(`${key}T12:00:00Z`) + days * DAY).toISOString().slice(0, 10);

export async function buildWeeklyReview(userId: string, now: Date = new Date()): Promise<WeeklyReview> {
  const startKey = weekStartKey(now);
  const weekStart = zonedTime(startKey, "00:00");
  const nextStart = zonedTime(addDays(startKey, 7), "00:00");
  const nextEnd = zonedTime(addDays(startKey, 14), "00:00");
  const { startOfDay } = zonedNow(now);

  const [logs, doneTasks, doneWork, plans, money, businesses, billsPaid, projects, cats, lms, workDue, billsDue, tasksDue, overdueTasks] = await Promise.all([
    prisma.completionLog.findMany({ where: { userId, completedAt: { gte: weekStart, lte: now } }, orderBy: { completedAt: "desc" } }),
    prisma.task.findMany({
      where: { userId, status: "DONE", updatedAt: { gte: weekStart, lte: now } },
      select: { id: true, title: true, estimatedMinutes: true, updatedAt: true },
    }),
    prisma.businessDeliverable.findMany({
      where: { userId, status: "COMPLETED", completedAt: { gte: weekStart, lte: now } },
      select: { id: true, title: true, completedAt: true },
    }),
    prisma.dailyPlan.count({ where: { userId, dateKey: { gte: startKey, lte: zonedDateKey(now) } } }),
    prisma.financeTransaction.findMany({
      where: { userId, date: { gte: weekStart, lte: now }, type: { not: "TRANSFER" } },
      select: { amount: true, category: true, businessId: true },
    }),
    prisma.business.findMany({ where: { userId }, select: { id: true, name: true, slug: true, clients: { select: { status: true, billingCycle: true } } } }),
    prisma.bill.findMany({ where: { userId, lastPaidAt: { gte: weekStart, lte: now } }, select: { name: true } }),
    prisma.project.findMany({
      where: { userId, status: "ACTIVE" },
      select: {
        id: true,
        name: true,
        updatedAt: true,
        tasks: { where: { status: { notIn: ["DONE", "CANCELLED", "ARCHIVED"] } }, select: { updatedAt: true } },
        milestones: { where: { isDone: false }, select: { id: true } },
      },
      take: 50,
    }),
    prisma.academicAssessment.findMany({
      where: { userId, isCompleted: false, date: { gte: nextStart, lt: nextEnd } },
      select: { title: true, date: true, course: { select: { code: true } } },
      orderBy: { date: "asc" },
    }),
    prisma.lmsItem.findMany({
      where: { userId, kind: { in: ["ASSIGNMENT", "QUIZ"] }, state: "TODO", dismissed: false, dueAt: { gte: nextStart, lt: nextEnd } },
      select: { title: true, dueAt: true },
      orderBy: { dueAt: "asc" },
    }),
    prisma.businessDeliverable.findMany({
      where: { userId, status: { not: "COMPLETED" }, dueDate: { gte: nextStart, lt: nextEnd } },
      select: { title: true, dueDate: true },
      orderBy: { dueDate: "asc" },
    }),
    prisma.bill.findMany({
      where: { userId, active: true, nextDueAt: { lt: nextEnd } },
      select: { name: true, amount: true, nextDueAt: true },
      orderBy: { nextDueAt: "asc" },
    }),
    prisma.task.count({ where: { userId, status: { notIn: ["DONE", "ARCHIVED", "CANCELLED"] }, dueDate: { gte: nextStart, lt: nextEnd } } }),
    prisma.task.count({ where: { userId, status: { notIn: ["DONE", "ARCHIVED", "CANCELLED"] }, dueDate: { lt: startOfDay } } }),
  ]);

  // Finished: the log (already cleared) plus what is still on the lists, each once
  const seen = new Set<string>();
  const recent: { title: string; kind: string; at: string; minutes: number }[] = [];
  for (const l of logs) {
    seen.add(`${l.kind}:${l.sourceId}`);
    recent.push({ title: l.title, kind: l.kind, at: l.completedAt.toISOString(), minutes: l.minutes ?? 0 });
  }
  for (const t of doneTasks) if (!seen.has(`TASK:${t.id}`)) recent.push({ title: t.title, kind: "TASK", at: t.updatedAt.toISOString(), minutes: t.estimatedMinutes || 0 });
  for (const d of doneWork) if (!seen.has(`DELIVERABLE:${d.id}`)) recent.push({ title: d.title, kind: "DELIVERABLE", at: (d.completedAt ?? now).toISOString(), minutes: 0 });
  recent.sort((a, b) => b.at.localeCompare(a.at));

  // Money
  let moneyIn = 0;
  let moneyOut = 0;
  let fees = 0;
  const spend = new Map<string, number>();
  const biz = new Map<string, { in: number; out: number }>();
  for (const t of money) {
    if (t.amount > 0) moneyIn += t.amount;
    else moneyOut -= t.amount;
    if (t.amount < 0) {
      if (t.category === "M-Pesa fees") fees -= t.amount;
      spend.set(t.category, (spend.get(t.category) || 0) - t.amount);
    }
    if (t.businessId) {
      const b = biz.get(t.businessId) || { in: 0, out: 0 };
      if (t.amount > 0) b.in += t.amount;
      else b.out -= t.amount;
      biz.set(t.businessId, b);
    }
  }

  // Stalled projects (nothing moved for a week or more)
  const stalled = projects
    .map((p) => ({ id: p.id, name: p.name, days: staleDays("ACTIVE", p.tasks.length > 0 || p.milestones.length > 0, [p.updatedAt, ...p.tasks.map((t) => t.updatedAt)], now) }))
    .filter((p): p is { id: string; name: string; days: number } => p.days !== null)
    .sort((a, b) => b.days - a.days);

  // KPIs with a target, as the Business pages show them
  const { rows } = businesses.length ? await computeKpiRows(userId, businesses) : { rows: [] };
  const bizName = new Map(businesses.map((b) => [b.id, b.name]));
  const kpis = rows
    .filter((r) => r.target > 0)
    .map((r) => ({ business: bizName.get(r.businessId) || "", name: r.name, unit: r.unit, value: r.value, target: r.target, percent: r.percent }));

  const endKey = addDays(startKey, 6);
  const fmt = (k: string) => new Date(`${k}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

  return {
    week: { start: startKey, end: endKey, label: `${fmt(startKey)} – ${fmt(endKey)}` },
    finished: {
      tasks: recent.filter((r) => r.kind === "TASK").length,
      deliverables: recent.filter((r) => r.kind === "DELIVERABLE").length,
      focusMinutes: recent.reduce((a, r) => a + r.minutes, 0),
      plansLocked: plans,
      recent: recent.slice(0, 12).map(({ title, kind, at }) => ({ title, kind, at })),
    },
    money: {
      in: Math.round(moneyIn),
      out: Math.round(moneyOut),
      net: Math.round(moneyIn - moneyOut),
      fees: Math.round(fees),
      topSpending: [...spend.entries()]
        .map(([category, amount]) => ({ category, amount: Math.round(amount) }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 4),
      byBusiness: [...biz.entries()].map(([id, v]) => ({ name: bizName.get(id) || "Business", in: Math.round(v.in), out: Math.round(v.out) })),
      billsPaid: billsPaid.map((b) => b.name),
    },
    stalled,
    kpis,
    nextWeek: {
      cats: cats.map((c) => ({ title: c.title, at: c.date.toISOString(), course: c.course?.code ?? null })),
      assignments: lms.map((a) => ({ title: a.title, at: a.dueAt!.toISOString() })),
      deliverables: workDue.map((d) => ({ title: d.title, at: d.dueDate!.toISOString() })),
      bills: billsDue.map((b) => ({ name: b.name, amount: b.amount, at: b.nextDueAt.toISOString(), overdue: b.nextDueAt < startOfDay })),
      tasksDue,
    },
    overdueTasks,
  };
}

/** One line for the Sunday notification. */
export function reviewHeadline(r: WeeklyReview): { title: string; body: string } {
  const kes = (n: number) => `KES ${n.toLocaleString("en-KE")}`;
  const done = r.finished.tasks + r.finished.deliverables;
  const parts = [
    `${done} thing${done === 1 ? "" : "s"} finished`,
    r.money.out || r.money.in ? `Out ${kes(r.money.out)} · In ${kes(r.money.in)}` : "",
    r.nextWeek.cats.length ? `${r.nextWeek.cats.length} CAT${r.nextWeek.cats.length === 1 ? "" : "s"} next week` : "",
    r.stalled.length ? `${r.stalled.length} project${r.stalled.length === 1 ? "" : "s"} stalled` : "",
  ].filter(Boolean);
  return { title: "Your week in review", body: `${parts.join(" · ")}. Tap for the full review and next week.` };
}
