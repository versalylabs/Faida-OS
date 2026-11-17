"use client";

import { useState } from "react";
import { ArrowLeftRight, X } from "lucide-react";
import { offlineFetch } from "@/lib/offlineSync";
import { formatKES } from "@/lib/utils";
import { fieldCls, inputToIso, labelCls, todayInput, type FinAccount } from "@/components/finance/shared";

/** Move money between two of your accounts (cash to M-Pesa, bank to savings). It is not income or spending. */
export function TransferDialog({
  accounts,
  defaultFromId,
  onClose,
  onSaved,
}: {
  accounts: FinAccount[];
  defaultFromId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const first = defaultFromId && accounts.some((a) => a.id === defaultFromId) ? defaultFromId : accounts[0]?.id ?? "";
  const [fromId, setFromId] = useState(first);
  const [toId, setToId] = useState(accounts.find((a) => a.id !== first)?.id ?? "");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayInput());
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const from = accounts.find((a) => a.id === fromId);
  const to = accounts.find((a) => a.id === toId);
  const n = parseFloat(amount);
  const valid = Number.isFinite(n) && n > 0 && fromId && toId && fromId !== toId;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await offlineFetch("/api/finance/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromAccountId: fromId, toAccountId: toId, amount: n, date: inputToIso(date), note: note.trim() || null }),
      });
      const data = await res.json();
      if (data.success) {
        onSaved();
        onClose();
      } else setError(data.error || "Could not record the transfer");
    } catch {
      setError("Could not record the transfer");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 modal-overlay z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <ArrowLeftRight className="h-4 w-4 text-cyan-400" />
            Transfer Between Accounts
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 cursor-pointer" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={save} className="space-y-3 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>From</label>
              <select value={fromId} onChange={(e) => setFromId(e.target.value)} className={fieldCls}>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} · {formatKES(a.balance)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>To</label>
              <select value={toId} onChange={(e) => setToId(e.target.value)} className={fieldCls}>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id} disabled={a.id === fromId}>
                    {a.name} · {formatKES(a.balance)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Amount (KES)</label>
              <input type="number" min="0" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} className={`${fieldCls} font-mono`} autoFocus required placeholder="0.00" />
            </div>
            <div>
              <label className={labelCls}>Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={fieldCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Note (optional)</label>
            <input value={note} onChange={(e) => setNote(e.target.value)} className={fieldCls} maxLength={120} placeholder="e.g. Saving for rent" />
          </div>

          {from && to && Number.isFinite(n) && n > 0 && from.id !== to.id && (
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1 text-[11px] font-mono">
              <div className="flex justify-between gap-3">
                <span className="text-slate-400 truncate">{from.name}</span>
                <span className={from.balance - n < 0 ? "text-rose-400" : "text-slate-200"}>
                  {formatKES(from.balance)} → {formatKES(from.balance - n)}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-slate-400 truncate">{to.name}</span>
                <span className="text-emerald-400">
                  {formatKES(to.balance)} → {formatKES(to.balance + n)}
                </span>
              </div>
              {from.balance - n < 0 && <p className="text-rose-400 pt-1">This takes {from.name} below zero.</p>}
            </div>
          )}

          {error && <p className="text-rose-400">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-slate-400 hover:text-slate-200 cursor-pointer">
              Cancel
            </button>
            <button type="submit" disabled={!valid || busy} className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold disabled:opacity-50 cursor-pointer">
              {busy ? "Moving..." : "Transfer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
