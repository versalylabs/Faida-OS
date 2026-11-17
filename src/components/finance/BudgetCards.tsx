"use client";

import { Briefcase, Edit3, PiggyBank, TrendingUp, User } from "lucide-react";
import { formatKES } from "@/lib/utils";

export interface BudgetMetrics {
  personalBudget: number;
  personalExpense: number;
  personalRemaining: number;
  personalPercentUsed: number;
  businessBudget: number;
  businessExpense: number;
  businessRemaining: number;
  businessPercentUsed: number;
  savingsTarget: number;
  savingsBalance: number;
  savedThisMonth: number;
  savingsPercent: number;
  netCashFlow: number;
  totalIncome: number;
  totalExpense: number;
}

type Tab = "ALL" | "PERSONAL" | "BUSINESS" | "SAVINGS";

/** One monthly budget: how much of it is spent. A bar that fills up, red once you are over, and the overspend in words. */
function BudgetCard({
  title,
  icon,
  budget,
  spent,
  percent,
  accent,
  onEdit,
}: {
  title: string;
  icon: React.ReactNode;
  budget: number;
  spent: number;
  percent: number;
  accent: string; // tailwind text colour for the "left" amount
  onEdit: () => void;
}) {
  const over = budget > 0 && spent > budget;
  const bar = over || percent > 90 ? "bg-rose-500" : percent > 75 ? "bg-amber-500" : accent === "text-blue-400" ? "bg-blue-500" : "bg-emerald-500";
  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-slate-400 uppercase font-semibold flex items-center gap-1.5">
          {icon}
          {title}
        </span>
        <button onClick={onEdit} className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer" aria-label={`Edit ${title}`}>
          <Edit3 className="h-3 w-3" />
          <span>{budget > 0 ? "Edit" : "Set"}</span>
        </button>
      </div>
      <div className="text-2xl font-bold text-white font-mono tracking-tight break-words">{formatKES(spent)}</div>
      <div className="text-[11px] text-slate-400 -mt-1.5">{budget > 0 ? `spent of ${formatKES(budget)}` : "spent this month"}</div>
      {budget > 0 ? (
        <>
          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-500 ${bar}`} style={{ width: `${Math.min(100, Math.max(spent > 0 ? 3 : 0, percent))}%` }} />
          </div>
          <div className="flex items-center justify-between text-[10px] font-mono pt-0.5">
            <span className="text-slate-400">{percent}% used</span>
            {over ? <span className="text-rose-400 font-semibold">Over by {formatKES(spent - budget)}</span> : <span className={`${accent} font-semibold`}>{formatKES(budget - spent)} left</span>}
          </div>
        </>
      ) : (
        <p className="text-[11px] text-slate-500">No monthly budget set. Choose Set to add one.</p>
      )}
    </div>
  );
}

/** The four numbers under your accounts: two budgets, savings progress, and this month's cash flow. */
export function BudgetCards({ metrics, onEdit }: { metrics: BudgetMetrics; onEdit: (tab: Tab) => void }) {
  const m = metrics;
  const saved = m.savedThisMonth;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <BudgetCard title="Personal Budget" icon={<User className="h-3.5 w-3.5 text-emerald-400" />} budget={m.personalBudget} spent={m.personalExpense} percent={m.personalPercentUsed} accent="text-emerald-400" onEdit={() => onEdit("PERSONAL")} />
      <BudgetCard title="Business Budget" icon={<Briefcase className="h-3.5 w-3.5 text-blue-400" />} budget={m.businessBudget} spent={m.businessExpense} percent={m.businessPercentUsed} accent="text-blue-400" onEdit={() => onEdit("BUSINESS")} />

      <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-slate-400 uppercase font-semibold flex items-center gap-1.5">
            <PiggyBank className="h-3.5 w-3.5 text-purple-400" />
            Savings
          </span>
          <button onClick={() => onEdit("SAVINGS")} className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer" aria-label="Edit savings target">
            <Edit3 className="h-3 w-3" />
            <span>{m.savingsTarget > 0 ? "Target" : "Set"}</span>
          </button>
        </div>
        <div className="text-2xl font-bold text-purple-300 font-mono tracking-tight break-words">{formatKES(m.savingsBalance)}</div>
        <div className="text-[11px] text-slate-400 -mt-1.5">in your savings accounts</div>
        {m.savingsTarget > 0 ? (
          <>
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div className="bg-purple-500 h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, Math.max(saved > 0 ? 3 : 0, m.savingsPercent))}%` }} />
            </div>
            <div className="flex items-center justify-between text-[10px] font-mono pt-0.5">
              <span className="text-slate-400">
                {saved >= 0 ? "+" : "-"}
                {formatKES(Math.abs(saved))} this month
              </span>
              <span className="text-purple-300 font-semibold">
                {m.savingsPercent}% of {formatKES(m.savingsTarget)}
              </span>
            </div>
          </>
        ) : (
          <p className="text-[11px] text-slate-500">
            {saved !== 0 ? `${saved >= 0 ? "+" : "-"}${formatKES(Math.abs(saved))} this month. ` : ""}Set a monthly savings target to track progress.
          </p>
        )}
      </div>

      <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-slate-400 uppercase font-semibold flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-cyan-400" />
            Cash flow this month
          </span>
        </div>
        <div className={`text-2xl font-bold font-mono tracking-tight break-words ${m.netCashFlow >= 0 ? "text-cyan-300" : "text-rose-300"}`}>
          {m.netCashFlow >= 0 ? "+" : "-"}
          {formatKES(Math.abs(m.netCashFlow))}
        </div>
        <div className="text-[11px] text-slate-400 -mt-1.5">income minus spending</div>
        <div className="flex items-center justify-between text-[10px] font-mono pt-0.5">
          <span className="text-emerald-400">+{formatKES(m.totalIncome)} in</span>
          <span className="text-rose-400">-{formatKES(m.totalExpense)} out</span>
        </div>
        <p className="text-[10px] text-slate-500">Transfers between your accounts are not counted.</p>
      </div>
    </div>
  );
}
