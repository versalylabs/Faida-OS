/** Client-side date labels in the student's time zone (Nairobi). */
export const APP_TZ = "Africa/Nairobi";

/** YYYY-MM-DD of an instant as seen in the app's time zone. */
export function dayKey(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: APP_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

export function timeLabel(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: APP_TZ, hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(iso));
}

export function shortDayLabel(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: APP_TZ, weekday: "short", day: "numeric", month: "short" }).format(new Date(iso));
}

/** "Today 5:00 PM", "Tomorrow", "Mon 9 Nov, 11:59 PM". Skips the time for all-day items. */
export function whenLabel(iso: string, allDay = false, now: Date = new Date()): string {
  const d = new Date(iso);
  const key = dayKey(d);
  const time = allDay ? "" : ` ${timeLabel(iso)}`;
  if (key === dayKey(now)) return `Today${time}`;
  if (key === dayKey(new Date(now.getTime() + 86400000))) return `Tomorrow${time}`;
  if (key === dayKey(new Date(now.getTime() - 86400000))) return `Yesterday${time}`;
  return `${shortDayLabel(iso)}${allDay ? "" : ","}${time}`;
}

/** How far overdue something is, in words. */
export function lateLabel(iso: string, now: Date = new Date()): string {
  const hours = Math.round((now.getTime() - new Date(iso).getTime()) / 3600000);
  if (hours < 24) return `${Math.max(1, hours)}h late`;
  const days = Math.floor(hours / 24);
  return `${days}d late`;
}

/** The instant of "HH:mm" on a YYYY-MM-DD day in the app's time zone (what a person typed in a form). */
export function zonedInstant(key: string, hm: string): Date {
  const guess = Date.parse(`${key}T${hm.length === 5 ? hm : "00:00"}:00Z`);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TZ,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
  }).formatToParts(new Date(guess));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"));
  return new Date(guess - (asUtc - Math.floor(guess / 60000) * 60000));
}

/** "HH:mm" (24h) of an instant in the app's time zone, for time inputs. */
export function timeInputValue(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: APP_TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
}

/** Add whole days to a YYYY-MM-DD key. */
export function addDaysKey(key: string, days: number): string {
  return new Date(Date.parse(`${key}T12:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
}

/** Monday of the week containing a YYYY-MM-DD key. */
export function weekStartKey(key: string): string {
  const dow = new Date(`${key}T12:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDaysKey(key, -((dow + 6) % 7));
}
