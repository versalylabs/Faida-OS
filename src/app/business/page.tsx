"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowDownLeft, ArrowRight, ArrowUpRight, Briefcase, Building2, Plus, ShoppingBag, TrendingUp, UserPlus, Users, Wallet } from "lucide-react";
import { formatKES } from "@/lib/utils";
import { isOpenStage } from "@/lib/businessMath";
import { useBusinessData } from "@/components/business/useBusinessData";
import { buildAttention } from "@/components/business/attention";
import { ClientModal } from "@/components/business/Clients";
import { DeliverableModal, DeliverablesSection } from "@/components/business/Deliverables";
import { TransactionModal } from "@/components/business/Money";
import { Card, EmptyState, ProgressBar, Skeleton, Stat } from "@/components/business/ui";

type QuickAction = null | "client" | "deliverable" | "income" | "expense";

/** All businesses at a glance: money, clients, work and what needs attention. Every figure comes from your records. */
export default function BusinessOverviewPage() {
  const { businesses, summary, loading, error, reload } = useBusinessData();
  const [action, setAction] = useState<QuickAction>(null);
  const attention = buildAttention(businesses);
  const defaultId = businesses[0]?.id ?? "";
  const allDeliverables = businesses.flatMap((b) => b.deliverables);
  const openPipeline = businesses.flatMap((b) => b.clients).filter((c) => isOpenStage(c.status));
  const toBuy = businesses.flatMap((b) => b.purchases).filter((p) => p.status !== "BOUGHT");

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-blue-400 font-mono tracking-wider uppercase mb-1">
            <Briefcase className="h-3.5 w-3.5" />
            Business &amp; Ventures
          </div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-white">Business overview</h1>
          <p className="text-xs text-slate-400 mt-0.5">All your businesses together: money, clients, client work and what needs you.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setAction("client")} disabled={!defaultId} className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold cursor-pointer disabled:opacity-50">
            <UserPlus className="h-3.5 w-3.5" /> Client
          </button>
          <button onClick={() => setAction("deliverable")} disabled={!defaultId} className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold cursor-pointer disabled:opacity-50">
            <Plus className="h-3.5 w-3.5" /> Deliverable
          </button>
          <button onClick={() => setAction("income")} disabled={!defaultId} className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold cursor-pointer disabled:opacity-50">
            <ArrowDownLeft className="h-3.5 w-3.5 text-emerald-400" /> Money in
          </button>
          <button onClick={() => setAction("expense")} disabled={!defaultId} className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold cursor-pointer disabled:opacity-50">
            <ArrowUpRight className="h-3.5 w-3.5 text-rose-400" /> Money out
          </button>
        </div>
      </div>

      {error && !loading && <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">{error}</div>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Stat label="Monthly recurring revenue" loading={loading} value={formatKES(summary?.totalMrr ?? 0)} sub="From active monthly clients" icon={<TrendingUp className="h-4 w-4 text-emerald-400" />} />
        <Stat label="Active clients" loading={loading} value={summary?.activeClientsCount ?? 0} sub={`${openPipeline.length} in the pipeline`} icon={<Users className="h-4 w-4 text-blue-400" />} />
        <Stat
          label="Net this month"
          loading={loading}
          value={formatKES(summary?.monthNet ?? 0)}
          tone={(summary?.monthNet ?? 0) < 0 ? "bad" : "default"}
          sub={`${formatKES(summary?.monthIncome ?? 0)} in, ${formatKES(summary?.monthExpense ?? 0)} out`}
          icon={<Wallet className="h-4 w-4 text-amber-400" />}
        />
        <Stat label="Client work open" loading={loading} value={summary?.pendingDeliverablesCount ?? 0} sub={`${attention.filter((a) => a.tone === "rose").length} need action now`} icon={<Briefcase className="h-4 w-4 text-purple-400" />} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading
          ? [0, 1].map((i) => (
              <div key={i} className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-3 w-full" />
              </div>
            ))
          : businesses.map((b) => {
              const pct = b.targetMrr > 0 ? (b.mrr / b.targetMrr) * 100 : 0;
              const active = b.clients.filter((c) => c.status === "ACTIVE").length;
              const open = b.deliverables.filter((d) => d.status !== "COMPLETED").length;
              return (
                <Link key={b.id} href={`/business/${b.slug}`} className="group p-5 sm:p-6 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-all space-y-4 block">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: b.color }} />
                        <h2 className="text-lg font-bold text-slate-100 group-hover:text-blue-400 transition-colors break-words">{b.name}</h2>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 break-words">{b.type}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-slate-600 group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Monthly recurring revenue</div>
                    <div className="text-2xl font-bold font-mono text-white">{formatKES(b.mrr)}</div>
                    {b.targetMrr > 0 ? (
                      <div className="mt-2 space-y-1">
                        <ProgressBar percent={pct} color={b.color} />
                        <div className="text-[11px] text-slate-500">
                          {Math.round(pct)}% of {formatKES(b.targetMrr)} target
                        </div>
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-500 mt-1">No target set yet</div>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    {[
                      { label: "Active clients", value: active },
                      { label: "Open work", value: open },
                      { label: "Net this month", value: formatKES(b.monthNet), bad: b.monthNet < 0 },
                    ].map((s) => (
                      <div key={s.label} className="p-2 rounded-xl bg-slate-950/60 border border-slate-800/80 min-w-0">
                        <div className={`text-sm font-bold font-mono break-words ${s.bad ? "text-rose-300" : "text-white"}`}>{s.value}</div>
                        <div className="text-[10px] text-slate-500">{s.label}</div>
                      </div>
                    ))}
                  </div>
                </Link>
              );
            })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Needs attention" className="lg:col-span-2">
          {loading ? (
            <Skeleton className="h-20 w-full" />
          ) : attention.length === 0 ? (
            <EmptyState>Nothing needs attention across your businesses right now.</EmptyState>
          ) : (
            <div className="space-y-2">
              {attention.slice(0, 10).map((a) => (
                <Link key={a.key} href={`/business/${a.businessSlug}`} className="flex items-start gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition-colors">
                  <span className={`mt-1 h-2 w-2 rounded-full shrink-0 ${a.tone === "rose" ? "bg-rose-400" : a.tone === "amber" ? "bg-amber-400" : "bg-blue-400"}`} />
                  <div className="min-w-0 text-xs">
                    <div className="text-slate-100 break-words">{a.text}</div>
                    <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: a.businessColor }} />
                      {a.businessName}
                      {a.detail ? ` · ${a.detail}` : ""}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>

        <div className="space-y-4">
          <Card title="Money" icon={<Wallet className="h-3.5 w-3.5 text-blue-400" />}>
            <p className="text-xs text-slate-400">Money in and out of every business, retainers still to collect, your accounts and the purchases list.</p>
            <Link href="/business/finance" className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-400 hover:text-blue-300">
              Open business finance <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Card>
          <Card title={`To buy (${toBuy.length})`} icon={<ShoppingBag className="h-3.5 w-3.5 text-amber-400" />}>
            {loading ? (
              <Skeleton className="h-10 w-full" />
            ) : toBuy.length === 0 ? (
              <EmptyState>Nothing on the purchases list.</EmptyState>
            ) : (
              <div className="space-y-2">
                {toBuy.slice(0, 4).map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-3 text-xs">
                    <span className="text-slate-200 truncate">{p.name}</span>
                    <span className="font-mono text-slate-400 shrink-0">{formatKES(p.estimatedCost)}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between text-[11px] pt-2 border-t border-slate-800 text-slate-400">
                  <span>Total</span>
                  <span className="font-mono">{formatKES(toBuy.reduce((a, p) => a + (p.estimatedCost || 0), 0))}</span>
                </div>
              </div>
            )}
          </Card>
          <Card title="Companies">
            <div className="space-y-1.5 text-xs">
              {businesses.map((b) => (
                <Link key={b.id} href={`/business/${b.slug}`} className="flex items-center gap-2 text-slate-300 hover:text-blue-300 transition-colors">
                  <Building2 className="h-3.5 w-3.5 shrink-0" style={{ color: b.color }} />
                  {b.name}
                </Link>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {!loading && businesses.length > 0 && (
        <DeliverablesSection items={allDeliverables} businesses={businesses} defaultBusinessId={defaultId} showBusiness onChanged={reload} />
      )}

      {action === "client" && <ClientModal businesses={businesses} defaultBusinessId={defaultId} editing={null} onClose={() => setAction(null)} onSaved={reload} />}
      {action === "deliverable" && <DeliverableModal businesses={businesses} defaultBusinessId={defaultId} editing={null} onClose={() => setAction(null)} onSaved={reload} />}
      {(action === "income" || action === "expense") && (
        <TransactionModal businesses={businesses} defaultBusinessId={defaultId} defaultType={action === "income" ? "INCOME" : "EXPENSE"} editing={null} onClose={() => setAction(null)} onSaved={reload} />
      )}
    </div>
  );
}
