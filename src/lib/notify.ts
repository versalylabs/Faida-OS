import * as webpush from "web-push";
import { prisma } from "@/lib/db";
import { getAgenda } from "@/lib/agenda";
import { DEFAULT_PREFS, planNotifications, type NotifyPrefs, type PlannedNotification } from "@/lib/notifyPlan";

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
  return JSON.stringify({ title: n.title, body: n.body, url: n.url, tag: n.tag });
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

    const { items } = await getAgenda(userId, new Date(now.getTime() - 3600000), new Date(now.getTime() + 40 * 3600000), now);
    const firstPass = planNotifications(items, prefs, now, new Set());
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
          { ttl: n.kind === "hour" ? 3600 : 6 * 3600, urgency: n.kind === "hour" || n.kind === "due" ? "high" : "normal" }
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
