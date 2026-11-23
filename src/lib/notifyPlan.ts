import type { AgendaItem } from "@/lib/agenda";
import { zonedDateKey, zonedNow, zonedTime } from "@/lib/tz";

/**
 * Decides which reminders are due right now. Pure: no database and no network, so every rule can be
 * tested with a fixed clock. The caller supplies the agenda, the student's preferences and the keys of
 * reminders that were already sent.
 */

export interface NotifyPrefs {
  enabled: boolean;
  nightBefore: boolean;
  nightHour: number;
  hourBefore: boolean;
  leadMinutes: number;
  morningHour: number;
  quietStart: number;
  quietEnd: number;
  events: boolean;
  academic: boolean;
  business: boolean;
  reminders: boolean;
  tasks: boolean;
  maintenance: boolean;
  classes: boolean;
}

export const DEFAULT_PREFS: NotifyPrefs = {
  enabled: true,
  nightBefore: true,
  nightHour: 20,
  hourBefore: true,
  leadMinutes: 60,
  morningHour: 8,
  quietStart: 23,
  quietEnd: 6,
  events: true,
  academic: true,
  business: true,
  reminders: true,
  tasks: true,
  maintenance: false,
  classes: false,
};

export type ReminderKind = "night" | "hour" | "due" | "morning" | "digest" | "review" | "bill";

/** Buttons on the notification. Phones show at most two, so each reminder gets the two that matter most. */
export type NotifyAction = "done" | "snooze" | "tomorrow" | "confirm" | "paid" | "join" | "lockplan";
export const ACTION_LABELS: Record<NotifyAction, string> = { done: "Done", snooze: "Snooze 1h", tomorrow: "Tomorrow", confirm: "All correct", paid: "Paid", join: "Join", lockplan: "Lock today's plan" };

export interface PlannedNotification {
  key: string; // unique per item, kind and start time
  kind: ReminderKind;
  itemKey: string;
  title: string;
  body: string;
  url: string;
  tag: string;
  actions: NotifyAction[];
  link?: string | null; // a meeting link the "Join" button opens
}

/**
 * Which buttons a reminder offers. Only things you own can be changed from a notification: tasks, your
 * reminders and client work. Classes, CATs and calendar events are left alone (tapping opens the app).
 */
export function actionsFor(item: AgendaItem, kind: ReminderKind): NotifyAction[] {
  // A class, live session or meeting with a link: join it straight from the reminder.
  if (joinLink(item) && (kind === "hour" || kind === "due")) return ["join"];
  const own = item.source === "TASK" || item.source === "REMINDER" || item.source === "DELIVERABLE" || item.source === "PLAN";
  if (!own || kind === "digest") return [];
  // Right now (or within the hour): finish it, or be reminded again shortly.
  if (kind === "due" || kind === "hour") return ["done", "snooze"];
  // The evening before or the morning of: finish it, or push it a day.
  return ["done", "tomorrow"];
}

/** The meeting link of a class, live session or event, when it has one. */
export function joinLink(item: AgendaItem): string | null {
  if (!["CLASS", "ZOOM", "EVENT", "CAT"].includes(item.source)) return null;
  return item.url && /^https?:\/\//i.test(item.url) ? item.url : null;
}

function sameDayTime(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Nairobi", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
}

function listTitles(items: AgendaItem[], max: number): string {
  const names = items.slice(0, max).map((i) => i.title);
  return names.join(", ") + (items.length > max ? ` +${items.length - max} more` : "");
}

/**
 * One morning message instead of a ping per item: what is on today, what is due, and what slipped.
 * Returns null on an empty day.
 */
export function buildDigest(items: AgendaItem[], overdue: AgendaItem[], now: Date): { title: string; body: string } | null {
  const todayKey = zonedDateKey(now);
  const today = items.filter(
    (i) => !i.done && zonedDateKey(new Date(i.start)) === todayKey && i.source !== "MAINTENANCE" && i.source !== "PLAN"
  );
  const timed = today.filter((i) => !i.allDay).sort((a, b) => a.start.localeCompare(b.start));
  const due = today.filter((i) => i.allDay);
  const late = overdue.filter((i) => !i.done);
  if (timed.length === 0 && due.length === 0 && late.length === 0) return null;

  const counts = [
    timed.length ? `${timed.length} scheduled` : "",
    due.length ? `${due.length} due` : "",
    late.length ? `${late.length} overdue` : "",
  ].filter(Boolean);
  const lines: string[] = [];
  for (const i of timed.slice(0, 3)) lines.push(`${sameDayTime(i.start)} ${i.title}`);
  if (timed.length > 3) lines.push(`+${timed.length - 3} more later`);
  if (due.length) lines.push(`Due: ${listTitles(due, 3)}`);
  if (late.length) lines.push(`Overdue: ${listTitles(late, 2)}`);
  return { title: `Today: ${counts.join(" · ")}`, body: lines.join("\n") };
}

