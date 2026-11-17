"use client";

import { useEffect, useState } from "react";
import { ArrowLeftRight, Edit3, Loader2, Search, Trash2, TrendingDown, TrendingUp, X } from "lucide-react";
import { formatKES, formatDate } from "@/lib/utils";
import type { FinAccount, FinTransaction } from "@/components/finance/shared";

export type FeedKind = "all" | "income" | "expense" | "transfer";

/** The ledger: every income, expense and transfer, with filters, editing, and the account each one moved. */
export function TransactionFeed({
  transactions,
  accounts,
  loading,
  kind,
  setKind,
  accountId,
  setAccountId,
  query,
  setQuery,
  hasMore,
  onLoadMore,
  onEdit,
  onDelete,
}: {
  transactions: FinTransaction[];
  accounts: FinAccount[];
  loading: boolean;
  kind: FeedKind;
  setKind: (k: FeedKind) => void;
  accountId: string;
  setAccountId: (id: string) => void;
  query: string;
  setQuery: (q: string) => void;
  hasMore: boolean;
  onLoadMore: () => void;
  onEdit: (tx: FinTransaction) => void;
  onDelete: (tx: FinTransaction) => Promise<void> | void;
}) {
  const [text, setText] = useState(query);
  const [confirming, setConfirming] = useState<string | null>(null);

  // Wait for a pause in typing before searching
  useEffect(() => {
    const t = setTimeout(() => setQuery(text.trim()), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);
  useEffect(() => setText(query), [query]);

  const filtered = kind !== "all" || accountId !== "" || query !== "";

  return (
    <div id="transactions" className="rounded-2xl bg-slate-900/60 border border-slate-800 p-4 sm:p-6 space-y-4 scroll-mt-20">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">Transactions ({transactions.length}{hasMore ? "+" : ""})</h2>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="inline-flex p-1 rounded-xl bg-slate-950 border border-slate-800 text-[11px] overflow-x-auto">
            {(["all", "income", "expense", "transfer"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setKind(k)}
                className={`px-3 py-1 rounded-lg font-semibold whitespace-nowrap cursor-pointer transition-all ${kind === k ? "bg-slate-800 text-white" : "text-slate-400 hover:text-slate-200"}`}
              >
                {k === "all" ? "All" : k === "income" ? "Income" : k === "expense" ? "Expenses" : "Transfers"}
              </button>
            ))}
          </div>
          <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-[11px] text-slate-300 focus:outline-none focus:border-emerald-500" aria-label="Filter by account">
            <option value="">All accounts</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <div className="relative">
            <Search className="absolute left-3 top-2 h-3.5 w-3.5 text-slate-500" />
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Search..." className="w-full sm:w-44 bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-7 py-1.5 text-[11px] text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500" />
            {text && (
              <button onClick={() => setText("")} className="absolute right-2 top-1.5 text-slate-500 hover:text-slate-300 cursor-pointer" aria-label="Clear search">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
          <span>Loading ledger...</span>
        </div>
      ) : transactions.length === 0 ? (
        <div className="py-12 text-center text-xs text-slate-500">{filtered ? "Nothing matches these filters." : 'No transactions recorded. Use "Log Transaction" or capture with Ctrl + K.'}</div>
      ) : (
        <div className="space-y-2.5">
          {transactions.map((tx) => {
            const isTransfer = tx.type === "TRANSFER";
            const isIncome = tx.amount > 0;
            return (
              <div key={tx.id} className="p-3 sm:p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 flex items-center justify-between gap-3 sm:gap-4 transition-all">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`p-2 rounded-xl shrink-0 ${isTransfer ? "bg-cyan-500/10 text-cyan-400" : isIncome ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}`}>
                    {isTransfer ? <ArrowLeftRight className="h-4 w-4" /> : isIncome ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-200 break-words">{tx.description}</div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-slate-500 mt-0.5">
                      {!isTransfer && <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">{tx.category}</span>}
                      <span>{formatDate(tx.date)}</span>
                      {tx.account ? (
                        <span className="flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: tx.account.color || "#10b981" }} />
                          {tx.account.name}
                        </span>
                      ) : (
                        !isTransfer && <span className="text-slate-600" title="No account: this did not change any balance">no account</span>
                      )}
                      {tx.business && <span className="text-blue-400">{tx.business.name}</span>}
                      {tx.isRecurring && <span className="text-purple-400 font-mono font-medium">Recurring</span>}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <span className={`font-mono font-bold text-xs ${isTransfer ? "text-cyan-300" : isIncome ? "text-emerald-400" : "text-rose-400"}`}>
                    {isIncome ? "+" : "-"}
                    {formatKES(Math.abs(tx.amount))}
                  </span>
                  {confirming === tx.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={async () => {
                          setConfirming(null);
                          await onDelete(tx);
                        }}
                        className="px-2 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-semibold cursor-pointer"
                      >
                        {isTransfer ? "Delete both sides" : "Delete"}
                      </button>
                      <button onClick={() => setConfirming(null)} className="px-1.5 py-1 text-[10px] text-slate-400 hover:text-slate-200 cursor-pointer">
                        No
                      </button>
                    </div>
                  ) : (
                    <>
                      {!isTransfer && (
                        <button onClick={() => onEdit(tx)} className="p-1.5 rounded-lg text-slate-600 hover:text-blue-400 hover:bg-slate-900 transition-colors cursor-pointer" title="Edit" aria-label={`Edit ${tx.description}`}>
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button onClick={() => setConfirming(tx.id)} className="p-1.5 rounded-lg text-slate-600 hover:text-rose-400 hover:bg-slate-900 transition-colors cursor-pointer" title="Delete" aria-label={`Delete ${tx.description}`}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
          {hasMore && (
            <button onClick={onLoadMore} className="w-full py-2.5 rounded-xl border border-slate-800 text-xs text-slate-400 hover:text-slate-200 hover:border-slate-700 cursor-pointer transition-colors">
              Load more
            </button>
          )}
        </div>
      )}
    </div>
  );
}
