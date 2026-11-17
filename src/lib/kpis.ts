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
  { key: "researched", name: "New prospects researched", unit: "COUNT", period: "MONTH", target: 200, hint: "Businesses you looked into this month" },
  { key: "qualified", name: "Qualified prospects", unit: "COUNT", period: "MONTH", target: 60, hint: "Prospects that fit and could pay" },
  { key: "outreach", name: "Personalised outreach contacts", unit: "COUNT", period: "MONTH", target: 100, hint: "Personal messages sent" },
  { key: "conversations", name: "Meaningful conversations", unit: "COUNT", period: "MONTH", target: 20, hint: "Real two-way conversations" },
  { key: "consultations", name: "Consultations", unit: "COUNT", period: "MONTH", target: 10, hint: "Consultations and audits held" },
  { key: "paying", name: "Paying customers", unit: "COUNT", period: "TOTAL", target: 5, autoKey: "paying", hint: "Clients marked Active or Completed" },
  { key: "recurring", name: "Recurring customers", unit: "COUNT", period: "TOTAL", target: 2, autoKey: "recurring", hint: "Active clients billed monthly or quarterly" },
  { key: "satisfaction", name: "Customer satisfaction", unit: "PERCENT", period: "LEVEL", target: 85, hint: "Latest figure, aim for 85% or more" },
  { key: "revenue", name: "Revenue collected", unit: "CURRENCY", period: "MONTH", target: 40000, autoKey: "revenue", hint: "Money in recorded for this business this month" },
];

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