const HOUR = 3600000;

function categoryEnabled(item: AgendaItem, p: NotifyPrefs): boolean {
  switch (item.source) {
    case "EVENT":
      return p.events;
    case "REMINDER":
      return p.reminders;
    case "CAT":
      return p.academic;
    case "CLASS":
    case "ZOOM":
      return p.classes;
    case "MAINTENANCE":
      return p.maintenance;
    case "DELIVERABLE":
      return p.business;
    case "PLAN":
      return p.tasks;
    case "TASK":
      return item.category === "ACADEMIC" ? p.academic : p.tasks;
    default:
      return false;
  }
}

export function inQuietHours(hour: number, start: number, end: number): boolean {
  if (start === end) return false;
  return start < end ? hour >= start && hour < end : hour >= start || hour < end;
}

function clock(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Nairobi", hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(iso));
}

function previousDayKey(dateKey: string): string {
  return new Date(Date.parse(`${dateKey}T12:00:00Z`) - 86400000).toISOString().slice(0, 10);
}

export interface BillDue {
  id: string;
  name: string;
  amount: number | null;
  paybill: string | null;
  accountNo: string | null;
  nextDueAt: Date;
  remindDaysBefore: number;
}

/**
 * Bill reminders, at the morning hour: from `remindDaysBefore` days ahead, on the day, and every morning while the
 * bill is overdue (a bill is never logged as paid by itself). "Paid" logs it; a bill whose amount varies has no
 * button, so tapping opens Finance to enter the amount.
 */
export function planBills(bills: BillDue[], prefs: NotifyPrefs, now: Date, alreadySent: Set<string>): PlannedNotification[] {
  if (!prefs.enabled || !prefs.reminders) return [];
  const { hour } = zonedNow(now);
  if (inQuietHours(hour, prefs.quietStart, prefs.quietEnd)) return [];
  const todayKey = zonedDateKey(now);
  const morning = zonedTime(todayKey, `${String(prefs.morningHour).padStart(2, "0")}:00`).getTime();
  if (now.getTime() < morning || now.getTime() >= morning + 4 * HOUR) return [];

  const kes = (n: number) => `KES ${Math.round(n).toLocaleString("en-KE")}`;
  const out: PlannedNotification[] = [];
  for (const b of bills) {
    const days = Math.round(
      (Date.parse(`${zonedDateKey(b.nextDueAt)}T12:00:00Z`) - Date.parse(`${todayKey}T12:00:00Z`)) / 86400000
    );
    if (days > b.remindDaysBefore) continue;
    const key = `bill:${b.id}:${b.nextDueAt.getTime()}:${todayKey}`;
    if (alreadySent.has(key)) continue;
    const amount = b.amount ? ` · ${kes(b.amount)}` : "";
    const title =
      days < 0
        ? `Overdue: ${b.name}${amount} (${-days} day${days === -1 ? "" : "s"})`
        : days === 0
          ? `Due today: ${b.name}${amount}`
          : days === 1
            ? `Due tomorrow: ${b.name}${amount}`
            : `${b.name} due in ${days} days${amount}`;
    const payTo = [b.paybill ? `Paybill/till ${b.paybill}` : "", b.accountNo ? `acc ${b.accountNo}` : ""].filter(Boolean).join(" · ");
    out.push({
      key,
      kind: "bill",
      itemKey: `BILL:${b.id}`,
      title,
      body: [payTo, b.amount ? "Tap Paid once it is paid." : "Open to enter what you paid."].filter(Boolean).join(". "),
      url: "/finance#bills",
      tag: `bill:${b.id}`,
      actions: b.amount ? ["paid"] : [],
    });
  }
  return out;
}

/**
 * The evening check of money logged automatically from M-Pesa: one message at the evening hour when anything
 * is waiting, with an "All correct" button.
 */
export function planReview(
  pending: { count: number; out: number; in: number },
  prefs: NotifyPrefs,
  now: Date,
  alreadySent: Set<string>
): PlannedNotification | null {
  if (!prefs.enabled || pending.count === 0) return null;
  const { hour } = zonedNow(now);
  if (inQuietHours(hour, prefs.quietStart, prefs.quietEnd)) return null;
  const todayKey = zonedDateKey(now);
  const evening = zonedTime(todayKey, `${String(prefs.nightHour).padStart(2, "0")}:00`).getTime();
  const nowMs = now.getTime();
  if (nowMs < evening || nowMs >= evening + 3 * HOUR) return null;
  const key = `review:${todayKey}`;
  if (alreadySent.has(key)) return null;
  const kes = (n: number) => `KES ${Math.round(n).toLocaleString("en-KE")}`;
  const parts = [pending.out > 0 ? `Out ${kes(pending.out)}` : "", pending.in > 0 ? `In ${kes(pending.in)}` : ""].filter(Boolean);
  return {
    key,
    kind: "review",
    itemKey: "REVIEW:all",
    title: `M-Pesa: ${pending.count} to check`,
    body: `${parts.join(" · ")}. Tap All correct if they look right, or open to change a category.`,
    url: "/finance#review",
    tag: key,
    actions: ["confirm"],
  };
}

