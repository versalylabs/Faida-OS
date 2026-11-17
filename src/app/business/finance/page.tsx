"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Wallet } from "lucide-react";
import { useBusinessData } from "@/components/business/useBusinessData";
import { MoneySection } from "@/components/business/Money";
import { PurchasesSection } from "@/components/business/Purchases";
import { Skeleton } from "@/components/business/ui";

/** Business finance: money in and out across every business, your accounts, and what is still to buy. */
export default function BusinessFinancePage() {
  const { businesses, loading, error } = useBusinessData();
  const [view, setView] = useState<"all" | string>("all");
  const [tab, setTab] = useState<"money" | "purchases">("money");
  const defaultId = (view !== "all" ? view : businesses[0]?.id) ?? "";

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="space-y-4">
        <Link href="/business" className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Business overview</span>
        </Link>
        <div>
          <div className="flex items-center gap-2 text-xs text-blue-400 font-mono tracking-wider uppercase mb-1">
            <Wallet className="h-3.5 w-3.5" />
            Business &amp; Ventures
          </div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-white">Business finance</h1>
          <p className="text-xs text-slate-400 mt-0.5">Money coming in and going out, retainers still to collect, your accounts, and equipment to buy.</p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 text-xs">
            {(["money", "purchases"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3.5 py-1.5 rounded-xl font-medium cursor-pointer transition-all ${
                  tab === t ? "bg-blue-600 text-white font-semibold shadow-md shadow-blue-500/10" : "bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-slate-800"
                }`}
              >
                {t === "money" ? "Money in & out" : "Things to buy"}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
            {loading ? (
              <Skeleton className="h-8 w-48" />
            ) : (
              <>
                <button
                  onClick={() => setView("all")}
                  className={`px-3 py-1.5 rounded-xl font-medium whitespace-nowrap cursor-pointer transition-all ${view === "all" ? "bg-slate-700 text-white" : "bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-slate-800"}`}
                >
                  All businesses
                </button>
                {businesses.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => setView(b.id)}
                    className={`px-3 py-1.5 rounded-xl font-medium whitespace-nowrap cursor-pointer transition-all flex items-center gap-1.5 ${
                      view === b.id ? "bg-slate-700 text-white" : "bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-slate-800"
                    }`}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: b.color }} />
                    {b.name}
                  </button>
                ))}
              </>
            )}
          </div>
        </div>
      </div>

      {error && !loading && <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">{error}</div>}

      {!loading && businesses.length > 0 && tab === "money" && (
        <MoneySection key={`m-${view}`} businesses={businesses} businessId={view === "all" ? undefined : view} defaultBusinessId={defaultId} />
      )}
      {!loading && businesses.length > 0 && tab === "purchases" && (
        <PurchasesSection key={`p-${view}`} businesses={businesses} businessId={view === "all" ? undefined : view} defaultBusinessId={defaultId} />
      )}
    </div>
  );
}
