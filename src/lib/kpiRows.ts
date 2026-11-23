import { prisma } from "@/lib/db";
import { autoKpiValue } from "@/lib/kpis";
import { zonedDateKey, zonedNow } from "@/lib/tz";

/** KPI figures as the Business pages show them; shared with the weekly review so the two always agree. */

export const monthKeyNow = () => zonedDateKey(new Date()).slice(0, 7);

/** The last six month keys, oldest first, in the user's calendar. */
export function lastMonths(count = 6): string[] {
  const z = zonedNow();
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(z.year, z.month - 1 - (count - 1 - i), 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}

export async function computeKpiRows(
  userId: string,
  businesses: { id: string; slug: string; clients: { status: string; billingCycle: string }[] }[]
) {
  const user = { id: userId };
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

  return { month, rows };
}
