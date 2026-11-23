"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, CheckCheck, Loader2, Smartphone, Trash2 } from "lucide-react";
import { formatKES } from "@/lib/utils";

interface ReviewItem {
  id: string;
  description: string;
  amount: number;
  type: string;
  category: string;
  date: string;
  businessId: string | null;
}

interface ReviewData {
  items: ReviewItem[];
  categories: { name: string; type: string }[];
  businesses: { id: string; name: string }[];
}

const COMMON = ["Food", "Transport", "Airtime", "Utilities", "Internet", "Rent", "Shopping", "Health", "Entertainment", "Family", "Business", "Income", "Savings"];

/**
 * "To check": money logged automatically from forwarded M-Pesa SMS. Each one can be confirmed, filed under a
 * category (which Faida then remembers for that merchant), or removed. Hidden when there is nothing to check.
 */
export function MpesaReview({ onChanged }: { onChanged?: () => void }) {
  const [data, setData] = useState<ReviewData | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/finance/review", { cache: "no-store" });
      const json = await res.json();
      if (json.success) setData(json);
    } catch {
      // offline: the section simply stays hidden
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const post = async (key: string, body: object, done: string) => {
    setBusy(key);
    try {
      const res = await fetch("/api/finance/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.success) {
        setNote(json.remembered ? `${done} Faida will file this merchant the same way from now on.` : done);
        setTimeout(() => setNote(null), 5000);
        await load();
        onChanged?.();
      } else {
        setNote(json.error || "That did not save.");
      }
    } catch {
      setNote("You seem to be offline. Try again when you're back.");
    } finally {
      setBusy(null);
    }
  };

  if (!data || data.items.length === 0) {
    return note ? <div className="p-3 rounded-2xl bg-emerald-400/10 border border-emerald-300/30 text-sm text-emerald-100">{note}</div> : null;
  }

  const categories = [...new Set([...data.categories.map((c) => c.name), ...COMMON])].sort();
  const totalOut = data.items.filter((i) => i.amount < 0).reduce((a, i) => a - i.amount, 0);
  const totalIn = data.items.filter((i) => i.amount > 0).reduce((a, i) => a + i.amount, 0);

  return (
    <section id="review" className="p-4 sm:p-5 rounded-3xl bg-slate-900/60 border border-amber-300/30 space-y-3" aria-labelledby="review-heading">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 id="review-heading" className="text-sm font-semibold text-white flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-amber-300" />
            To check: {data.items.length} from M-Pesa
          </h2>
          <p className="text-xs text-slate-300">
            {totalOut > 0 && <>Out {formatKES(totalOut)}</>}
            {totalOut > 0 && totalIn > 0 && " · "}
            {totalIn > 0 && <>In {formatKES(totalIn)}</>}
            . Already in your balances. Change a category and Faida remembers it for that merchant.
          </p>
        </div>
        <button
          onClick={() => post("all", { action: "confirm" }, `All ${data.items.length} marked as checked.`)}
          disabled={busy !== null}
          className="press flex items-center justify-center gap-2 px-4 py-2 rounded-full bg-emerald-500/20 border border-emerald-300/40 text-emerald-50 text-sm font-medium cursor-pointer disabled:opacity-50 shrink-0"
        >
          {busy === "all" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCheck className="h-4 w-4" />}
          All correct
        </button>
      </div>

      {note && <div className="p-2.5 rounded-xl bg-emerald-400/10 border border-emerald-300/30 text-xs text-emerald-100">{note}</div>}

      <div className="divide-y divide-white/5">
        {data.items.map((item) => (
          <div key={item.id} className="py-2.5 flex flex-col sm:flex-row sm:items-center gap-2">
            <div className="min-w-0 flex-1">
              <div className="text-sm text-slate-100 truncate">{item.description}</div>
              <div className="text-xs text-slate-400">
                {new Date(item.date).toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>
            <div className={`text-sm font-semibold tabular-nums ${item.amount < 0 ? "text-rose-200" : "text-emerald-200"}`}>
              {item.amount < 0 ? "−" : "+"}
              {formatKES(Math.abs(item.amount))}
            </div>
            <div className="flex items-center gap-1.5">
              <select
                value={item.category}
                onChange={(e) => post(item.id, { action: "file", id: item.id, category: e.target.value, businessId: item.businessId }, `Filed under ${e.target.value}.`)}
                disabled={busy !== null}
                aria-label={`Category for ${item.description}`}
                className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200 max-w-[9.5rem]"
              >
                {!categories.includes(item.category) && <option value={item.category}>{item.category}</option>}
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              {data.businesses.length > 0 && (
                <select
                  value={item.businessId ?? ""}
                  onChange={(e) => post(item.id, { action: "file", id: item.id, category: item.category, businessId: e.target.value || null }, e.target.value ? "Filed under the business." : "Filed as personal.")}
                  disabled={busy !== null}
                  aria-label={`Business for ${item.description}`}
                  className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200 max-w-[8rem]"
                >
                  <option value="">Personal</option>
                  {data.businesses.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              )}
              <button
                onClick={() => post(item.id, { action: "confirm", ids: [item.id] }, "Checked.")}
                disabled={busy !== null}
                title="Looks right"
                className="press glass-orb h-8 w-8 text-emerald-200 cursor-pointer"
              >
                {busy === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              </button>
              <button
                onClick={() => {
                  if (confirm(`Remove "${item.description}"? Its amount comes back out of your balance.`)) post(item.id, { action: "remove", id: item.id }, "Removed.");
                }}
                disabled={busy !== null}
                title="Not a real transaction: remove it"
                className="press glass-orb h-8 w-8 text-rose-200 cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
