import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { autoKpiValue, defaultKpisFor, stratenKpiUpgrade } from "@/lib/kpis";
import { zonedDateKey, zonedNow } from "@/lib/tz";
import { ValidationError, badRequest, must, notFound, num, oneOf, ownedId, readBody, str } from "@/lib/validate";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const noCache = { "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate", Pragma: "no-cache", Expires: "0" };

const UNITS = ["COUNT", "PERCENT", "CURRENCY"] as const;
const PERIODS = ["MONTH", "TOTAL", "LEVEL"] as const;

const monthKeyNow = () => zonedDateKey(new Date()).slice(0, 7);

/** The last six month keys, oldest first, in the user's calendar. */
function lastMonths(count = 6): string[] {
  const z = zonedNow();
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(z.year, z.month - 1 - (count - 1 - i), 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}

/** Creates the plan's starting KPIs the first time a business is opened, so there is something to track. */
async function seedIfEmpty(userId: string, business: { id: string; slug: string }) {
  const existing = await prisma.businessKpi.findMany({ where: { businessId: business.id }, select: { key: true, name: true, target: true, sortOrder: true } });
  if (existing.length > 0) {
    // Straten: bring a set that is still on the first plan's targets up to the revised plan
    if (business.slug.toLowerCase() !== "straten") return;
    const { update, create } = stratenKpiUpgrade(existing);
    for (const u of update) await prisma.businessKpi.updateMany({ where: { businessId: business.id, key: u.key }, data: { target: u.target } });
    if (create.length > 0) {
      const next = Math.max(...existing.map((e) => e.sortOrder)) + 1;
      await prisma.businessKpi.createMany({
        data: create.map((d, i) => ({ userId, businessId: business.id, key: d.key, name: d.name, unit: d.unit, period: d.period, target: d.target, autoKey: d.autoKey ?? null, sortOrder: next + i })),
        skipDuplicates: true,
      });
    }
    return;
  }
  const defaults = defaultKpisFor(business.slug);
  if (defaults.length === 0) return;
  await prisma.businessKpi.createMany({
    data: defaults.map((d, i) => ({
      userId,
      businessId: business.id,
      key: d.key,
      name: d.name,
      unit: d.unit,
      period: d.period,
      target: d.target,
      autoKey: d.autoKey ?? null,
      sortOrder: i,
    })),
    skipDuplicates: true,
  });
}

/** KPIs for one business, or for all of them: each with this month's figure, the total, last month and a short history. */
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401, headers: noCache });

    const filter = new URL(req.url).searchParams.get("businessId");
    const onlyId = filter ? await ownedId("business", user.id, filter) : null;
    if (filter && !onlyId) return notFound("Business not found", noCache);

    const businesses = await prisma.business.findMany({
      where: { userId: user.id, ...(onlyId ? { id: onlyId } : {}) },
      select: { id: true, name: true, slug: true, color: true, clients: { select: { status: true, billingCycle: true } } },
      orderBy: { createdAt: "asc" },
    });
    for (const b of businesses) await seedIfEmpty(user.id, b);

    const month = monthKeyNow();
    const months = lastMonths(6);
    const monthStart = zonedNow().startOfMonth;

    const [kpis, income] = await Promise.all([
      prisma.businessKpi.findMany({
        where: { userId: user.id, businessId: { in: businesses.map((b) => b.id) } },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        include: { logs: true },
      }),
      prisma.financeTransaction.findMany({
        where: { userId: user.id, businessId: { in: businesses.map((b) => b.id) }, amount: { gt: 0 }, date: { gte: monthStart } },
        select: { businessId: true, amount: true },
      }),
    ]);
    const incomeBy = new Map<string, number>();
    for (const t of income) if (t.businessId) incomeBy.set(t.businessId, (incomeBy.get(t.businessId) || 0) + t.amount);

    const rows = kpis.map((k) => {
      const biz = businesses.find((b) => b.id === k.businessId)!;
      const logByMonth = new Map(k.logs.map((l) => [l.month, l.value]));
      const thisMonth = logByMonth.get(month) ?? 0;
      const total = k.logs.reduce((s, l) => s + l.value, 0);
      const latest = [...k.logs].sort((a, b) => (a.month < b.month ? 1 : -1))[0]?.value ?? 0;
      let value: number;
      if (k.autoKey) value = autoKpiValue(k.autoKey, biz.slug, biz.clients, incomeBy.get(biz.id) || 0);
      else value = k.period === "TOTAL" ? total : k.period === "LEVEL" ? latest : thisMonth;
      return {
        id: k.id,
        businessId: k.businessId,
        key: k.key,
        name: k.name,
        unit: k.unit,
        period: k.period,
        target: k.target,
        auto: !!k.autoKey,
        autoKey: k.autoKey,
        value,
        thisMonth,
        total,
        percent: k.target > 0 ? Math.round((value / k.target) * 100) : null,
        history: months.map((m) => ({ month: m, value: logByMonth.get(m) ?? 0 })),
      };
    });

    return NextResponse.json(
      { success: true, month, businesses: businesses.map((b) => ({ id: b.id, name: b.name, slug: b.slug, color: b.color })), kpis: rows },
      { headers: noCache }
    );
  } catch (error: any) {
    if (error instanceof ValidationError) return badRequest(error.message);
    console.error("Error loading KPIs:", error);
    return NextResponse.json({ success: false, error: "Failed to load KPIs" }, { status: 500, headers: noCache });
  }
}

