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

export type ReminderKind = "night" | "hour" | "due" | "morning";

export interface PlannedNotification {
  key: string; // unique per item, kind and start time
  kind: ReminderKind;
  itemKey: string;
  title: string;
  body: string;
  url: string;
  tag: string;
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

export function planNotifications(items: AgendaItem[], prefs: NotifyPrefs, now: Date, alreadySent: Set<string>): PlannedNotification[] {
  if (!prefs.enabled) return [];
  const nowMs = now.getTime();
  const { hour } = zonedNow(now);
  const quiet = inQuietHours(hour, prefs.quietStart, prefs.quietEnd);
  const out: PlannedNotification[] = [];

  const add = (item: AgendaItem, kind: ReminderKind, title: string, body: string) => {
    const key = `${item.key}:${kind}:${new Date(item.start).getTime()}`;
    if (alreadySent.has(key) || out.some((o) => o.key === key)) return;
    out.push({ key, kind, itemKey: item.key, title, body, url: item.href || "/calendar", tag: key });
  };

  for (const item of items) {
    if (item.done || !categoryEnabled(item, prefs)) continue;
    const start = new Date(item.start).getTime();
    const timedStart = !item.allDay;
    const dayKey = zonedDateKey(new Date(item.start));
    const detail = (extra: string) => [item.subtitle, extra].filter(Boolean).join(" · ");

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

    // The morning of a day-long item (a date with no time).
    if (!timedStart && !quiet) {
      const morning = zonedTime(dayKey, `${String(prefs.morningHour).padStart(2, "0")}:00`).getTime();
      if (nowMs >= morning && nowMs < morning + 4 * HOUR) add(item, "morning", `Due today: ${item.title}`, detail(""));
    }
  }

  return out;
}
