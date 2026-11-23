import * as webpush from "web-push";
import { prisma } from "@/lib/db";
import { getAgenda, type AgendaItem } from "@/lib/agenda";
import { zonedDateKey, zonedTime } from "@/lib/tz";
import { formatClock, type DayPlan } from "@/lib/planner/scheduler";
import { ACTION_LABELS, DEFAULT_PREFS, closeDayWindow, planBills, planCloseDay, planNotifications, planReview, planWeekly, weeklyReviewWindow, type NotifyPrefs, type PlannedNotification } from "@/lib/notifyPlan";
import { buildWeeklyReview, reviewHeadline, weekStartKey } from "@/lib/weeklyReview";
import { dayStats } from "@/lib/closeDay";

export interface PushTarget {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface SendResult {
  ok: boolean;
  gone?: boolean; // the device unsubscribed; forget it
}

export type Sender = (target: PushTarget, payload: string, opts: { ttl: number; urgency: "normal" | "high" }) => Promise<SendResult>;

export function isPushConfigured(): boolean {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

let vapidReady = false;
function ensureVapid() {
  if (vapidReady) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:admin@example.com",
    process.env.VAPID_PUBLIC_KEY as string,
    process.env.VAPID_PRIVATE_KEY as string
  );
  vapidReady = true;
}

/** Sends one message through the browser vendor's push service. */
export const webPushSender: Sender = async (target, payload, opts) => {
  ensureVapid();
  try {
    await webpush.sendNotification(target, payload, { TTL: opts.ttl, urgency: opts.urgency, timeout: 10_000 });
    return { ok: true };
  } catch (err: any) {
    const status = err?.statusCode;
    return { ok: false, gone: status === 404 || status === 410 };
  }
};

export async function getPrefs(userId: string): Promise<NotifyPrefs> {
  const row = await prisma.notificationPref.findUnique({ where: { userId } });
  if (!row) return { ...DEFAULT_PREFS };
  const { id: _id, userId: _u, createdAt: _c, updatedAt: _up, ...rest } = row;
  return rest as NotifyPrefs;
}

function payloadOf(n: PlannedNotification): string {
  return JSON.stringify({
    title: n.title,
    body: n.body,
    url: n.url,
    tag: n.tag,
    // The service worker sends the chosen button back to /api/notify/action with this item reference.
    ref: n.itemKey,
    link: n.link ?? null,
    actions: n.actions.map((a) => ({ action: a, title: ACTION_LABELS[a] })),
  });
}

/**
 * The task blocks of today's locked plan, as agenda-style items so they get a "time to start" reminder.
 * Finished, dropped and unknown tasks are skipped.
 */
async function lockedPlanItems(userId: string, now: Date): Promise<AgendaItem[]> {
  const dateKey = zonedDateKey(now);
  const saved = await prisma.dailyPlan.findUnique({ where: { userId_dateKey: { userId, dateKey } } });
  if (!saved) return [];
  const slots = (saved.plan as unknown as DayPlan).slots.filter((s) => s.kind === "TASK" && s.taskId);
  if (slots.length === 0) return [];
  const open = await prisma.task.findMany({
    where: { userId, id: { in: slots.map((s) => s.taskId!) }, status: { notIn: ["DONE", "ARCHIVED"] } },
    select: { id: true },
  });
  const openIds = new Set(open.map((t) => t.id));
  return slots
    .filter((s) => openIds.has(s.taskId!))
    .map((s) => ({
      key: `PLAN:${s.taskId}:${s.startMin}`,
      id: s.taskId!,
      source: "PLAN" as const,
      category: "TASK" as const,
      title: s.title,
      subtitle: [`${s.endMin - s.startMin} min`, s.part ? `part ${s.part.index} of ${s.part.total}` : ""].filter(Boolean).join(", "),
      start: zonedTime(dateKey, formatClock(s.startMin)).toISOString(),
      end: zonedTime(dateKey, formatClock(s.endMin)).toISOString(),
      allDay: false,
      done: false,
      priority: s.priority ?? null,
      color: null,
      href: "/planner",
      url: null,
      canToggle: false,
      canEdit: false,
    }));
}

export interface RunSummary {
  users: number;
  planned: number;
  sent: number;
  failed: number;
  removedDevices: number;
}

/**
 * Sends every reminder that is due. Safe to call as often as you like (every few minutes): each reminder
 * is claimed in the log first, so it goes out once, and a failed delivery is released to try again.
 */
export async function runNotifications(opts: { now?: Date; userId?: string; send?: Sender; deadlineMs?: number } = {}): Promise<RunSummary> {
  const now = opts.now ?? new Date();
  const send = opts.send ?? webPushSender;
  const deadline = Date.now() + (opts.deadlineMs ?? 45_000);
  const summary: RunSummary = { users: 0, planned: 0, sent: 0, failed: 0, removedDevices: 0 };

  if (!opts.send && !isPushConfigured()) return summary;

  const subs = await prisma.pushSubscription.findMany({
    where: opts.userId ? { userId: opts.userId } : {},
    select: { id: true, userId: true, endpoint: true, p256dh: true, auth: true },
  });
  const byUser = new Map<string, typeof subs>();
  for (const s of subs) (byUser.get(s.userId) || byUser.set(s.userId, []).get(s.userId)!).push(s);

  for (const [userId, devices] of byUser) {
    if (Date.now() > deadline) break;
    summary.users++;

    const prefs = await getPrefs(userId);
    if (!prefs.enabled) continue;

    const { items, overdue } = await getAgenda(userId, new Date(now.getTime() - 3600000), new Date(now.getTime() + 40 * 3600000), now);
    const planItems = await lockedPlanItems(userId, now);
    const firstPass = planNotifications([...items, ...planItems], prefs, now, new Set(), overdue);
    // The morning summary offers to lock in today's plan, unless one is locked already.
    const digest = firstPass.find((n) => n.kind === "digest");
    if (digest) {
      const locked = await prisma.dailyPlan.findUnique({ where: { userId_dateKey: { userId, dateKey: zonedDateKey(now) } }, select: { id: true } });
      if (!locked) digest.actions = ["lockplan"];
    }
    const pending = await prisma.financeTransaction.findMany({ where: { userId, needsReview: true }, select: { amount: true } });
    const review = planReview(
      {
        count: pending.length,
        out: pending.filter((t) => t.amount < 0).reduce((a, t) => a - t.amount, 0),
        in: pending.filter((t) => t.amount > 0).reduce((a, t) => a + t.amount, 0),
      },
      prefs,
      now,
      new Set()
    );
    if (review) firstPass.push(review);
    const bills = await prisma.bill.findMany({
      where: { userId, active: true, nextDueAt: { lte: new Date(now.getTime() + 15 * 86400000) } },
      select: { id: true, name: true, amount: true, paybill: true, accountNo: true, nextDueAt: true, remindDaysBefore: true },
    });
    firstPass.push(...planBills(bills, prefs, now, new Set()));
    // Late evening: close the day (only worked out inside its window)
    if (closeDayWindow(prefs, now)) {
      const closeKey = `closeday:${zonedDateKey(now)}`;
      const sentClose = await prisma.notificationLog.findFirst({ where: { userId, key: closeKey }, select: { id: true } });
      if (!sentClose) {
        const close = planCloseDay(await dayStats(userId, now), now, new Set());
        if (close) firstPass.push(close);
      }
    }
    // Sunday evening: the weekly review (built only inside its window, so ordinary runs stay light)
    if (weeklyReviewWindow(prefs, now)) {
      const weekKey = weekStartKey(now);
      const alreadyWeekly = await prisma.notificationLog.findFirst({ where: { userId, key: `weekly:${weekKey}` }, select: { id: true } });
      if (!alreadyWeekly) {
        const weekly = planWeekly(weekKey, reviewHeadline(await buildWeeklyReview(userId, now)), new Set());
        if (weekly) firstPass.push(weekly);
      }
    }
    if (firstPass.length === 0) continue;

    const sentRows = await prisma.notificationLog.findMany({
      where: { userId, key: { in: firstPass.map((n) => n.key) } },
      select: { key: true },
    });
    const sent = new Set(sentRows.map((r) => r.key));
    const due = firstPass.filter((n) => !sent.has(n.key)).slice(0, 6);
    summary.planned += due.length;

    for (const n of due) {
      // Claim first: a second run at the same moment finds the claim and skips it.
      const claim = await prisma.notificationLog.createMany({
        data: [{ userId, key: n.key, title: n.title.slice(0, 200) }],
        skipDuplicates: true,
      });
      if (claim.count === 0) continue;

      let delivered = false;
      for (const d of devices) {
        const result = await send(
          { endpoint: d.endpoint, keys: { p256dh: d.p256dh, auth: d.auth } },
          payloadOf(n),
          { ttl: n.kind === "hour" ? 3600 : 6 * 3600, urgency: n.kind === "hour" || n.kind === "due" || n.kind === "digest" || n.kind === "bill" ? "high" : "normal" }
        );
        if (result.ok) {
          delivered = true;
          await prisma.pushSubscription.update({ where: { id: d.id }, data: { lastSentAt: now, failureCount: 0 } }).catch(() => {});
        } else if (result.gone) {
          await prisma.pushSubscription.deleteMany({ where: { id: d.id } });
          summary.removedDevices++;
        } else {
          await prisma.pushSubscription.update({ where: { id: d.id }, data: { failureCount: { increment: 1 } } }).catch(() => {});
        }
      }

      if (delivered) summary.sent++;
      else {
        // Nobody received it: let the next run try again.
        summary.failed++;
        await prisma.notificationLog.deleteMany({ where: { userId, key: n.key } });
      }
    }
  }

  // Housekeeping: old log rows and devices that have failed repeatedly.
  if (Math.random() < 0.05) {
    await prisma.notificationLog.deleteMany({ where: { sentAt: { lt: new Date(now.getTime() - 30 * 86400000) } } }).catch(() => {});
    await prisma.pushSubscription.deleteMany({ where: { failureCount: { gte: 20 } } }).catch(() => {});
  }
  return summary;
}

/** A test message for the Settings "Send test" button. */
export async function sendTestNotification(userId: string, send: Sender = webPushSender): Promise<{ sent: number; devices: number }> {
  const devices = await prisma.pushSubscription.findMany({ where: { userId } });
  let sent = 0;
  for (const d of devices) {
    const r = await send(
      { endpoint: d.endpoint, keys: { p256dh: d.p256dh, auth: d.auth } },
      JSON.stringify({ title: "Faida OS notifications are on", body: "You'll get reminders for CATs, assignments, meetings and your own reminders.", url: "/settings", tag: "faida-test" }),
      { ttl: 300, urgency: "high" }
    );
    if (r.ok) sent++;
    else if (r.gone) await prisma.pushSubscription.deleteMany({ where: { id: d.id } });
  }
  return { sent, devices: devices.length };
}
