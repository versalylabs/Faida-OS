"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Briefcase, Edit3, TrendingUp, Users, Wallet, Banknote } from "lucide-react";
import { formatKES } from "@/lib/utils";
import { STAGE_LABEL, isOpenStage, stagesFor } from "@/lib/businessMath";
import { STRATEN_CATALOG, STRATEN_PROFILE } from "@/lib/playbooks";
import { useBusinessData } from "@/components/business/useBusinessData";
import { buildAttention } from "@/components/business/attention";
import { ClientsSection, type CatalogEntry } from "@/components/business/Clients";
import { DeliverablesSection } from "@/components/business/Deliverables";
import { MoneySection } from "@/components/business/Money";
import { PurchasesSection } from "@/components/business/Purchases";
import { ActivitySection } from "@/components/business/Activity";
import { KpiSection, KpiSummary, useKpis } from "@/components/business/Kpis";
import { StratenPlan } from "@/components/business/StratenPlan";
import { VersalyPlan } from "@/components/business/VersalyPlan";
import { PortfolioSection } from "@/components/business/Portfolio";
import { VERSALY_PROFILE } from "@/lib/versalyPlaybook";
import { EditBusinessModal } from "@/components/business/EditBusinessModal";
import { Badge, Card, EmptyState, ProgressBar, Skeleton, Stat, dayLabel } from "@/components/business/ui";

type Tab = "overview" | "kpis" | "clients" | "work" | "money" | "equipment" | "activity" | "plan" | "products";

const TAB_LABEL: Record<Tab, string> = {
  overview: "Overview",
  kpis: "KPIs",
  clients: "Clients",
  work: "Client work",
  money: "Money",
  equipment: "Equipment",
  activity: "Sales activity",
  plan: "Business plan",
  products: "Products",
};

const STRATEN_CLIENT_CATALOG: CatalogEntry[] = STRATEN_CATALOG.map((c) => ({ name: c.name, price: c.price, billing: c.billing, scope: c.scope }));

/** KPI progress on the overview tab. Its own component so it only asks for this business's numbers. */
function KpiOverviewCard({ businessId, onOpen }: { businessId: string; onOpen: () => void }) {
  const { kpis, loading } = useKpis(businessId);
  return (
    <Card
      title="KPIs this month"
      action={
        <button onClick={onOpen} className="text-[11px] text-blue-400 hover:underline cursor-pointer">
          Update numbers
        </button>
      }
    >
      <KpiSummary kpis={kpis} loading={loading} limit={5} onOpen={onOpen} />
    </Card>
  );
}

