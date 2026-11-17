"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Edit3, Trash2, Wallet } from "lucide-react";
import { offlineFetch } from "@/lib/offlineSync";
import { formatKES } from "@/lib/utils";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@/lib/businessMath";
import type { BusinessItem, FinanceOverview, TransactionItem } from "@/components/business/types";
import { Badge, Card, ConfirmDelete, EmptyState, Field, Modal, Skeleton, Stat, dayLabel, ghostBtn, inputCls, primaryBtn } from "@/components/business/ui";

const todayInput = () => new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Nairobi" });

export function TransactionModal({
  businesses,
  defaultBusinessId,
  defaultType,
  editing,
  onClose,
  onSaved,
}: {
  businesses: BusinessItem[];
  defaultBusinessId: string;
  defaultType: "INCOME" | "EXPENSE";
  editing: TransactionItem | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [type, setType] = useState<"INCOME" | "EXPENSE">(editing ? (editing.amount >= 0 ? "INCOME" : "EXPENSE") : defaultType);
  const [amount, setAmount] = useState(editing ? String(Math.abs(editing.amount)) : "");
  const [businessId, setBusinessId] = useState(editing?.businessId ?? defaultBusinessId);
  const [clientId, setClientId] = useState(editing?.clientId ?? "");
  const [category, setCategory] = useState(editing?.category ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [date, setDate] = useState(editing ? new Date(editing.date).toLocaleDateString("en-CA", { timeZone: "Africa/Nairobi" }) : todayInput());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const clients = businesses.find((b) => b.id === businessId)?.clients ?? [];
  const categories = type === "INCOME" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = parseFloat(amount);
    if (!description.trim() || !Number.isFinite(n) || n < 0 || busy) return;
    setBusy(true);
    setError("");
    try {
      const body = {
        ...(editing ? { id: editing.id } : { businessId }),
        type,
        amount: n,
        category: category.trim() || (type === "INCOME" ? "Client payment" : "Other expense"),
        description: description.trim(),
        date: new Date(`${date}T12:00:00+03:00`).toISOString(),
        clientId: type === "INCOME" || clientId ? clientId || null : null,
      };
      const res = await offlineFetch("/api/business/finance", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        onSaved();
        onClose();
      } else setError(data.error || "Could not save");
    } catch {
      setError("Could not save");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={editing ? "Edit transaction" : type === "INCOME" ? "Record money in" : "Record money out"} onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-slate-950 border border-slate-800">
          {(["INCOME", "EXPENSE"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setType(t);
                setCategory("");
              }}
              className={`py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                type === t ? (t === "INCOME" ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30" : "bg-rose-500/15 text-rose-300 border border-rose-500/30") : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {t === "INCOME" ? "Money in" : "Money out"}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Amount (KES) *">
            <input type="number" min="0" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputCls} autoFocus required placeholder="0" />
          </Field>
          <Field label="Date">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
          </Field>
        </div>
        <Field label={type === "INCOME" ? "What was it for? *" : "What was it spent on? *"}>
          <input value={description} onChange={(e) => setDescription(e.target.value)} className={inputCls} required maxLength={300} placeholder={type === "INCOME" ? "e.g. 60% deposit, brand identity" : "e.g. Canva Pro, June"} />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Category">
            <input list="biz-tx-categories" value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls} placeholder={categories[0]} maxLength={80} />
            <datalist id="biz-tx-categories">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Field>
          {!editing && (
            <Field label="Business">
              <select
                value={businessId}
                onChange={(e) => {
                  setBusinessId(e.target.value);
                  setClientId("");
                }}
                className={inputCls}
              >
                {businesses.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </div>
        <Field label={type === "INCOME" ? "Which client paid?" : "For which client? (optional)"}>
          <select value={clientId} onChange={(e) => setClientId(e.target.value)} className={inputCls}>
            <option value="">No client</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        {error && <p className="text-xs text-rose-400">{error}</p>}
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
          <button type="button" onClick={onClose} className={ghostBtn}>
            Cancel
          </button>
          <button type="submit" disabled={!description.trim() || !amount || busy} className={primaryBtn}>
            {busy ? "Saving..." : editing ? "Save changes" : "Save"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

const monthLabel = (key: string) => new Date(`${key}-01T12:00:00Z`).toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" });

/**
 * Money in and out for one business, or for all of them when no businessId is given: this month's totals, what
 * the active retainers should still bring in, the cash accounts, and the transaction history.
 */
export function MoneySection({
  businesses,
  businessId,
  defaultBusinessId,
  onChanged,
}: {
  businesses: BusinessItem[];
  businessId?: string;
  defaultBusinessId: string;
  onChanged?: () => void;
}) {
  const [data, setData] = useState<FinanceOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modal, setModal] = useState<{ editing: TransactionItem | null; type: "INCOME" | "EXPENSE" } | null>(null);
  const [deleting, setDeleting] = useState<TransactionItem | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await offlineFetch(`/api/business/finance${businessId ? `?businessId=${businessId}` : ""}`, { cache: "no-store" });
      const json = await res.json();
      if (json.success) {
        setData(json);
        setError("");
      } else setError(json.error || "Could not load money");
    } catch {
      setError("Could not load money");
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    load();
  }, [load]);

  const changed = () => {
    load();
    onChanged?.();
  };

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    await offlineFetch(`/api/business/finance?id=${deleting.id}`, { method: "DELETE" }).catch(() => {});
    setBusy(false);
    setDeleting(null);
    changed();
  };

  const maxBar = Math.max(1, ...(data?.months ?? []).map((m) => Math.max(m.income, m.expense)));
  const toCollect = (data?.perBusiness ?? []).reduce((a, b) => a + b.stillToCollect, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-400">Everything recorded here also appears in your main Finance page.</p>
        <div className="flex gap-2">
          <button onClick={() => setModal({ editing: null, type: "INCOME" })} className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold cursor-pointer flex items-center gap-1.5">
            <ArrowDownLeft className="h-3.5 w-3.5 text-emerald-400" /> Money in
          </button>
          <button onClick={() => setModal({ editing: null, type: "EXPENSE" })} className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold cursor-pointer flex items-center gap-1.5">
            <ArrowUpRight className="h-3.5 w-3.5 text-rose-400" /> Money out
          </button>
        </div>
      </div>

      {error && <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">{error}</div>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Stat label="Money in this month" loading={loading} value={formatKES(data?.month.income ?? 0)} tone="good" icon={<ArrowDownLeft className="h-4 w-4 text-emerald-400" />} />
        <Stat label="Money out this month" loading={loading} value={formatKES(data?.month.expense ?? 0)} icon={<ArrowUpRight className="h-4 w-4 text-rose-400" />} />
        <Stat label="Net this month" loading={loading} value={formatKES(data?.month.net ?? 0)} tone={(data?.month.net ?? 0) < 0 ? "bad" : "good"} sub="In minus out" />
        <Stat
          label="Still to collect"
          loading={loading}
          value={formatKES(toCollect)}
          sub={toCollect > 0 ? "Active retainers not yet paid this month" : "Every active retainer has paid, or none is set up"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Last 6 months" className="lg:col-span-2">
          {loading ? (
            <Skeleton className="h-32 w-full" />
          ) : (
            <div>
              <div className="flex items-end gap-2 sm:gap-3 h-32">
                {data!.months.map((m) => (
                  <div key={m.key} className="flex-1 min-w-0 flex flex-col items-center justify-end gap-1 h-full">
                    <div className="flex items-end gap-1 w-full justify-center h-full">
                      <div className="w-1/2 max-w-[14px] rounded-t bg-emerald-500/80" style={{ height: `${(m.income / maxBar) * 100}%`, minHeight: m.income > 0 ? 3 : 0 }} title={`In ${formatKES(m.income)}`} />
                      <div className="w-1/2 max-w-[14px] rounded-t bg-rose-500/80" style={{ height: `${(m.expense / maxBar) * 100}%`, minHeight: m.expense > 0 ? 3 : 0 }} title={`Out ${formatKES(m.expense)}`} />
                    </div>
                    <span className="text-[10px] text-slate-500">{monthLabel(m.key)}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-4 text-[11px] text-slate-400 pt-3">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-sm bg-emerald-500/80" /> In
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-sm bg-rose-500/80" /> Out
                </span>
              </div>
            </div>
          )}
        </Card>

        <Card title="Where money went this month">
          {loading ? (
            <Skeleton className="h-24 w-full" />
          ) : data!.expenseByCategory.length === 0 ? (
            <EmptyState>No spending recorded this month.</EmptyState>
          ) : (
            <div className="space-y-2">
              {data!.expenseByCategory.slice(0, 6).map((c) => (
                <div key={c.category} className="flex items-center justify-between gap-3 text-xs">
                  <span className="text-slate-300 truncate">{c.category}</span>
                  <span className="font-mono text-slate-400 shrink-0">{formatKES(c.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {!loading && data!.clients.length > 0 && (
        <Card title="Retainers this month">
          <div className="space-y-2">
            {data!.clients.map((c) => {
              const paid = c.paidThisMonth >= c.expected && c.expected > 0;
              return (
                <div key={c.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-100 truncate">{c.name}</div>
                    {!businessId && <div className="text-[11px] text-slate-500 truncate">{c.businessName}</div>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0 text-[11px] font-mono">
                    <span className="text-slate-400">
                      {formatKES(c.paidThisMonth)} of {formatKES(c.expected)}
                    </span>
                    <Badge tone={paid ? "green" : c.paidThisMonth > 0 ? "amber" : "rose"}>{paid ? "paid" : c.paidThisMonth > 0 ? "part paid" : "unpaid"}</Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {!loading && data!.accounts.length > 0 && (
        <Card
          title="Cash and accounts"
          icon={<Wallet className="h-3.5 w-3.5 text-blue-400" />}
          action={<span className="text-xs font-mono text-slate-300">Total {formatKES(data!.totalBalance)}</span>}
        >
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,13rem),1fr))] gap-3">
            {data!.accounts.map((a) => (
              <div key={a.id} className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1 min-w-0">
                <div className="flex items-center gap-2 text-[11px] text-slate-400">
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: a.color || "#10b981" }} />
                  <span className="truncate">{a.name}</span>
                </div>
                <div className="text-sm font-bold font-mono text-white break-words">{formatKES(a.balance)}</div>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-slate-500">Balances are edited on the Finance page.</p>
        </Card>
      )}

      <Card title="Transactions">
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : data!.transactions.length === 0 ? (
          <EmptyState>No business money recorded yet. Use Money in when a client pays and Money out for business spending.</EmptyState>
        ) : (
          <div className="space-y-2">
            {data!.transactions.map((t) => (
              <div key={t.id} className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition-colors flex items-center justify-between gap-3">
                <div className="min-w-0 space-y-0.5">
                  <div className="text-xs font-semibold text-slate-100 break-words">{t.description}</div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500">
                    <span>{dayLabel(t.date)}</span>
                    <span>{t.category}</span>
                    {!businessId && t.business && (
                      <span className="flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: t.business.color }} />
                        {t.business.name}
                      </span>
                    )}
                    {t.client && <span>{t.client.name}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className={`text-xs font-mono font-semibold ${t.amount >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {t.amount >= 0 ? "+" : "-"}
                    {formatKES(Math.abs(t.amount))}
                  </span>
                  <button onClick={() => setModal({ editing: t, type: t.amount >= 0 ? "INCOME" : "EXPENSE" })} className="p-1.5 rounded-lg text-slate-500 hover:text-blue-400 hover:bg-slate-800 cursor-pointer" title="Edit" aria-label={`Edit ${t.description}`}>
                    <Edit3 className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => setDeleting(t)} className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer" title="Delete" aria-label={`Delete ${t.description}`}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {modal && (
        <TransactionModal
          businesses={businesses}
          defaultBusinessId={defaultBusinessId}
          defaultType={modal.type}
          editing={modal.editing}
          onClose={() => setModal(null)}
          onSaved={changed}
        />
      )}
      {deleting && (
        <ConfirmDelete
          title="Delete transaction?"
          busy={busy}
          onCancel={() => setDeleting(null)}
          onConfirm={remove}
          body={
            <>
              Delete <strong className="text-white">{deleting.description}</strong> ({formatKES(Math.abs(deleting.amount))})? It also disappears from your main Finance page.
            </>
          }
        />
      )}
    </div>
  );
}