/** Add your own KPI. */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401, headers: noCache });

    const body = await readBody(req);
    const businessId = await ownedId("business", user.id, body.businessId);
    if (!businessId) return notFound("Business not found", noCache);
    const name = must(str(body.name, { max: 80, required: true }), "Name is required (max 80 characters)");
    const unit = must(oneOf(body.unit, UNITS), "Invalid unit") ?? "COUNT";
    const period = must(oneOf(body.period, PERIODS), "Invalid period") ?? "MONTH";
    const target = must(num(body.target, { min: 0, max: 1e12 }), "Target must be a number, 0 or more") ?? 0;

    const last = await prisma.businessKpi.findFirst({ where: { businessId }, orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
    // A key that cannot clash with the plan's own keys
    const key = `custom-${Date.now().toString(36)}`;
    const kpi = await prisma.businessKpi.create({
      data: { userId: user.id, businessId, key, name, unit, period, target, sortOrder: (last?.sortOrder ?? -1) + 1 },
    });
    return NextResponse.json({ success: true, kpi }, { headers: noCache });
  } catch (error: any) {
    if (error instanceof ValidationError) return badRequest(error.message);
    console.error("Error creating KPI:", error);
    return NextResponse.json({ success: false, error: "Failed to create the KPI" }, { status: 500, headers: noCache });
  }
}

/**
 * Edit a KPI (name, target, unit, period), or record a figure for it:
 *   { id, add: 3 }                  add to this month's figure (use a negative number to take away)
 *   { id, setValue: 12, month? }    set a month's figure (this month by default)
 */
export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401, headers: noCache });

    const body = await readBody(req);
    if (typeof body.id !== "string" || !body.id || body.id.length > 100) throw new ValidationError("KPI ID is required");
    const kpi = await prisma.businessKpi.findFirst({ where: { id: body.id, userId: user.id } });
    if (!kpi) return notFound("KPI not found", noCache);

    const month = typeof body.month === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(body.month) ? body.month : monthKeyNow();

    if (body.add !== undefined || body.setValue !== undefined) {
      if (kpi.autoKey) throw new ValidationError("This figure is worked out from your clients and money. Update those instead.");
      const existing = await prisma.businessKpiLog.findUnique({ where: { kpiId_month: { kpiId: kpi.id, month } } });
      let next: number;
      if (body.setValue !== undefined) next = must(num(body.setValue, { min: 0, max: 1e12, required: true }), "Value must be a number, 0 or more");
      else {
        const delta = must(num(body.add, { min: -1e9, max: 1e9, required: true }), "Amount must be a number");
        next = Math.max(0, (existing?.value ?? 0) + delta);
      }
      const log = await prisma.businessKpiLog.upsert({
        where: { kpiId_month: { kpiId: kpi.id, month } },
        create: { kpiId: kpi.id, month, value: next },
        update: { value: next },
      });
      return NextResponse.json({ success: true, log }, { headers: noCache });
    }

    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = must(str(body.name, { max: 80, required: true }), "Name is required (max 80 characters)");
    if (body.target !== undefined) data.target = must(num(body.target, { min: 0, max: 1e12, required: true }), "Target must be a number, 0 or more");
    if (body.unit !== undefined) data.unit = must(oneOf(body.unit, UNITS, { required: true }), "Invalid unit");
    if (body.period !== undefined) data.period = must(oneOf(body.period, PERIODS, { required: true }), "Invalid period");
    const updated = await prisma.businessKpi.update({ where: { id: kpi.id }, data });
    return NextResponse.json({ success: true, kpi: updated }, { headers: noCache });
  } catch (error: any) {
    if (error instanceof ValidationError) return badRequest(error.message);
    console.error("Error updating KPI:", error);
    return NextResponse.json({ success: false, error: "Failed to update the KPI" }, { status: 500, headers: noCache });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401, headers: noCache });
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ success: false, error: "KPI ID is required" }, { status: 400, headers: noCache });
    const result = await prisma.businessKpi.deleteMany({ where: { id, userId: user.id } });
    if (result.count === 0) return notFound("KPI not found", noCache);
    return NextResponse.json({ success: true }, { headers: noCache });
  } catch (error: any) {
    console.error("Error deleting KPI:", error);
    return NextResponse.json({ success: false, error: "Failed to delete the KPI" }, { status: 500, headers: noCache });
  }
}
