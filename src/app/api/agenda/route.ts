import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getAgenda } from "@/lib/agenda";
import { zonedTime } from "@/lib/tz";
import { badRequest, readBody, serverError } from "@/lib/validate";
import { moveToTomorrow } from "@/lib/agendaMove";
import { calendarExtras } from "@/lib/calendarExtras";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };

/**
 * GET /api/agenda?month=2026-11  (the whole visible grid: a week either side of the month)
 *     /api/agenda?from=2026-11-01&to=2026-11-15
 * Everything with a time on it, in one list.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401, headers: noStore });

    const sp = new URL(req.url).searchParams;
    const month = sp.get("month");
    let from: Date;
    let to: Date;

    if (month) {
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
        return NextResponse.json({ success: false, error: "month must look like 2026-11" }, { status: 400, headers: noStore });
      }
      const [y, m] = month.split("-").map(Number);
      const first = `${y}-${String(m).padStart(2, "0")}-01`;
      const nextFirst = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
      from = new Date(zonedTime(first, "00:00").getTime() - 7 * 86400000);
      to = new Date(zonedTime(nextFirst, "00:00").getTime() + 7 * 86400000);
    } else {
      const f = sp.get("from");
      const t = sp.get("to");
      if (!f || !t || !/^\d{4}-\d{2}-\d{2}$/.test(f) || !/^\d{4}-\d{2}-\d{2}$/.test(t)) {
        return NextResponse.json({ success: false, error: "Use month=YYYY-MM or from/to as YYYY-MM-DD" }, { status: 400, headers: noStore });
      }
      from = zonedTime(f, "00:00");
      to = new Date(zonedTime(t, "00:00").getTime() + 86400000);
      if (to.getTime() - from.getTime() > 100 * 86400000 || to <= from) {
        return NextResponse.json({ success: false, error: "Range must be between 1 and 100 days" }, { status: 400, headers: noStore });
      }
    }

    const [{ items, overdue }, extras] = await Promise.all([getAgenda(user.id, from, to), calendarExtras(user.id, from, to)]);
    return NextResponse.json({ success: true, items: [...items, ...extras.items], overdue: [...overdue, ...extras.overdue] }, { headers: noStore });
  } catch (error) {
    return serverError("Failed to load the agenda", error, noStore);
  }
}

/**
 * POST /api/agenda  { action: "tomorrow", keys: ["TASK:<id>", "REMINDER:<id>", ...] }
 * Moves those items to tomorrow (same time of day). The Calendar uses it for one item or for all overdue ones.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401, headers: noStore });
    const body = await readBody(req);
    if (body.action !== "tomorrow" || !Array.isArray(body.keys)) return badRequest("Send action \"tomorrow\" and a list of keys", noStore);
    const keys = body.keys.filter((k: unknown): k is string => typeof k === "string" && k.length < 120).slice(0, 300);
    const moved = await moveToTomorrow(user.id, keys);
    return NextResponse.json({ success: true, moved }, { headers: noStore });
  } catch (error) {
    return serverError("Could not move those items", error, noStore);
  }
}
