"use client";

import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Edit3, Plus, Star, Trash2, Wallet } from "lucide-react";
import { formatKES } from "@/lib/utils";
import { accountIcon, type FinAccount } from "@/components/finance/shared";

/**
 * Your accounts come first: what you hold right now. Each card moves with every income, expense and transfer
 * you record, shows what moved this month, and has the shortcuts you reach for most.
 */
export function AccountsSection({
  accounts,
  loading,
  activeAccountId,
  onAdd,
  onEdit,
  onDelete,
  onAdjust,
  onLog,
  onTransfer,
  onSetDefault,
  onViewActivity,
}: {
  accounts: FinAccount[];
  loading: boolean;
  activeAccountId: string | null;
  onAdd: () => void;
  onEdit: (a: FinAccount) => void;
  onDelete: (a: FinAccount) => void;
  onAdjust: (a: FinAccount) => void;
  onLog: (type: "INCOME" | "EXPENSE", accountId: string) => void;
  onTransfer: (fromId: string | null) => void;
  onSetDefault: (a: FinAccount) => void;
  onViewActivity: (a: FinAccount) => void;
}) {
  const total = accounts.reduce((s, a) => s + a.balance, 0);
  const hasDefault = accounts.some((a) => a.isDefault);

  return (
    <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-slate-800 pb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-emerald-400" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200">Accounts &amp; Balances</h2>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Total across all accounts</div>
          {loading ? (
            <div className="h-9 w-48 rounded-lg bg-slate-800/80 animate-pulse mt-1" />
          ) : (
            <div className={`font-mono text-3xl font-bold tracking-tight break-words ${total < 0 ? "text-rose-300" : "text-white"}`}>{formatKES(total)}</div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => onTransfer(null)}
            disabled={accounts.length < 2}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold border border-slate-700 transition-colors cursor-pointer disabled:opacity-40"
          >
            <ArrowLeftRight className="h-3.5 w-3.5 text-cyan-400" />
            <span>Transfer</span>
          </button>
          <button
            onClick={onAdd}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold border border-slate-700 transition-colors cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5 text-emerald-400" />
            <span>Add Account</span>
          </button>
        </div>
      </div>

      {!loading && accounts.length > 0 && !hasDefault && (
        <p className="text-[11px] text-slate-500">
          Tip: tap the star on the account you use most. Money logged from Quick Capture or Faida AI goes to the starred account, so its balance stays right.
        </p>
      )}

      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,19rem),1fr))] gap-3.5">
        {accounts.map((acc) => {
          const active = activeAccountId === acc.id;
          return (
            <div
              key={acc.id}
              className={`p-4 rounded-xl bg-slate-950/70 border transition-all flex flex-col justify-between gap-3 group/acc ${active ? "border-emerald-500/50" : "border-slate-800/90 hover:border-slate-700"}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="p-2 rounded-lg shrink-0" style={{ backgroundColor: acc.color ? `${acc.color}25` : "#10b98125", color: acc.color || "#10b981" }}>
                    {accountIcon(acc.type)}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xs font-bold text-slate-100 break-words">{acc.name}</h3>
                    <span className="text-[10px] font-mono text-slate-400 uppercase">{acc.type}</span>
                  </div>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    onClick={() => onSetDefault(acc)}
                    title={acc.isDefault ? "Default account for Quick Capture and Faida AI" : "Make this the default account"}
                    aria-label={acc.isDefault ? "Default account" : `Make ${acc.name} the default account`}
                    className={`p-1 rounded cursor-pointer transition-colors ${acc.isDefault ? "text-amber-300" : "text-slate-600 hover:text-amber-300"}`}
                  >
                    <Star className={`h-3.5 w-3.5 ${acc.isDefault ? "fill-amber-300" : ""}`} />
                  </button>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover/acc:opacity-100 focus-within:opacity-100 [@media(pointer:coarse)]:opacity-100! transition-opacity">
                    <button onClick={() => onEdit(acc)} title="Edit account details" aria-label={`Edit ${acc.name}`} className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 cursor-pointer">
                      <Edit3 className="h-3 w-3" />
                    </button>
                    <button onClick={() => onDelete(acc)} title="Delete account" aria-label={`Delete ${acc.name}`} className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400 font-medium">Balance</span>
                  {acc.isDefault && <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20">default</span>}
                </div>
                <div className={`font-mono text-xl font-bold tracking-tight break-words ${acc.balance < 0 ? "text-rose-300" : "text-white"}`}>{formatKES(acc.balance)}</div>
                <div className="flex items-center gap-3 text-[10px] font-mono mt-0.5">
                  <span className="text-emerald-400">+{formatKES(acc.monthIn ?? 0)}</span>
                  <span className="text-rose-400">-{formatKES(acc.monthOut ?? 0)}</span>
                  <span className="text-slate-500">this month</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <button onClick={() => onLog("INCOME", acc.id)} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 hover:border-emerald-500/40 text-[11px] text-slate-200 cursor-pointer transition-colors">
                  <ArrowDownLeft className="h-3 w-3 text-emerald-400" /> In
                </button>
                <button onClick={() => onLog("EXPENSE", acc.id)} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 hover:border-rose-500/40 text-[11px] text-slate-200 cursor-pointer transition-colors">
                  <ArrowUpRight className="h-3 w-3 text-rose-400" /> Out
                </button>
                <button
                  onClick={() => onTransfer(acc.id)}
                  disabled={accounts.length < 2}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 hover:border-cyan-500/40 text-[11px] text-slate-200 cursor-pointer transition-colors disabled:opacity-40"
                >
                  <ArrowLeftRight className="h-3 w-3 text-cyan-400" /> Move
                </button>
                <button onClick={() => onViewActivity(acc)} className="px-2 py-1 rounded-lg text-[11px] text-slate-400 hover:text-slate-200 cursor-pointer transition-colors">
                  {active ? "Showing activity" : "Activity"}
                </button>
                <button onClick={() => onAdjust(acc)} title="Correct the balance to match the real amount" className="ml-auto px-2 py-1 rounded-lg text-[11px] text-emerald-400 font-mono hover:bg-slate-800 cursor-pointer transition-colors">
                  Set balance
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
