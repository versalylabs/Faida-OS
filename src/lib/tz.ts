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
