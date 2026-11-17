/**
 * Shared business numbers, so the server, the overview and the company pages all agree.
 * Nothing here invents data: with no clients or no payments, every figure is simply 0.
 */

export interface MoneyClient {
  status: string;
  contractType: string;
  contractValue: number;
  billingCycle: string;
}

/** One stage of a business's sales pipeline. "open" = still being worked, "won" = paying, "closed" = finished or dropped. */
export interface StageDef {
  key: string;
  label: string;
  kind: "open" | "won" | "closed";
}

/** Straten's pipeline (the business plan's sales stages, condensed). */
export const DEFAULT_STAGES: StageDef[] = [
  { key: "LEAD", label: "Lead", kind: "open" },
  { key: "PROPOSAL", label: "Proposal sent", kind: "open" },
  { key: "ONBOARDING", label: "Onboarding", kind: "open" },
  { key: "ACTIVE", label: "Active", kind: "won" },
  { key: "COMPLETED", label: "Completed", kind: "closed" },
  { key: "PAUSED", label: "Paused", kind: "closed" },
];

/** VersalyLabs' pipeline: customer discovery through to a paying customer (its business plan, section 5.8). */
export const VERSALY_STAGES: StageDef[] = [
  { key: "IDENTIFIED", label: "Identified", kind: "open" },
  { key: "CONTACTED", label: "Contacted", kind: "open" },
  { key: "DISCOVERY", label: "Discovery done", kind: "open" },
  { key: "QUALIFIED", label: "Qualified", kind: "open" },
  { key: "DEMO", label: "Demo", kind: "open" },
  { key: "PROPOSAL", label: "Proposal sent", kind: "open" },
  { key: "PILOT", label: "Pilot active", kind: "open" },
  { key: "ACTIVE", label: "Paying customer", kind: "won" },
  { key: "LOST", label: "Lost or deferred", kind: "closed" },
];

export function stagesFor(slug?: string | null): StageDef[] {
  return (slug || "").toLowerCase() === "versaly" ? VERSALY_STAGES : DEFAULT_STAGES;
}

/** Every stage key that exists anywhere, with its label (a client may carry an older stage). */
export const STAGE_LABEL: Record<string, string> = {
  ...Object.fromEntries(DEFAULT_STAGES.map((s) => [s.key, s.label])),
  ...Object.fromEntries(VERSALY_STAGES.map((s) => [s.key, s.label])),
  ONBOARDING: "Onboarding",
  LEAD: "Lead",
};

/** Still being worked on: not a paying customer and not finished, paused or lost. */
export function isOpenStage(status: string): boolean {
  return !["ACTIVE", "COMPLETED", "PAUSED", "LOST"].includes(status);
}

/** VersalyLabs products a prospect can be interested in. Stored as a leading tag in the scope text. */
export const VERSALY_PRODUCTS = ["Melio RMS", "Mylkio", "Dukaset", "Other product"];

export function parseProductTag(scope?: string | null): { product: string | null; text: string } {
  const m = (scope || "").match(/^\[([^\]]{1,40})\]\s*([\s\S]*)$/);
  return m ? { product: m[1], text: m[2] } : { product: null, text: scope || "" };
}

export function withProductTag(product: string | null | undefined, text: string): string {
  return product ? `[${product}] ${text}`.trim() : text;
}

/** What one client brings in per month: recurring work only. One-off projects count as 0 here. */
export function monthlyValue(c: MoneyClient): number {
  if (c.status !== "ACTIVE") return 0;
  if (c.contractType === "ONE_TIME" || c.contractType === "MILESTONE") return 0;
  const v = Number.isFinite(c.contractValue) ? c.contractValue : 0;
  if (c.billingCycle === "MONTHLY") return v;
  if (c.billingCycle === "QUARTERLY") return v / 3;
  return 0; // PROJECT / ONE_TIME billing is not monthly recurring revenue
}

/** Monthly recurring revenue worked out from the clients, so it can never drift from them. */
export function computeMrr(clients: MoneyClient[]): number {
  return Math.round(clients.reduce((sum, c) => sum + monthlyValue(c), 0));
}

/** The value of work that is booked but not recurring (active one-off and milestone projects). */
export function projectValue(clients: MoneyClient[]): number {
  return Math.round(
    clients
      .filter((c) => c.status === "ACTIVE" && (c.contractType === "ONE_TIME" || c.contractType === "MILESTONE" || c.billingCycle === "PROJECT"))
      .reduce((sum, c) => sum + (Number.isFinite(c.contractValue) ? c.contractValue : 0), 0)
  );
}

export const INCOME_CATEGORIES = ["Client payment", "Retainer", "Deposit", "Project payment", "Referral", "Other income"];
export const EXPENSE_CATEGORIES = [
  "Equipment",
  "Software & subscriptions",
  "Marketing & ads",
  "Contractors & freelancers",
  "Hosting & domains",
  "Office & internet",
  "Taxes & fees",
  "Other expense",
];

export const PURCHASE_CATEGORIES: { value: string; label: string; expenseCategory: string }[] = [
  { value: "EQUIPMENT", label: "Equipment", expenseCategory: "Equipment" },
  { value: "SOFTWARE", label: "Software", expenseCategory: "Software & subscriptions" },
  { value: "MARKETING", label: "Marketing", expenseCategory: "Marketing & ads" },
  { value: "OFFICE", label: "Office", expenseCategory: "Office & internet" },
  { value: "OTHER", label: "Other", expenseCategory: "Other expense" },
];
