"use client";

import { useEffect, useState } from "react";
import { Wallet, X } from "lucide-react";
import { offlineFetch } from "@/lib/offlineSync";
import { formatKES } from "@/lib/utils";
import { dateToInput, fieldCls, inputToIso, labelCls, todayInput, type FinAccount, type FinCategory, type FinTransaction } from "@/components/finance/shared";

import { Portal } from "@/components/ui/Portal";
/** Log or edit income and spending. The chosen account's balance moves with it, and the dialog shows how. */
export function TransactionDialog({
  accounts,
  categories,
  editing,
  defaults,
  onClose,
  onSaved,
  onManageCategories,
}: {
  accounts: FinAccount[];
  categories: FinCategory[];
  editing: FinTransaction | null;
  defaults: { type: "EXPENSE" | "INCOME"; accountId: string | null };
  onClose: () => void;
  onSaved: () => void;
  onManageCategories: () => void;
}) {
  const initialType: "EXPENSE" | "INCOME" = editing ? (editing.amount >= 0 ? "INCOME" : "EXPENSE") : defaults.type;
  const defaultAccount = accounts.find((a) => a.isDefault)?.id ?? "";
  const [type, setType] = useState<"EXPENSE" | "INCOME">(initialType);
  const [desc, setDesc] = useState(editing?.description ?? "");
  const [amount, setAmount] = useState(editing ? String(Math.abs(editing.amount)) : "");
  const [accountId, setAccountId] = useState<string>(editing ? editing.accountId ?? "" : defaults.accountId ?? defaultAccount);
  const [date, setDate] = useState(editing ? dateToInput(editing.date) : todayInput());
  const [category, setCategory] = useState(editing?.category ?? "");
  const [isRecurring, setIsRecurring] = useState(editing?.isRecurring ?? false);
  const [applyToBalance, setApplyToBalance] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const typeCategories = categories.filter((c) => c.type === type);
  // Keep the category valid for the chosen type
  useEffect(() => {
    if (!typeCategories.some((c) => c.name === category)) setCategory(typeCategories[0]?.name ?? "General");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, categories]);

  const account = accounts.find((a) => a.id === accountId);
  const n = parseFloat(amount);
  const validAmount = Number.isFinite(n) && n > 0;
  const signed = type === "INCOME" ? n : -n;
  // What the balance will be after saving (for an edit: after undoing the old amount first)
  const before = account ? account.balance - (editing && editing.accountId === account.id ? editing.amount : 0) : null;
  const after = account && validAmount && before !== null ? before + signed : null;
  const legacyAssign = !!editing && !editing.accountId && !!accountId;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!desc.trim() || !validAmount || busy) return;
    setBusy(true);
    setError("");
    try {
      const common = {
        description: desc.trim(),
        amount: n,
        type,
        category: category || "General",
        date: inputToIso(date),
        isRecurring,
        accountId: accountId || null,
      };
      const res = await offlineFetch(editing ? "/api/finance/transactions" : "/api/finance", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing ? { id: editing.id, ...common, applyToBalance: legacyAssign && applyToBalance } : common),
      });
      const data = await res.json();
      if (data.success) {
        onSaved();
        onClose();
      } else setError(data.error || "Could not save the transaction");
    } catch {
      setError("Could not save the transaction");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Portal><div className="fixed inset-0 modal-overlay z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Wallet className="h-4 w-4 text-emerald-400" />
            {editing ? "Edit Transaction" : type === "INCOME" ? "Record Income" : "Record Expense"}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 cursor-pointer" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={save} className="space-y-3 text-xs">
          <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800">
            {(["EXPENSE", "INCOME"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`flex-1 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                  type === t ? (t === "EXPENSE" ? "bg-rose-500/20 text-rose-400" : "bg-emerald-500/20 text-emerald-400") : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {t === "EXPENSE" ? "Expense" : "Income"}
              </button>
            ))}
          </div>

          <div>
            <label className={labelCls}>Description</label>
            <input type="text" placeholder="e.g. Carrefour Supermarket, Upwork payout" value={desc} onChange={(e) => setDesc(e.target.value)} className={fieldCls} autoFocus required maxLength={300} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Amount (KES)</label>
              <input type="number" min="0" step="any" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} className={`${fieldCls} font-mono`} required />
            </div>
            <div>
              <label className={labelCls}>Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={fieldCls} />
            </div>
          </div>

          <div>
            <label className={labelCls}>{type === "INCOME" ? "Paid into" : "Paid from"}</label>
            <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className={fieldCls}>
              <option value="">No account (do not change a balance)</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} · {formatKES(a.balance)}
                </option>
              ))}
            </select>
            {account && after !== null ? (
              <p className="text-[11px] mt-1.5 font-mono text-slate-400">
                {account.name}: {formatKES(before!)} <span className="text-slate-600">→</span>{" "}
                <span className={type === "INCOME" ? "text-emerald-400" : after < 0 ? "text-rose-400" : "text-slate-200"}>{formatKES(after)}</span>
              </p>
            ) : (
              <p className="text-[11px] mt-1.5 text-slate-500">{account ? "Enter an amount to see the new balance." : "Nothing is added to or taken from any account."}</p>
            )}
            {legacyAssign && (
              <label className="flex items-start gap-2 mt-2 text-[11px] text-slate-300 cursor-pointer">
                <input type="checkbox" checked={applyToBalance} onChange={(e) => setApplyToBalance(e.target.checked)} className="mt-0.5 accent-emerald-500" />
                <span>Also update this account&apos;s balance. Leave unticked if the balance you entered already includes this money.</span>
              </label>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-slate-300 font-medium">Category</label>
              <button type="button" onClick={onManageCategories} className="text-[11px] text-blue-400 hover:underline cursor-pointer">
                Manage Categories
              </button>
            </div>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className={fieldCls}>
              {typeCategories.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
              {typeCategories.length === 0 && <option value="General">General</option>}
              {category && !typeCategories.some((c) => c.name === category) && typeCategories.length > 0 && <option value={category}>{category}</option>}
            </select>
          </div>

          <label className="flex items-start gap-2 pt-1 text-slate-300 cursor-pointer">
            <input type="checkbox" checked={isRecurring} onChange={(e) => setIsRecurring(e.target.checked)} className="mt-0.5 h-4 w-4 accent-emerald-500" />
            <span>
              Recurring monthly bill or income
              <span className="block text-[10px] text-slate-500">Marks it as repeating so you can spot it. It is not posted automatically; log it each month.</span>
            </span>
          </label>

          {error && <p className="text-rose-400">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-slate-400 hover:text-slate-200 cursor-pointer">
              Cancel
            </button>
            <button type="submit" disabled={!desc.trim() || !validAmount || busy} className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold disabled:opacity-50 cursor-pointer">
              {busy ? "Saving..." : editing ? "Save Changes" : "Record Transaction"}
            </button>
          </div>
        </form>
      </div>
    </div></Portal>
  );
}
