import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { buildLivePlan, lockPlan, lockedView, paramsFrom } from "@/lib/planner/daily";
import type { DayPlan } from "@/lib/planner/scheduler";
import { zonedDateKey } from "@/lib/tz";
import { ValidationError, badRequest, readBody } from "@/lib/validate";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const noCacheHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

/**
 * GET /api/planner?hours=4.5
 * With a plan locked in for today, that plan is returned (with finished work ticked). Otherwise the plan is
 * rebuilt from the live data on every request, starting from the current time in the user's time zone and
 * working around today's events and classes.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401, headers: noCacheHeaders });
    }

    const { searchParams } = new URL(req.url);
    const live = await buildLivePlan(user.id, paramsFrom((k) => searchParams.get(k)));
    const saved = await prisma.dailyPlan.findUnique({ where: { userId_dateKey: { userId: user.id, dateKey: live.todayKey } } });

    const plan = saved ? await lockedView(user.id, saved.plan as unknown as DayPlan, live.deferred) : live.plan;
    return NextResponse.json(
      {
        success: true,
        plan,
        locked: saved ? { at: saved.updatedAt.toISOString(), budgetMinutes: saved.budgetMinutes } : null,
        now: { minutes: live.nowMin, dateLabel: live.dateLabel },
      },
      { headers: noCacheHeaders }
    );
  } catch (error: any) {
    if (error instanceof ValidationError) return badRequest(error.message);
    console.error("Error building daily plan:", error);
    return NextResponse.json({ success: false, error: "Failed to generate plan" }, { status: 500, headers: noCacheHeaders });
  }
}

/**
 * POST /api/planner
 *   { action: "lock", hours }  lock in today's plan, built fresh from now. Locking again later keeps the
 *                              blocks already behind you and replans the rest of the day.
 *   { action: "unlock" }       go back to a plan that is rebuilt on every visit
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401, headers: noCacheHeaders });
    }
    const body = await readBody(req);
    const todayKey = zonedDateKey(new Date());

    if (body.action === "unlock") {
      await prisma.dailyPlan.deleteMany({ where: { userId: user.id, dateKey: todayKey } });
      return NextResponse.json({ success: true }, { headers: noCacheHeaders });
    }
    if (body.action !== "lock") return badRequest("Unknown planner action");

    const params = paramsFrom((k) => (body[k] === undefined || body[k] === null ? null : String(body[k])));
    const { plan, saved, live } = await lockPlan(user.id, params);

    return NextResponse.json(
      {
        success: true,
        plan: await lockedView(user.id, plan, live.deferred),
        locked: { at: saved.updatedAt.toISOString(), budgetMinutes: saved.budgetMinutes },
        now: { minutes: live.nowMin, dateLabel: live.dateLabel },
      },
      { headers: noCacheHeaders }
    );
  } catch (error: any) {
    if (error instanceof ValidationError) return badRequest(error.message);
    console.error("Error locking daily plan:", error);
    return NextResponse.json({ success: false, error: "Failed to save the plan" }, { status: 500, headers: noCacheHeaders });
  }
}
