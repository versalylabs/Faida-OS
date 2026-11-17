import type { BusinessItem } from "@/components/business/types";
import { daysFromToday } from "@/components/business/ui";

export interface AttentionItem {
  key: string;
  tone: "rose" | "amber" | "blue";
  text: string;
  detail?: string;
  businessId: string;
  businessName: string;
  businessSlug: string;
  businessColor: string;
}

/** What needs attention across the given businesses, most urgent first. Built only from real records. */
export function buildAttention(businesses: BusinessItem[]): AttentionItem[] {
  const out: (AttentionItem & { rank: number })[] = [];
  for (const b of businesses) {
    const base = { businessId: b.id, businessName: b.name, businessSlug: b.slug, businessColor: b.color };
    for (const d of b.deliverables) {
      if (d.status === "COMPLETED") continue;
      const days = daysFromToday(d.dueDate);
      if (days === null) continue;
      if (days < 0) out.push({ ...base, key: `d-${d.id}`, tone: "rose", rank: 0 + (days / 1000), text: `Overdue: ${d.title}`, detail: `${-days} day${days === -1 ? "" : "s"} late` });
      else if (days <= 3) out.push({ ...base, key: `d-${d.id}`, tone: "amber", rank: 2 + days / 10, text: `Due ${days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`}: ${d.title}` });
    }
    for (const c of b.clients) {
      if (c.status === "COMPLETED" || c.status === "PAUSED") continue;
      if (c.health === "AT_RISK") out.push({ ...base, key: `c-${c.id}`, tone: "rose", rank: 1, text: `Client at risk: ${c.name}` });
      else if (c.health === "ATTENTION") out.push({ ...base, key: `c-${c.id}`, tone: "amber", rank: 3, text: `Needs attention: ${c.name}` });
      if (c.status === "PROPOSAL") out.push({ ...base, key: `p-${c.id}`, tone: "blue", rank: 5, text: `Proposal sent to ${c.name}`, detail: "Follow up if you have not heard back" });
    }
    for (const p of b.purchases ?? []) {
      if (p.status === "BOUGHT") continue;
      const days = daysFromToday(p.neededBy);
      if (days !== null && days <= 7) out.push({ ...base, key: `b-${p.id}`, tone: days < 0 ? "rose" : "amber", rank: 4 + days / 100, text: `${days < 0 ? "Needed already" : "Needed soon"}: ${p.name}`, detail: "Equipment to buy" });
    }
  }
  return out.sort((a, b) => a.rank - b.rank).map(({ rank: _rank, ...item }) => item);
}
