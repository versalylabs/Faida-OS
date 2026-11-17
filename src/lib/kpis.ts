import { stagesFor } from "@/lib/businessMath";

/**
 * The numbers each business tracks. The starting lists come from the business plans (Straten's monthly management
 * targets; VersalyLabs' validation targets). Targets are the plan's proposals, not forecasts, and every one of them
 * can be edited, and you can add your own.
 */

export type KpiUnit = "COUNT" | "PERCENT" | "CURRENCY";
export type KpiPeriod = "MONTH" | "TOTAL" | "LEVEL";

export interface KpiDefault {
  key: string;
  name: string;
  unit: KpiUnit;
  period: KpiPeriod;
  target: number;
  autoKey?: string;
  hint?: string;
}

/** autoKey values: "revenue" (money in this month), "paying", "recurring", "reached:STAGE" (pipeline stage reached). */

export const STRATEN_KPIS: KpiDefault[] = [
  { key: "researched", name: "New prospects researched", unit: "COUNT", period: "MONTH", target: 150, hint: "Businesses you looked into this month" },
  { key: "qualified", name: "Qualified prospects", unit: "COUNT", period: "MONTH", target: 50, hint: "Prospects scoring 60 or more" },
  { key: "outreach", name: "Personalised outreach contacts", unit: "COUNT", period: "MONTH", target: 60, hint: "Qualified and warm prospects only, never more than that" },
  { key: "conversations", name: "Meaningful conversations", unit: "COUNT", period: "MONTH", target: 15, hint: "Replies and real two-way conversations" },
  { key: "consultations", name: "Consultations", unit: "COUNT", period: "MONTH", target: 10, hint: "Consultations and audits held" },
  { key: "proposals", name: "Quotations or proposals sent", unit: "COUNT", period: "MONTH", target: 8, hint: "Quotes and proposals you sent this month" },
  { key: "paying", name: "Paying customers", unit: "COUNT", period: "TOTAL", target: 5, autoKey: "paying", hint: "Clients marked Active or Completed. Three by 31 Dec, five by 31 Jan" },
  { key: "recurring", name: "Recurring customers", unit: "COUNT", period: "TOTAL", target: 2, autoKey: "recurring", hint: "Active clients billed monthly or quarterly" },
  { key: "contribution", name: "Contribution per founder hour", unit: "CURRENCY", period: "LEVEL", target: 500, hint: "Latest figure: price minus direct costs, divided by your hours. Keep it at KSh 500 or more" },
  { key: "satisfaction", name: "Customer satisfaction", unit: "PERCENT", period: "LEVEL", target: 80, hint: "Latest rating as a percent. The plan's 4 out of 5 is 80%" },
  { key: "revenue", name: "Revenue collected", unit: "CURRENCY", period: "MONTH", target: 30000, autoKey: "revenue", hint: "Money in recorded for this business this month. The plan expects KSh 30,000 in Dec" },
];

/** What version 1 of the Straten plan seeded, so an untouched KPI can be moved to version 2 without overwriting your edits. */
const STRATEN_V1: Record<string, { name: string; target: number }> = {
  researched: { name: "New prospects researched", target: 200 },
  qualified: { name: "Qualified prospects", target: 60 },
  outreach: { name: "Personalised outreach contacts", target: 100 },
  conversations: { name: "Meaningful conversations", target: 20 },
  satisfaction: { name: "Customer satisfaction", target: 85 },
  revenue: { name: "Revenue collected", target: 40000 },
};

export interface KpiRowLite {
  key: string;
  name: string;
  target: number;
}

/**
 * Moves a Straten KPI set that is still on version 1 targets to version 2: untouched targets are updated, and the
 * KPIs version 2 adds are created. Does nothing once any version 2 KPI exists, so deleting one is never undone.
 */
