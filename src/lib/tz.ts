/**
 * The app's "today". Servers run in UTC, but the person using it lives in East Africa, so "today",
 * "this morning" and "Monday" have to be worked out in their time zone, not the server's.
 * Override with the APP_TIME_ZONE environment variable if you move.
 */
export const APP_TIME_ZONE = process.env.APP_TIME_ZONE || "Africa/Nairobi";

export function zonedNow(now: Date = new Date(), timeZone: string = APP_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    weekday: "short",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "0";
  const year = Number(get("year"));
  const month = Number(get("month"));
  const day = Number(get("day"));
  const hour = Number(get("hour")) % 24;
  const minute = Number(get("minute"));
  const weekday = get("weekday");
  const dayOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekday); // 0 = Sunday

  // Offset of the zone from UTC at this moment, then the instant of local midnight
  const asUtc = Date.UTC(year, month - 1, day, hour, minute);
  const offsetMs = asUtc - Math.floor(now.getTime() / 60000) * 60000;
  const startOfDay = new Date(Date.UTC(year, month - 1, day) - offsetMs);
  const endOfDay = new Date(startOfDay.getTime() + 86400000);

  // Local midnight on the 1st of this month, as an instant
  const startOfMonth = new Date(Date.UTC(year, month - 1, 1) - offsetMs);

  return { year, month, day, hour, minute, dayOfWeek, startOfDay, endOfDay, startOfMonth, offsetMs };
}

/** YYYY-MM-DD of an instant as seen in the app's time zone. */
export function zonedDateKey(date: Date, timeZone: string = APP_TIME_ZONE): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

/** The instant of "HH:mm" on a YYYY-MM-DD calendar day in the app's time zone. */
export function zonedTime(dateKey: string, hm: string, timeZone: string = APP_TIME_ZONE): Date {
  const [h, m] = hm.split(":").map((n) => parseInt(n, 10) || 0);
  const guess = Date.parse(`${dateKey}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00Z`);
  const local = zonedNow(new Date(guess), timeZone);
  const asUtc = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute);
  const offset = asUtc - Math.floor(guess / 60000) * 60000;
  return new Date(guess - offset);
}

/** ISO weekday of a YYYY-MM-DD key: 1 = Monday ... 7 = Sunday. */
export function isoWeekday(dateKey: string): number {
  const d = new Date(`${dateKey}T12:00:00Z`).getUTCDay();
  return d === 0 ? 7 : d;
}
