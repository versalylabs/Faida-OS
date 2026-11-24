"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Copy, Loader2, Pencil, Plus, Receipt, Trash2, X } from "lucide-react";
import { formatKES } from "@/lib/utils";

interface Bill {
  id: string;
  name: string;
  amount: number | null;
  category: string;
  paybill: string | null;
  accountNo: string | null;
  frequency: string;
  nextDueAt: string;
  remindDaysBefore: number;
  accountId: string | null;
  businessId: string | null;
  active: boolean;
  lastPaidAt: string | null;
  notes: string | null;
}

interface Option {
  id: string;
  name: string;
}

const FREQ_LABEL: Record<string, string> = { WEEKLY: "Weekly", MONTHLY: "Monthly", QUARTERLY: "Every 3 months", YEARLY: "Yearly", ONCE: "Once" };
const CATEGORIES = ["Bills", "Rent", "Utilities", "Internet", "Subscriptions", "School fees", "Insurance", "Loan", "Transport", "Business"];

/** Calendar date (YYYY-MM-DD) in Nairobi for an instant. */
const dayKey = (iso: string | Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Nairobi" }).format(new Date(iso));

function daysUntil(iso: string): number {
  return Math.round((Date.parse(`${dayKey(iso)}T12:00:00Z`) - Date.parse(`${dayKey(new Date())}T12:00:00Z`)) / 86400000);
}

function statusOf(bill: Bill): { text: string; tone: string } {
  if (!bill.active) return { text: "Finished", tone: "text-slate-400 border-white/10" };
  const d = daysUntil(bill.nextDueAt);
  if (d < 0) return { text: `Overdue ${-d} day${d === -1 ? "" : "s"}`, tone: "text-rose-200 border-rose-300/40 bg-rose-400/10" };
  if (d === 0) return { text: "Due today", tone: "text-amber-100 border-amber-300/40 bg-amber-400/10" };
  if (d === 1) return { text: "Due tomorrow", tone: "text-amber-100 border-amber-300/30" };
  if (d <= 7) return { text: `Due in ${d} days`, tone: "text-sky-100 border-sky-300/30" };
  return { text: `Due ${new Date(bill.nextDueAt).toLocaleDateString([], { day: "numeric", month: "short" })}`, tone: "text-slate-300 border-white/10" };
}

const emptyForm = () => ({
  id: "",
  name: "",
  amount: "",
  category: "Bills",
  paybill: "",
  accountNo: "",
  frequency: "MONTHLY",
  nextDue: dayKey(new Date()),
  remindDaysBefore: "2",
  accountId: "",
  businessId: "",
  notes: "",
});

/**
 * Bills: rent, KPLC, Wi-Fi, subscriptions. Shows what is due and what is overdue, the paybill and account number
 * to copy into M-Pesa, and a Paid button that logs the expense and lines up the next one.
 */
export function BillsSection({ onChanged }: { onChanged?: () => void }) {
  const [bills, setBills] = useState<Bill[] | null>(null);
  const [accounts, setAccounts] = useState<Option[]>([]);
  const [businesses, setBusinesses] = useState<Option[]>([]);
  const [form, setForm] = useState<ReturnType<typeof emptyForm> | null>(null);
  const [paying, setPaying] = useState<{ bill: Bill; amount: string; accountId: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/bills", { cache: "no-store" });
      const json = await res.json();
      if (json.success) {
        setBills(json.bills);
        setAccounts(json.accounts);
        setBusinesses(json.businesses);
      }
    } catch {
      // offline
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const flash = (text: string) => {
    setMessage(text);
    setTimeout(() => setMessage(null), 5000);
  };

  const send = async (method: string, body: object, okText: string) => {
    setBusy(true);
    try {
      const res = await fetch("/api/bills", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json();
      if (!json.success) {
        flash(json.error || "That did not save.");
        return false;
      }
      flash(okText);
      await load();
      onChanged?.();
      return true;
    } catch {
      flash("You seem to be offline. Try again when you're back.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!form) return;
    const body = {
      ...(form.id ? { id: form.id } : {}),
      name: form.name,
      amount: form.amount === "" ? null : form.amount,
      category: form.category,
      paybill: form.paybill,
      accountNo: form.accountNo,
      frequency: form.frequency,
      nextDue: form.nextDue,
      remindDaysBefore: form.remindDaysBefore,
      accountId: form.accountId || null,
      businessId: form.businessId || null,
      notes: form.notes,
    };
    if (await send(form.id ? "PATCH" : "POST", body, form.id ? "Bill updated." : "Bill added. You'll be reminded before it is due.")) setForm(null);
  };

  const pay = async () => {
    if (!paying) return;
    const ok = await send(
      "POST",
      { action: "paid", id: paying.bill.id, amount: paying.amount, accountId: paying.accountId || null },
      `Paid: ${paying.bill.name}. Logged in Finance${paying.bill.frequency === "ONCE" ? "." : " and the next one is lined up."}`
    );
    if (ok) setPaying(null);
  };

  const remove = async (bill: Bill) => {
    if (!confirm(`Delete the bill "${bill.name}"? Payments already logged stay in Finance.`)) return;
    setBusy(true);
    try {
      await fetch(`/api/bills?id=${encodeURIComponent(bill.id)}`, { method: "DELETE" });
      await load();
    } finally {
      setBusy(false);
    }
  };

  const copy = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // the number is on screen
    }
  };

  const active = (bills || []).filter((b) => b.active);
  const finished = (bills || []).filter((b) => !b.active);
  const dueSoonTotal = active.filter((b) => daysUntil(b.nextDueAt) <= 7).reduce((a, b) => a + (b.amount || 0), 0);
  const input = "w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-sky-400";

  const CopyChip = ({ id, label, value }: { id: string; label: string; value: string }) => (
    <button
      onClick={() => copy(id, value)}
      className="press inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-950/60 border border-white/10 text-[11px] text-slate-200 cursor-pointer"
      title={`Copy ${label}`}
    >
      {label} {value}
      {copied === id ? <Check className="h-3 w-3 text-emerald-300" /> : <Copy className="h-3 w-3 text-slate-400" />}
    </button>
  );

  return (
    <section id="bills" className="p-4 sm:p-5 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-3" aria-labelledby="bills-heading">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 id="bills-heading" className="text-sm font-semibold text-white flex items-center gap-2">
            <Receipt className="h-4 w-4 text-sky-300" />
            Bills
          </h2>
          <p className="text-xs text-slate-300">
            {active.length === 0
              ? "Add rent, KPLC, Wi-Fi or subscriptions to be reminded before they are due."
              : dueSoonTotal > 0
                ? `${formatKES(dueSoonTotal)} due in the next 7 days. Paying by M-Pesa marks a bill paid by itself when the SMS reaches Faida.`
                : "Nothing due in the next 7 days."}
          </p>
        </div>
        <button
          onClick={() => setForm(emptyForm())}
          className="press flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-sky-400/15 border border-sky-300/40 text-sky-50 text-xs font-semibold cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5" /> Add bill
        </button>
      </div>

      {message && <div className="p-2.5 rounded-xl bg-emerald-400/10 border border-emerald-300/30 text-xs text-emerald-100">{message}</div>}

      {active.length > 0 && (
        <div className="divide-y divide-white/5">
          {active.map((b) => {
            const s = statusOf(b);
            return (
              <div key={b.id} className="py-3 flex flex-col sm:flex-row sm:items-center gap-2">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-slate-100">{b.name}</span>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full border ${s.tone}`}>{s.text}</span>
                    <span className="text-[11px] text-slate-400">{FREQ_LABEL[b.frequency] || b.frequency}</span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {b.paybill && <CopyChip id={`${b.id}-pb`} label="Paybill/till" value={b.paybill} />}
                    {b.accountNo && <CopyChip id={`${b.id}-acc`} label="Acc" value={b.accountNo} />}
                  </div>
                </div>
                <div className="text-sm font-semibold tabular-nums text-slate-100">{b.amount ? formatKES(b.amount) : <span className="text-xs text-slate-400">Varies</span>}</div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setPaying({ bill: b, amount: b.amount ? String(b.amount) : "", accountId: b.accountId || "" })}
                    disabled={busy}
                    className="press px-3 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-300/40 text-emerald-50 text-xs font-medium cursor-pointer"
                  >
                    Paid
                  </button>
                  <button
                    onClick={() =>
                      setForm({
                        id: b.id,
                        name: b.name,
                        amount: b.amount ? String(b.amount) : "",
                        category: b.category,
                        paybill: b.paybill || "",
                        accountNo: b.accountNo || "",
                        frequency: b.frequency,
                        nextDue: dayKey(b.nextDueAt),
                        remindDaysBefore: String(b.remindDaysBefore),
                        accountId: b.accountId || "",
                        businessId: b.businessId || "",
                        notes: b.notes || "",
                      })
                    }
                    title="Edit"
                    className="press glass-orb h-8 w-8 text-slate-200 cursor-pointer"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => remove(b)} title="Delete" className="press glass-orb h-8 w-8 text-rose-200 cursor-pointer">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {finished.length > 0 && (
        <details className="text-xs text-slate-400">
          <summary className="cursor-pointer">Finished one-off bills ({finished.length})</summary>
          <ul className="mt-2 space-y-1">
            {finished.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate">{b.name}</span>
                <button onClick={() => remove(b)} className="text-rose-300 cursor-pointer">
                  Delete
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}

      {/* Mark paid */}
      {paying && (
        <div className="fixed inset-0 modal-overlay z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm" role="dialog" aria-label={`Pay ${paying.bill.name}`}>
          <div className="w-full max-w-sm p-5 rounded-3xl bg-slate-900 border border-slate-700 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Paid: {paying.bill.name}</h3>
              <button onClick={() => setPaying(null)} className="text-slate-400 cursor-pointer" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
            <label className="block text-xs text-slate-300">
              Amount paid (KES)
              <input type="number" inputMode="decimal" min="0" value={paying.amount} onChange={(e) => setPaying({ ...paying, amount: e.target.value })} className={`${input} mt-1`} autoFocus />
            </label>
            <label className="block text-xs text-slate-300">
              Paid from
              <select value={paying.accountId} onChange={(e) => setPaying({ ...paying, accountId: e.target.value })} className={`${input} mt-1`}>
                <option value="">No account (just record it)</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              onClick={pay}
              disabled={busy || !(Number(paying.amount) > 0)}
              className="press w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-semibold cursor-pointer flex items-center justify-center gap-2"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Log payment
            </button>
          </div>
        </div>
      )}

      {/* Add / edit */}
      {form && (
        <div className="fixed inset-0 modal-overlay z-50 flex items-start sm:items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto" role="dialog" aria-label={form.id ? "Edit bill" : "Add bill"}>
          <div className="w-full max-w-lg p-5 rounded-3xl bg-slate-900 border border-slate-700 space-y-3 my-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">{form.id ? "Edit bill" : "Add a bill"}</h3>
              <button onClick={() => setForm(null)} className="text-slate-400 cursor-pointer" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs text-slate-300 sm:col-span-2">
                Name
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Rent, KPLC tokens, Safaricom Home Fibre" className={`${input} mt-1`} autoFocus />
              </label>
              <label className="block text-xs text-slate-300">
                Amount (KES), empty if it varies
                <input type="number" inputMode="decimal" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className={`${input} mt-1`} />
              </label>
              <label className="block text-xs text-slate-300">
                Category
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={`${input} mt-1`}>
                  {[...new Set([form.category, ...CATEGORIES])].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label className="block text-xs text-slate-300">
                Paybill or till number
                <input value={form.paybill} onChange={(e) => setForm({ ...form, paybill: e.target.value })} placeholder="e.g. 888880" inputMode="numeric" className={`${input} mt-1`} />
              </label>
              <label className="block text-xs text-slate-300">
                Account number
                <input value={form.accountNo} onChange={(e) => setForm({ ...form, accountNo: e.target.value })} placeholder="e.g. meter or customer number" className={`${input} mt-1`} />
              </label>
              <label className="block text-xs text-slate-300">
                How often
                <select value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })} className={`${input} mt-1`}>
                  {Object.entries(FREQ_LABEL).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs text-slate-300">
                Next due date
                <input type="date" value={form.nextDue} onChange={(e) => setForm({ ...form, nextDue: e.target.value })} className={`${input} mt-1`} />
              </label>
              <label className="block text-xs text-slate-300">
                Remind me
                <select value={form.remindDaysBefore} onChange={(e) => setForm({ ...form, remindDaysBefore: e.target.value })} className={`${input} mt-1`}>
                  {[0, 1, 2, 3, 5, 7].map((d) => (
                    <option key={d} value={d}>
                      {d === 0 ? "On the day" : `${d} day${d === 1 ? "" : "s"} before`}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs text-slate-300">
                Paid from
                <select value={form.accountId} onChange={(e) => setForm({ ...form, accountId: e.target.value })} className={`${input} mt-1`}>
                  <option value="">Choose when paying</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>
              {businesses.length > 0 && (
                <label className="block text-xs text-slate-300">
                  Whose cost
                  <select value={form.businessId} onChange={(e) => setForm({ ...form, businessId: e.target.value })} className={`${input} mt-1`}>
                    <option value="">Personal</option>
                    {businesses.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            <p className="text-[11px] text-slate-400">
              Reminders come at your morning hour, then every morning while it is overdue. If you pay by M-Pesa and auto-import is on, the bill is marked paid by
              itself (matched by account number or name).
            </p>
            <button
              onClick={save}
              disabled={busy || !form.name.trim() || !form.nextDue}
              className="press w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-sm font-semibold cursor-pointer flex items-center justify-center gap-2"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {form.id ? "Save changes" : "Add bill"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
