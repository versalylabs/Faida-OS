"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ArrowRight, Briefcase } from "lucide-react";
import { formatKES } from "@/lib/utils";
import { useBusinessData } from "@/components/business/useBusinessData";
import { buildAttention } from "@/components/business/attention";
import { Skeleton } from "@/components/business/ui";

/**
 * Business & Ventures on the dashboard. It reads the same /api/business answer as the Business pages, so every
 * number here is the number you see there (never a separate copy).
 */
export function BusinessPulse() {
  const { businesses, summary, loading, error, reload } = useBusinessData();

  // Refresh when offline changes finish syncing, like the rest of the dashboard
  useEffect(() => {
    const onSync = () => reload();
    window.addEventListener("faida-sync-completed", onSync);
    return () => window.removeEventListener("faida-sync-completed", onSync);
  }, [reload]);

  const attention = buildAttention(businesses);
  const toBuy = businesses.flatMap((b) => b.purchases).filter((p) => p.status !== "BOUGHT");

  return (
    <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-4 sm:p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Briefcase className="h-4 w-4 text-blue-400 shrink-0" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 truncate">Business &amp; Ventures</h2>
        </div>
        <Link href="/business" className="text-[11px] text-blue-400 hover:underline flex items-center gap-1 shrink-0">
          Overview <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {error && !loading && <p className="text-xs text-slate-500">Business numbers are unavailable right now.</p>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        {[
          { label: "Monthly recurring revenue", value: formatKES(summary?.totalMrr ?? 0), sub: "From active monthly clients" },
          { label: "Active clients", value: String(summary?.activeClientsCount ?? 0), sub: `${businesses.flatMap((b) => b.clients).filter((c) => !["ACTIVE", "COMPLETED", "PAUSED", "LOST"].includes(c.status)).length} in the pipeline` },
          {
            label: "Net this month",
            value: formatKES(summary?.monthNet ?? 0),
            sub: `${formatKES(summary?.monthIncome ?? 0)} in, ${formatKES(summary?.monthExpense ?? 0)} out`,
            bad: (summary?.monthNet ?? 0) < 0,
          },
          { label: "Client work open", value: String(summary?.pendingDeliverablesCount ?? 0), sub: `${attention.filter((a) => a.tone === "rose").length} need action now` },
        ].map((s) => (
          <div key={s.label} className="p-2.5 rounded-lg bg-slate-800/40 border border-slate-800/90 space-y-1 min-w-0">
            <div className="text-[10px] text-slate-400 uppercase font-semibold truncate">{s.label}</div>
            {loading ? <Skeleton className="h-5 w-24" /> : <div className={`text-sm font-bold font-mono tracking-tight break-words ${s.bad ? "text-rose-300" : "text-slate-100"}`}>{s.value}</div>}
            {loading ? <Skeleton className="h-3 w-20" /> : <div className="text-[10px] text-slate-500 truncate">{s.sub}</div>}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {loading
          ? [0, 1].map((i) => <Skeleton key={i} className="h-16 w-full" />)
          : businesses.map((b) => (
              <Link key={b.id} href={`/business/${b.slug}`} className="p-3 rounded-lg bg-slate-800/30 border border-slate-800/60 hover:border-slate-700 transition-colors space-y-1.5 min-w-0">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-100">
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: b.color }} />
                  <span className="truncate">{b.name}</span>
                </div>
                <div className="text-[11px] text-slate-400 font-mono break-words">
                  {formatKES(b.mrr)} MRR · {b.clients.filter((c) => c.status === "ACTIVE").length} active
                </div>
                <div className={`text-[11px] font-mono ${b.monthNet < 0 ? "text-rose-300" : "text-slate-500"}`}>Net {formatKES(b.monthNet)} this month</div>
              </Link>
            ))}

        {!loading && (
          <div className="p-3 rounded-lg bg-slate-800/30 border border-slate-800/60 space-y-1.5 min-w-0">
            <div className="text-xs font-semibold text-slate-100">Needs attention</div>
            {attention.length === 0 ? (
              <div className="text-[11px] text-slate-500">Nothing right now.</div>
            ) : (
              attention.slice(0, 3).map((a) => (
                <Link key={a.key} href={`/business/${a.businessSlug}`} className="block text-[11px] text-slate-300 hover:text-white break-words">
                  <span className={a.tone === "rose" ? "text-rose-400" : a.tone === "amber" ? "text-amber-400" : "text-blue-400"}>● </span>
                  {a.text}
                </Link>
              ))
            )}
            {toBuy.length > 0 && (
              <Link href="/business/finance" className="block text-[11px] text-slate-500 hover:text-slate-300">
                {toBuy.length} to buy · {formatKES(toBuy.reduce((n, p) => n + (p.estimatedCost || 0), 0))}
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