export default function BusinessCompanyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { businesses, loading, error, reload } = useBusinessData();
  const [tab, setTab] = useState<Tab>("overview");
  const [editing, setEditing] = useState(false);

  const business = businesses.find((b) => b.slug.toLowerCase() === slug.toLowerCase());
  const isStraten = slug.toLowerCase() === "straten";
  const isVersaly = slug.toLowerCase() === "versaly";
  const tabs: Tab[] = isStraten
    ? ["overview", "kpis", "clients", "work", "money", "equipment", "activity", "plan"]
    : isVersaly
    ? ["overview", "kpis", "clients", "products", "plan", "work", "money", "equipment", "activity"]
    : ["overview", "kpis", "clients", "work", "money", "equipment", "activity"];

  // Keep the chosen tab when the page is reloaded
  useEffect(() => {
    const hash = window.location.hash.replace("#", "") as Tab;
    if (hash && tabs.includes(hash)) setTab(hash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);
  const choose = (t: Tab) => {
    setTab(t);
    window.history.replaceState(null, "", `#${t}`);
  };

  if (!loading && !business) {
    return (
      <div className="max-w-xl mx-auto text-center py-24 space-y-3">
        <div className="text-sm text-slate-300">{error || "That business was not found."}</div>
        <Link href="/business" className="text-xs text-blue-400 hover:underline">
          Back to Business overview
        </Link>
      </div>
    );
  }

  const color = business?.color ?? "#3b82f6";
  const attention = business ? buildAttention([business]) : [];
  const openClients = business?.clients.filter((c) => isOpenStage(c.status)) ?? [];
  const pipelineValue = openClients.reduce((a, c) => a + (c.contractValue || 0), 0);
  const activeClients = business?.clients.filter((c) => c.status === "ACTIVE").length ?? 0;
  const mrrPercent = business && business.targetMrr > 0 ? (business.mrr / business.targetMrr) * 100 : 0;
  const toBuy = business?.purchases.filter((p) => p.status !== "BOUGHT") ?? [];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="space-y-4">
        <Link href="/business" className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>All businesses</span>
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider mb-1" style={{ color }}>
              <Briefcase className="h-3.5 w-3.5" />
              Business workspace
            </div>
            {loading ? (
              <Skeleton className="h-9 w-56" />
            ) : (
              <h1 className="text-2xl lg:text-3xl font-bold text-white flex items-center gap-3 break-words">
                <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
                {business!.name}
              </h1>
            )}
            {!loading && <p className="text-xs text-slate-400 mt-1">{business!.type}</p>}
          </div>
          {!loading && (
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors cursor-pointer shrink-0 self-start"
            >
              <Edit3 className="h-3.5 w-3.5 text-blue-400" />
              Edit business
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs -mx-1 px-1">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => choose(t)}
              className={`px-3.5 py-1.5 rounded-xl font-medium whitespace-nowrap cursor-pointer transition-all ${
                tab === t ? "bg-blue-600 text-white font-semibold shadow-md shadow-blue-500/10" : "bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-slate-800"
              }`}
            >
              {TAB_LABEL[t]}
            </button>
          ))}
        </div>
      </div>

      {error && !loading && <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">{error}</div>}

      {tab === "overview" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <Stat
              label="Monthly recurring revenue"
              loading={loading}
              value={formatKES(business?.mrr ?? 0)}
              icon={<TrendingUp className="h-4 w-4 text-emerald-400" />}
              sub={
                business && business.targetMrr > 0 ? (
                  <div className="space-y-1.5">
                    <ProgressBar percent={mrrPercent} color={color} />
                    <span>
                      {Math.round(mrrPercent)}% of {formatKES(business.targetMrr)} target
                    </span>
                  </div>
                ) : (
                  "From active monthly clients. Set a target with Edit business."
                )
              }
            />
            <Stat label="Active clients" loading={loading} value={activeClients} icon={<Users className="h-4 w-4 text-blue-400" />} sub={`${openClients.length} in the pipeline`} />
            <Stat label="Pipeline value" loading={loading} value={formatKES(pipelineValue)} sub="Leads, proposals and onboarding" icon={<Banknote className="h-4 w-4 text-purple-400" />} />
            <Stat
              label="Net this month"
              loading={loading}
              value={formatKES(business?.monthNet ?? 0)}
              tone={(business?.monthNet ?? 0) < 0 ? "bad" : "default"}
              sub={`${formatKES(business?.monthIncome ?? 0)} in, ${formatKES(business?.monthExpense ?? 0)} out`}
              icon={<Wallet className="h-4 w-4 text-amber-400" />}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 space-y-4">
              <Card title="Needs attention">
                {loading ? (
                  <Skeleton className="h-16 w-full" />
                ) : attention.length === 0 ? (
                  <EmptyState>Nothing needs attention right now.</EmptyState>
                ) : (
                  <div className="space-y-2">
                    {attention.slice(0, 8).map((a) => (
                      <div key={a.key} className="flex items-start gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                        <span className={`mt-1 h-2 w-2 rounded-full shrink-0 ${a.tone === "rose" ? "bg-rose-400" : a.tone === "amber" ? "bg-amber-400" : "bg-blue-400"}`} />
                        <div className="min-w-0 text-xs">
                          <div className="text-slate-100 break-words">{a.text}</div>
                          {a.detail && <div className="text-[11px] text-slate-500">{a.detail}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <KpiOverviewCard businessId={business?.id ?? ""} onOpen={() => choose("kpis")} />

              <Card title="Sales pipeline">
                {loading ? (
                  <Skeleton className="h-16 w-full" />
                ) : business!.clients.length === 0 ? (
                  <EmptyState>
                    No clients yet.{" "}
                    <button onClick={() => choose("clients")} className="text-blue-400 hover:underline cursor-pointer">
                      Add the first lead
                    </button>
                    .
                  </EmptyState>
                ) : (
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,6.5rem),1fr))] gap-2">
                    {stagesFor(business!.slug).map((s) => {
                      const n = business!.clients.filter((c) => c.status === s.key).length;
                      return (
                        <button key={s.key} onClick={() => choose("clients")} className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 text-center cursor-pointer transition-colors">
                          <div className="text-lg font-bold font-mono text-white">{n}</div>
                          <div className="text-[10px] text-slate-500">{STAGE_LABEL[s.key] ?? s.label}</div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </Card>
            </div>

            <div className="space-y-4">
              <Card title="About">
                {loading ? (
                  <Skeleton className="h-20 w-full" />
                ) : (
                  <div className="space-y-2 text-xs text-slate-300 leading-relaxed">
                    <p>{business!.description || "No description yet. Use Edit business to add one."}</p>
                    {isVersaly && (
                      <>
                        <p className="text-blue-300 font-semibold">{VERSALY_PROFILE.oneLiner}</p>
                        <p className="text-slate-400">
                          {VERSALY_PROFILE.focus}{" "}
                          <button onClick={() => choose("plan")} className="text-blue-400 hover:underline cursor-pointer">
                            Open the plan
                          </button>
                          {" "}or see the{" "}
                          <button onClick={() => choose("products")} className="text-blue-400 hover:underline cursor-pointer">
                            28 products
                          </button>
                          .
                        </p>
                      </>
                    )}
                    {isStraten && (
                      <>
                        <p className="text-amber-300 font-semibold">{STRATEN_PROFILE.tagline}</p>
                        <p className="text-slate-400">
                          Current focus: the new business plan.{" "}
                          <button onClick={() => choose("plan")} className="text-blue-400 hover:underline cursor-pointer">
                            Open the plan
                          </button>
                          . {STRATEN_PROFILE.note}
                        </p>
                      </>
                    )}
                  </div>
                )}
              </Card>

              <Card title={`To buy (${toBuy.length})`}>
                {loading ? (
                  <Skeleton className="h-12 w-full" />
                ) : toBuy.length === 0 ? (
                  <EmptyState>Nothing on the shopping list.</EmptyState>
                ) : (
                  <div className="space-y-2">
                    {toBuy.slice(0, 4).map((p) => (
                      <div key={p.id} className="flex items-center justify-between gap-3 text-xs">
                        <span className="text-slate-200 truncate">{p.name}</span>
                        <span className="font-mono text-slate-400 shrink-0">{formatKES(p.estimatedCost)}</span>
                      </div>
                    ))}
                    <button onClick={() => choose("equipment")} className="text-[11px] text-blue-400 hover:underline cursor-pointer">
                      See the full list
                    </button>
                  </div>
                )}
              </Card>

              <Card title="Next deadlines">
                {loading ? (
                  <Skeleton className="h-12 w-full" />
                ) : (
                  (() => {
                    const next = business!.deliverables
                      .filter((d) => d.status !== "COMPLETED" && d.dueDate)
                      .sort((a, b) => Date.parse(a.dueDate!) - Date.parse(b.dueDate!))
                      .slice(0, 4);
                    return next.length === 0 ? (
                      <EmptyState>No dated client work.</EmptyState>
                    ) : (
                      <div className="space-y-2">
                        {next.map((d) => (
                          <div key={d.id} className="flex items-center justify-between gap-3 text-xs">
                            <span className="text-slate-200 truncate">{d.title}</span>
                            <Badge tone="slate">{dayLabel(d.dueDate)}</Badge>
                          </div>
                        ))}
                      </div>
                    );
                  })()
                )}
              </Card>
            </div>
          </div>
        </div>
      )}

      {tab === "kpis" && business && <KpiSection businessId={business.id} businessName={business.name} onChanged={reload} />}
      {tab === "clients" && business && (
        <ClientsSection business={business} businesses={businesses} catalog={isStraten ? STRATEN_CLIENT_CATALOG : undefined} onChanged={reload} />
      )}
      {tab === "work" && business && (
        <DeliverablesSection items={business.deliverables} businesses={businesses} defaultBusinessId={business.id} onChanged={reload} />
      )}
      {tab === "money" && business && <MoneySection businesses={businesses} businessId={business.id} defaultBusinessId={business.id} onChanged={reload} />}
      {tab === "equipment" && business && <PurchasesSection businesses={businesses} businessId={business.id} defaultBusinessId={business.id} onChanged={reload} />}
      {tab === "activity" && business && <ActivitySection business={business} onChanged={reload} variant={isVersaly ? "versaly" : "default"} />}
      {tab === "plan" && business && isStraten && <StratenPlan business={business} />}
      {tab === "plan" && business && isVersaly && <VersalyPlan business={business} />}
      {tab === "products" && business && isVersaly && <PortfolioSection />}

      {editing && business && <EditBusinessModal business={business} onClose={() => setEditing(false)} onSaved={reload} />}
    </div>
  );
}
