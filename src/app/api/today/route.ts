import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getAgenda } from "@/lib/agenda";
import { joinLink } from "@/lib/notifyPlan";
import { buildLivePlan, lockedView, usualBudgetMinutes } from "@/lib/planner/daily";
import type { DayPlan, PlanSlot } from "@/lib/planner/scheduler";
import { daysUntil } from "@/lib/bills";
import { zonedDateKey, zonedNow } from "@/lib/tz";

export const dynamic = "force-dynamic";

const DAYS = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];

/**
 * GET /api/today: everything the Today screen shows, in one request. What to do now and next (from the locked
 * plan, or the plan Faida would build), today's timed commitments, work due or overdue, money that needs a look
 * (M-Pesa to check, bills due soon), and today's meals.
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  const userId = user.id;

  try {
    const now = new Date();
    const z = zonedNow(now);
    const nowMin = z.hour * 60 + z.minute;
    const todayKey = zonedDateKey(now);

    const [saved, agenda, dueTasks, toCheck, spentRows, bills, meals, budgetMinutes] = await Promise.all([
      prisma.dailyPlan.findUnique({ where: { userId_dateKey: { userId, dateKey: todayKey } } }),
      getAgenda(userId, z.startOfDay, z.endOfDay, now),
      prisma.task.findMany({
        where: { userId, status: { notIn: ["DONE", "ARCHIVED", "CANCELLED"] }, dueDate: { lt: z.endOfDay } },
        select: { id: true, title: true, priority: true, dueDate: true },
        orderBy: { dueDate: "asc" },
        take: 30,
      }),
      prisma.financeTransaction.findMany({ where: { userId, needsReview: true }, select: { amount: true } }),
      prisma.financeTransaction.findMany({
        where: { userId, date: { gte: z.startOfDay, lt: z.endOfDay }, amount: { lt: 0 }, type: { not: "TRANSFER" } },
        select: { amount: true },
      }),
      prisma.bill.findMany({
        where: { userId, active: true, nextDueAt: { lt: new Date(z.endOfDay.getTime() + 3 * 86400000) } },
        select: { id: true, name: true, amount: true, nextDueAt: true },
        orderBy: { nextDueAt: "asc" },
      }),
      prisma.mealPlanItem.findMany({ where: { userId, dayOfWeek: DAYS[z.dayOfWeek] }, select: { mealType: true, title: true, isCompleted: true } }),
      usualBudgetMinutes(userId),
    ]);

    // The plan: the locked one, else the one Faida would build now (with your usual focus time)
    const live = await buildLivePlan(userId, { budgetMinutes: saved?.budgetMinutes ?? budgetMinutes, startParam: null, endHour: 20 });
    const plan: DayPlan = saved ? await lockedView(userId, saved.plan as unknown as DayPlan, live.deferred) : live.plan;
    const blocks = plan.slots.filter((s) => s.kind === "TASK" && !s.done);
    const current = blocks.find((s) => s.startMin <= nowMin && s.endMin > nowMin) ?? null;
    const next = blocks.find((s) => s.startMin > nowMin) ?? null;
    const slim = (s: PlanSlot | null) =>
      s ? { id: s.id, taskId: s.taskId ?? null, title: s.title, startMin: s.startMin, endMin: s.endMin, why: s.why ?? null, part: s.part ?? null } : null;

    // Today's timed commitments still ahead (classes, CATs, meetings, events, reminders)
    const timed = agenda.items
      .filter((i) => !i.allDay && !i.done && i.source !== "TASK" && new Date(i.end ?? i.start).getTime() > now.getTime() - 15 * 60000)
      .sort((a, b) => a.start.localeCompare(b.start))
      .slice(0, 8)
      .map((i) => ({ key: i.key, title: i.title, subtitle: i.subtitle, source: i.source, start: i.start, end: i.end, href: i.href, join: joinLink(i) }));

    const priorityRank: Record<string, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    const tasks = dueTasks
      .map((t) => ({ id: t.id, title: t.title, priority: t.priority, dueDate: t.dueDate!.toISOString(), overdue: t.dueDate! < z.startOfDay }))
      .sort((a, b) => Number(b.overdue) - Number(a.overdue) || (priorityRank[a.priority] ?? 9) - (priorityRank[b.priority] ?? 9));

    const mealOrder = ["BREAKFAST", "LUNCH", "SUPPER"];
    return NextResponse.json(
      {
        success: true,
        now: { minutes: nowMin, hour: z.hour },
        plan: {
          locked: Boolean(saved),
          budgetMinutes: saved?.budgetMinutes ?? budgetMinutes,
          current: slim(current),
          next: slim(next),
          blocksLeft: blocks.filter((s) => s.endMin > nowMin).length,
          blocksDone: plan.slots.filter((s) => s.kind === "TASK" && s.done).length,
          dayOver: plan.dayOver,
        },
        timed,
        tasks: tasks.slice(0, 8),
        tasksTotal: tasks.length,
        overdue: tasks.filter((t) => t.overdue).length,
        money: {
          toCheck: toCheck.length,
          toCheckOut: Math.round(toCheck.filter((t) => t.amount < 0).reduce((a, t) => a - t.amount, 0)),
          spentToday: Math.round(spentRows.reduce((a, t) => a - t.amount, 0)),
          bills: bills.map((b) => ({ id: b.id, name: b.name, amount: b.amount, days: daysUntil(b.nextDueAt, now) })),
        },
        meals: meals.sort((a, b) => mealOrder.indexOf(a.mealType) - mealOrder.indexOf(b.mealType)),
      },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    console.error("Today failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ success: false, error: "Could not load today" }, { status: 500 });
  }
}