export function stratenKpiUpgrade(existing: KpiRowLite[]): { update: { key: string; target: number }[]; create: KpiDefault[] } {
  const by = new Map(existing.map((k) => [k.key, k]));
  const stillV1 = Object.entries(STRATEN_V1).some(([key, v]) => by.get(key)?.target === v.target);
  if (!stillV1 || by.has("proposals") || by.has("contribution")) return { update: [], create: [] };
  const update: { key: string; target: number }[] = [];
  for (const d of STRATEN_KPIS) {
    const cur = by.get(d.key);
    const old = STRATEN_V1[d.key];
    if (cur && old && cur.target === old.target && cur.target !== d.target) update.push({ key: d.key, target: d.target });
  }
  const create = STRATEN_KPIS.filter((d) => !by.has(d.key) && (d.key === "proposals" || d.key === "contribution"));
  return { update, create };
}

export const VERSALY_KPIS: KpiDefault[] = [
  { key: "interviews", name: "Customer discovery interviews", unit: "COUNT", period: "TOTAL", target: 30, autoKey: "reached:DISCOVERY", hint: "Prospects that reached Discovery done or later. The plan aims for 30 to 45." },
  { key: "contacted", name: "Businesses contacted", unit: "COUNT", period: "TOTAL", target: 50, autoKey: "reached:CONTACTED", hint: "Prospects that reached Contacted or later" },
  { key: "demos", name: "Product demonstrations", unit: "COUNT", period: "TOTAL", target: 10, autoKey: "reached:DEMO", hint: "Prospects that reached Demo or later" },
  { key: "qualified", name: "Qualified pilot opportunities", unit: "COUNT", period: "TOTAL", target: 3, autoKey: "reached:QUALIFIED", hint: "Qualified, in demo, proposal, pilot or paying" },
  { key: "pilots", name: "Pilots started", unit: "COUNT", period: "TOTAL", target: 3, autoKey: "reached:PILOT", hint: "Pilot active or beyond. The plan aims for 3 to 5 pilots." },
  { key: "paying", name: "Paying customers", unit: "COUNT", period: "TOTAL", target: 1, autoKey: "paying", hint: "First recurring revenue is a 6 to 9 month milestone" },
  { key: "outreach", name: "Outreach messages sent", unit: "COUNT", period: "MONTH", target: 0, hint: "Add a target when you know your pace" },
  { key: "revenue", name: "Revenue collected", unit: "CURRENCY", period: "MONTH", target: 0, autoKey: "revenue", hint: "Money in recorded for this business this month" },
];

export function defaultKpisFor(slug: string): KpiDefault[] {
  const s = slug.toLowerCase();
  return s === "versaly" ? VERSALY_KPIS : s === "straten" ? STRATEN_KPIS : [];
}

export interface KpiClient {
  status: string;
  billingCycle: string;
}

/** The value of an automatic KPI, from the business's clients and this month's money in. */
export function autoKpiValue(autoKey: string, slug: string, clients: KpiClient[], monthIncome: number): number {
  if (autoKey === "revenue") return Math.round(monthIncome);
  if (autoKey === "paying") return clients.filter((c) => c.status === "ACTIVE" || c.status === "COMPLETED").length;
  if (autoKey === "recurring") return clients.filter((c) => c.status === "ACTIVE" && (c.billingCycle === "MONTHLY" || c.billingCycle === "QUARTERLY")).length;
  if (autoKey.startsWith("reached:")) {
    // A prospect that got to a stage counts, even if it has moved on to a later one
    const order = stagesFor(slug).filter((s) => s.kind !== "closed").map((s) => s.key);
    const from = order.indexOf(autoKey.slice("reached:".length));
    if (from < 0) return 0;
    return clients.filter((c) => order.indexOf(c.status) >= from).length;
  }
  return 0;
}

export function formatKpiValue(value: number, unit: string): string {
  if (unit === "PERCENT") return `${Math.round(value * 10) / 10}%`;
  if (unit === "CURRENCY") return `KES ${Math.round(value).toLocaleString("en-KE")}`;
  return String(Math.round(value * 100) / 100);
}