export function planNotifications(
  items: AgendaItem[],
  prefs: NotifyPrefs,
  now: Date,
  alreadySent: Set<string>,
  overdue: AgendaItem[] = []
): PlannedNotification[] {
  if (!prefs.enabled) return [];
  const nowMs = now.getTime();
  const { hour } = zonedNow(now);
  const quiet = inQuietHours(hour, prefs.quietStart, prefs.quietEnd);
  const out: PlannedNotification[] = [];

  const add = (item: AgendaItem, kind: ReminderKind, title: string, body: string) => {
    const key = `${item.key}:${kind}:${new Date(item.start).getTime()}`;
    if (alreadySent.has(key) || out.some((o) => o.key === key)) return;
    out.push({ key, kind, itemKey: item.key, title, body, url: item.href || "/calendar", tag: key, actions: actionsFor(item, kind), link: joinLink(item) });
  };

  // The morning summary, at the "morning" hour (it replaces one ping per all-day item).
  const todayKey = zonedDateKey(now);
  const morningStart = zonedTime(todayKey, `${String(prefs.morningHour).padStart(2, "0")}:00`).getTime();
  const inMorningWindow = !quiet && nowMs >= morningStart && nowMs < morningStart + 4 * HOUR;
  const digestKey = `digest:${todayKey}`;
  let digestSent = alreadySent.has(digestKey);
  if (inMorningWindow && !digestSent) {
    const digest = buildDigest(items.filter((i) => categoryEnabled(i, prefs) || i.source === "CLASS" || i.source === "ZOOM"), overdue, now);
    if (digest) {
      out.push({ key: digestKey, kind: "digest", itemKey: digestKey, title: digest.title, body: digest.body, url: "/", tag: digestKey, actions: [] });
      digestSent = true;
    }
  }

  for (const item of items) {
    if (item.done || !categoryEnabled(item, prefs)) continue;
    const start = new Date(item.start).getTime();
    const timedStart = !item.allDay;
    const dayKey = zonedDateKey(new Date(item.start));
    const detail = (extra: string) => [item.subtitle, extra].filter(Boolean).join(" · ");

    // A block of the plan you locked in: "time to start", around the block's start (the sender runs every
    // ~15 minutes, so the window is wide enough to be caught once).
    if (item.source === "PLAN") {
      if (nowMs >= start - 10 * 60000 && nowMs < start + 10 * 60000) add(item, "due", `Time to start: ${item.title}`, detail(clock(item.start)));
      continue;
    }

    // Your own reminders go off at the time you set, even in quiet hours.
    if (item.source === "REMINDER") {
      if (nowMs >= start && nowMs - start < HOUR) add(item, "due", `Reminder: ${item.title}`, detail(clock(item.start)));
      continue;
    }

    const lead = (item.source === "CLASS" || item.source === "ZOOM" ? Math.min(prefs.leadMinutes, 15) : prefs.leadMinutes) * 60000;
    const isMaintenance = item.source === "MAINTENANCE";

    // Soon: shortly before a timed item starts. Time-critical, so it ignores quiet hours.
    if (prefs.hourBefore && timedStart && !isMaintenance && nowMs >= start - lead && nowMs < start) {
      const mins = Math.max(1, Math.round((start - nowMs) / 60000));
      const when = mins >= 60 ? `${Math.round(mins / 60)} hour${Math.round(mins / 60) === 1 ? "" : "s"}` : `${mins} min`;
      add(item, "hour", `${item.title} in ${when}`, detail(`Starts at ${clock(item.start)}`));
    }

    // The evening before.
    if (prefs.nightBefore && !isMaintenance && !quiet) {
      const evening = zonedTime(previousDayKey(dayKey), `${String(prefs.nightHour).padStart(2, "0")}:00`).getTime();
      if (nowMs >= evening && nowMs < evening + 3 * HOUR && start - nowMs > lead + 30 * 60000) {
        add(
          item,
          "night",
          timedStart ? `Tomorrow ${clock(item.start)}: ${item.title}` : `Due tomorrow: ${item.title}`,
          detail(timedStart ? "Tomorrow" : "Plan time for it today")
        );
      }
    }

    // The morning of a day-long item (a date with no time), unless the morning summary already covers today.
    if (!timedStart && !quiet && !(digestSent && dayKey === todayKey)) {
      const morning = zonedTime(dayKey, `${String(prefs.morningHour).padStart(2, "0")}:00`).getTime();
      if (nowMs >= morning && nowMs < morning + 4 * HOUR) add(item, "morning", `Due today: ${item.title}`, detail(""));
    }
  }

  return out;
}
