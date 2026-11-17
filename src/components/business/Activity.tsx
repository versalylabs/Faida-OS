"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { offlineFetch } from "@/lib/offlineSync";
import { nairobiToday } from "@/lib/dueDay";
import { formatKES } from "@/lib/utils";
import type { BusinessItem, MetricItem } from "@/components/business/types";
import { Card, ConfirmDelete, EmptyState, Field, Modal, dayLabel, ghostBtn, inputCls, primaryBtn } from "@/components/business/ui";

const todayInput = nairobiToday;

type Variant = "default" | "versaly";

function ActivityModal({ business, variant, onClose, onSaved }: { business: BusinessItem; variant: Variant; onClose: () => void; onSaved: () => void }) {
  const [week, setWeek] = useState(todayInput());
  const [f, setF] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setF((p) => ({ ...p, [k]: e.target.value }));
  const num = (k: string) => (f[k] === undefined || f[k] === "" ? 0 : parseFloat(f[k]) || 0);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await offlineFetch("/api/business/metrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId: business.id,
          weekStartDate: week,
          outreachSent: num("outreach"),
          auditsBooked: num("audits"),
          closeRate: num("closeRate"),
          replyRateWarm: num("replyWarm"),
          replyRateCold: num("replyCold"),
          showRate: num("showRate"),
          avgTimeToLiveDays: num("timeToLive"),
          clientChurnCount: num("churn"),
          referralsCount: num("referrals"),
          cac: num("cac"),
          ltv: num("ltv"),
          mrr: 0,
          notes: notes.trim(),
        }),
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

  const numField = (key: string, label: string, hint?: string) => (
    <Field label={label} hint={hint}>
      <input type="number" min="0" step="any" value={f[key] ?? ""} onChange={set(key)} className={inputCls} placeholder="0" />
    </Field>
  );

  return (
    <Modal title={`Log sales activity: ${business.name}`} onClose={onClose} wide>
      <form onSubmit={save} className="space-y-3">
        <p className="text-[11px] text-slate-500">Enter what actually happened. Anything you leave empty is recorded as 0.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Week starting">
            <input type="date" value={week} onChange={(e) => setWeek(e.target.value)} className={inputCls} />
          </Field>
          {numField("outreach", variant === "versaly" ? "Businesses contacted" : "Outreach messages sent")}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {numField("audits", variant === "versaly" ? "Discovery conversations and demos held" : "Consultations / audits booked")}
          {numField("closeRate", "Close rate (%)", "Of proposals sent, how many said yes")}
        </div>
        <button type="button" onClick={() => setMore((m) => !m)} className="text-[11px] text-blue-400 hover:text-blue-300 cursor-pointer">
          {more ? "Hide" : "Show"} more numbers
        </button>
        {more && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {numField("replyWarm", "Warm reply rate (%)")}
            {numField("replyCold", "Cold reply rate (%)")}
            {numField("showRate", "Show rate (%)")}
            {numField("timeToLive", "Days to deliver")}
            {numField("churn", "Clients lost")}
            {numField("referrals", "Referrals")}
            {numField("cac", "Cost to win a client (KES)")}
            {numField("ltv", "Lifetime value (KES)")}
          </div>
        )}
        <Field label="Notes">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputCls} maxLength={5000} placeholder="What worked, what did not, objections heard" />
        </Field>
        {error && <p className="text-xs text-rose-400">{error}</p>}
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
          <button type="button" onClick={onClose} className={ghostBtn}>
            Cancel
          </button>
          <button type="submit" disabled={busy} className={primaryBtn}>
            {busy ? "Saving..." : "Save week"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** A log of weekly sales effort (outreach, consultations, close rate) for one business. */
export function ActivitySection({ business, onChanged, variant = "default" }: { business: BusinessItem; onChanged: () => void; variant?: Variant }) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState<MetricItem | null>(null);
  const [busy, setBusy] = useState(false);
  const rows = business.weeklyMetrics;

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    await offlineFetch(`/api/business/metrics?id=${deleting.id}`, { method: "DELETE" }).catch(() => {});
    setBusy(false);
    setDeleting(null);
    onChanged();
  };

  return (
    <>
      <Card
        title="Weekly sales activity"
        action={
          <button onClick={() => setOpen(true)} className={`${primaryBtn} flex items-center gap-1.5`}>
            <Plus className="h-3.5 w-3.5" /> Log a week
          </button>
        }
      >
        {rows.length === 0 ? (
          <EmptyState>No weeks logged yet. Log your outreach and consultations each week to see how your sales effort turns into clients.</EmptyState>
        ) : (
          <div className="overflow-x-auto -mx-1 px-1">
            <table className="w-full text-xs min-w-[34rem]">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-800">
                  <th className="py-2 pr-3 font-semibold">Week of</th>
                  <th className="py-2 pr-3 font-semibold">{variant === "versaly" ? "Contacted" : "Outreach"}</th>
                  <th className="py-2 pr-3 font-semibold">{variant === "versaly" ? "Discovery / demos" : "Consultations"}</th>
                  <th className="py-2 pr-3 font-semibold">Close rate</th>
                  <th className="py-2 pr-3 font-semibold">Cost / client</th>
                  <th className="py-2 w-8" />
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => (
                  <tr key={m.id} className="border-b border-slate-800/60 last:border-0 align-top">
                    <td className="py-2.5 pr-3 text-slate-300">{dayLabel(m.weekStartDate)}</td>
                    <td className="py-2.5 pr-3 font-mono text-slate-200">{m.outreachSent}</td>
                    <td className="py-2.5 pr-3 font-mono text-slate-200">{m.auditsBooked}</td>
                    <td className="py-2.5 pr-3 font-mono text-slate-200">{m.closeRate}%</td>
                    <td className="py-2.5 pr-3 font-mono text-slate-400">{m.cac > 0 ? formatKES(m.cac) : "-"}</td>
                    <td className="py-1.5 text-right">
                      <button onClick={() => setDeleting(m)} className="p-1.5 rounded-lg text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer" title="Delete entry" aria-label="Delete entry">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {open && <ActivityModal business={business} variant={variant} onClose={() => setOpen(false)} onSaved={onChanged} />}
      {deleting && (
        <ConfirmDelete
          title="Delete this week?"
          busy={busy}
          onCancel={() => setDeleting(null)}
          onConfirm={remove}
          body={<>Delete the entry for the week of {dayLabel(deleting.weekStartDate)}? This cannot be undone.</>}
        />
      )}
    </>
  );
}
