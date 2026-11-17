"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Edit3, Minus, Plus, Trash2 } from "lucide-react";
import { offlineFetch } from "@/lib/offlineSync";
import { formatKpiValue } from "@/lib/kpis";
import { Badge, Card, ConfirmDelete, EmptyState, Field, Modal, ProgressBar, Skeleton, ghostBtn, inputCls, primaryBtn } from "@/components/business/ui";

export interface KpiRow {
  id: string;
  businessId: string;
  key: string;
  name: string;
  unit: "COUNT" | "PERCENT" | "CURRENCY" | string;
  period: "MONTH" | "TOTAL" | "LEVEL" | string;
  target: number;
  auto: boolean;
  autoKey: string | null;
  value: number;
  thisMonth: number;
  total: number;
  percent: number | null;
  history: { month: string; value: number }[];
}

export interface KpiBusiness {
  id: string;
  name: string;
  slug: string;
  color: string;
}

/** KPIs for one business, or for all when no id is given. Same data everywhere: tabs, overview and dashboard. */
export function useKpis(businessId?: string) {
  const [kpis, setKpis] = useState<KpiRow[]>([]);
  const [businesses, setBusinesses] = useState<KpiBusiness[]>([]);
  const [month, setMonth] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const latest = useRef(0);
  const reload = useCallback(async () => {
    const mine = ++latest.current;
    try {
      const res = await offlineFetch(`/api/business/kpis${businessId ? `?businessId=${businessId}` : ""}`, { cache: "no-store" });
      const data = await res.json();
      if (mine !== latest.current) return; // a newer request has been made since: its answer wins
      if (data.success) {
        setKpis(data.kpis || []);
        setBusinesses(data.businesses || []);
        setMonth(data.month || "");
        setError("");
      } else setError(data.error || "Could not load KPIs");
    } catch {
      setError("Could not load KPIs");
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { kpis, businesses, month, loading, error, reload };
}

const PERIOD_LABEL: Record<string, string> = { MONTH: "this month", TOTAL: "in total", LEVEL: "latest" };
const monthName = (key: string) => (key ? new Date(`${key}-01T12:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }) : "");
const shortMonth = (key: string) => new Date(`${key}-01T12:00:00Z`).toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" });

const barColor = (percent: number | null) => (percent === null ? "#64748b" : percent >= 100 ? "#10b981" : percent >= 50 ? "#3b82f6" : "#f59e0b");

function KpiModal({ businessId, editing, onClose, onSaved }: { businessId: string; editing: KpiRow | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(editing?.name ?? "");
  const [unit, setUnit] = useState(editing?.unit ?? "COUNT");
  const [period, setPeriod] = useState(editing?.period ?? "MONTH");
  const [target, setTarget] = useState(editing ? String(editing.target) : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      const payload = { name: name.trim(), unit, period, target: parseFloat(target) || 0 };
      const res = await offlineFetch("/api/business/kpis", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing ? { id: editing.id, ...payload } : { businessId, ...payload }),
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
    <Modal title={editing ? `Edit: ${editing.name}` : "Add something to track"} onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        <Field label="What do you want to measure? *">
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} autoFocus required maxLength={80} placeholder="e.g. Proposals sent, Referrals, Calls booked" />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Target">
            <input type="number" min="0" step="any" value={target} onChange={(e) => setTarget(e.target.value)} className={inputCls} placeholder="0 = none yet" />
          </Field>
          <Field label="Measured as">
            <select value={unit} onChange={(e) => setUnit(e.target.value)} className={inputCls}>
              <option value="COUNT">A count</option>
              <option value="PERCENT">A percentage</option>
              <option value="CURRENCY">Money (KES)</option>
            </select>
          </Field>
          <Field label="Counted">
            <select value={period} onChange={(e) => setPeriod(e.target.value)} className={inputCls} disabled={editing?.auto}>
              <option value="MONTH">Each month</option>
              <option value="TOTAL">All months added up</option>
              <option value="LEVEL">Latest figure</option>
            </select>
          </Field>
        </div>
        {editing?.auto && <p className="text-[11px] text-slate-500">This figure is worked out from your clients or money. You can change its name and target.</p>}
        {error && <p className="text-xs text-rose-400">{error}</p>}
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
          <button type="button" onClick={onClose} className={ghostBtn}>
            Cancel
          </button>
          <button type="submit" disabled={!name.trim() || busy} className={primaryBtn}>
            {busy ? "Saving..." : editing ? "Save changes" : "Add"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function KpiCard({ k, onChanged, onEdit, onDelete }: { k: KpiRow; onChanged: () => void; onEdit: () => void; onDelete: () => void }) {
  const [setting, setSetting] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const color = barColor(k.percent);
  const maxHist = Math.max(1, ...k.history.map((h) => h.value));
  const step = k.unit === "COUNT" ? 1 : k.unit === "PERCENT" ? 5 : 1000;

  const log = async (body: Record<string, number>) => {
    if (busy) return;
    setBusy(true);
    try {
      await offlineFetch("/api/business/kpis", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: k.id, ...body }) });
    } catch {}
    setBusy(false);
    onChanged();
  };

  // MONTH and TOTAL KPIs are counted up in steps; a LEVEL (like satisfaction) is set to the latest figure
  const level = k.period === "LEVEL";

  return (
    <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3 min-w-0">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-xs font-bold text-slate-100 break-words">{k.name}</h3>
          <div className="flex flex-wrap items-center gap-1.5 mt-1">
            <Badge tone="slate">{PERIOD_LABEL[k.period] ?? k.period}</Badge>
            {k.auto && <Badge tone="blue">automatic</Badge>}
          </div>
        </div>
        <div className="flex items-center shrink-0">
          <button onClick={onEdit} className="p-1.5 rounded-lg text-slate-500 hover:text-blue-400 hover:bg-slate-800 cursor-pointer" title="Edit" aria-label={`Edit ${k.name}`}>
            <Edit3 className="h-3.5 w-3.5" />
          </button>
          <button onClick={onDelete} className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer" title="Delete" aria-label={`Delete ${k.name}`}>
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div>
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <span className="text-2xl font-bold font-mono text-white break-words">{formatKpiValue(k.value, k.unit)}</span>
          {k.target > 0 && <span className="text-xs font-mono text-slate-500">/ {formatKpiValue(k.target, k.unit)}</span>}
        </div>
        {k.target > 0 ? (
          <div className="mt-2 space-y-1">
            <ProgressBar percent={Math.min(100, k.percent ?? 0)} color={color} />
            <div className="text-[11px] font-mono" style={{ color }}>
              {k.percent}% of target{k.percent !== null && k.percent >= 100 ? ", reached" : ""}
            </div>
          </div>
        ) : (
          <div className="text-[11px] text-slate-500 mt-1">No target yet. Use the pencil to set one.</div>
        )}
      </div>

      {!k.auto && (
        <div className="space-y-2">
          {setting ? (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const n = parseFloat(draft);
                if (Number.isFinite(n) && n >= 0) await log({ setValue: n });
                setSetting(false);
              }}
              className="flex items-center gap-2"
            >
              <input type="number" min="0" step="any" value={draft} onChange={(e) => setDraft(e.target.value)} className="w-24 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500" autoFocus aria-label={`Set ${k.name}`} />
              <button type="submit" className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-semibold cursor-pointer">
                Save
              </button>
              <button type="button" onClick={() => setSetting(false)} className="text-[11px] text-slate-400 hover:text-slate-200 cursor-pointer">
                Cancel
              </button>
            </form>
          ) : (
            <div className="flex items-center gap-1.5">
              {!level && (
                <>
                  <button onClick={() => log({ add: -step })} disabled={busy || k.thisMonth <= 0} className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 cursor-pointer disabled:opacity-40" aria-label={`Take ${step} off ${k.name}`}>
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => log({ add: step })} disabled={busy} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-semibold cursor-pointer disabled:opacity-50" aria-label={`Add ${step} to ${k.name}`}>
                    <Plus className="h-3.5 w-3.5" /> {step > 1 ? step.toLocaleString() : "1"}
                  </button>
                </>
              )}
              <button
                onClick={() => {
                  setDraft(String(level ? k.value : k.thisMonth));
                  setSetting(true);
                }}
                className="px-2.5 py-1.5 rounded-lg text-[11px] text-slate-300 hover:text-white bg-slate-800/60 hover:bg-slate-800 border border-slate-700 cursor-pointer"
              >
                {level ? "Update" : "Set this month"}
              </button>
            </div>
          )}
          {k.period === "TOTAL" && <p className="text-[10px] text-slate-500">{formatKpiValue(k.thisMonth, k.unit)} added this month, {formatKpiValue(k.total, k.unit)} in all.</p>}
        </div>
      )}

      <div className="flex items-end gap-1 h-8" aria-hidden="true">
        {k.history.map((h) => (
          <div key={h.month} className="flex-1 flex flex-col items-center justify-end gap-0.5 h-full min-w-0" title={`${shortMonth(h.month)}: ${formatKpiValue(h.value, k.unit)}`}>
            <div className="w-full rounded-sm bg-slate-700/70" style={{ height: `${(h.value / maxHist) * 100}%`, minHeight: h.value > 0 ? 2 : 0 }} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** The KPI tracker for one business: update the numbers as you go and see them against your targets. */
export function KpiSection({ businessId, businessName, onChanged }: { businessId: string; businessName: string; onChanged?: () => void }) {
  const { kpis, month, loading, error, reload } = useKpis(businessId);
  const [modal, setModal] = useState<{ editing: KpiRow | null } | null>(null);
  const [deleting, setDeleting] = useState<KpiRow | null>(null);
  const [busy, setBusy] = useState(false);

  const changed = () => {
    reload();
    onChanged?.();
  };

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    await offlineFetch(`/api/business/kpis?id=${deleting.id}`, { method: "DELETE" }).catch(() => {});
    setBusy(false);
    setDeleting(null);
    changed();
  };

  const withTarget = kpis.filter((k) => k.percent !== null);
  const reached = withTarget.filter((k) => (k.percent ?? 0) >= 100).length;

  return (
    <div className="space-y-4">
      <Card
        title={`KPIs: ${monthName(month) || "this month"}`}
        action={
          <button onClick={() => setModal({ editing: null })} className={`${primaryBtn} flex items-center gap-1.5`}>
            <Plus className="h-3.5 w-3.5" /> Add KPI
          </button>
        }
      >
        <p className="text-[11px] text-slate-400 leading-relaxed">
          What {businessName} measures. Tap + as things happen (a message sent, a call held), or set a figure. Automatic ones follow your clients and money. Targets are the business plan&apos;s starting proposals: edit any of them. The small bars show the last six months.
        </p>
        {!loading && withTarget.length > 0 && (
          <p className="text-xs text-slate-300">
            <span className="font-semibold text-white">{reached}</span> of {withTarget.length} targets reached
          </p>
        )}
        {error && <p className="text-xs text-rose-400">{error}</p>}
      </Card>

      {loading ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,17rem),1fr))] gap-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-44 w-full" />
          ))}
        </div>
      ) : kpis.length === 0 ? (
        <EmptyState>Nothing is being tracked yet. Add the first KPI.</EmptyState>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,17rem),1fr))] gap-4">
          {kpis.map((k) => (
            <KpiCard key={k.id} k={k} onChanged={changed} onEdit={() => setModal({ editing: k })} onDelete={() => setDeleting(k)} />
          ))}
        </div>
      )}

      {modal && <KpiModal businessId={businessId} editing={modal.editing} onClose={() => setModal(null)} onSaved={changed} />}
      {deleting && (
        <ConfirmDelete
          title="Stop tracking this?"
          busy={busy}
          onCancel={() => setDeleting(null)}
          onConfirm={remove}
          body={
            <>
              Delete <strong className="text-white">{deleting.name}</strong> and everything recorded for it? This cannot be undone.
            </>
          }
        />
      )}
    </div>
  );
}

/** A short KPI progress list for overview pages. Pass `kpis` for the businesses to show. */
export function KpiSummary({ kpis, loading, limit = 5, onOpen }: { kpis: KpiRow[]; loading: boolean; limit?: number; onOpen?: () => void }) {
  const tracked = kpis.filter((k) => k.target > 0);
  // The ones furthest from their target first: that is where attention is needed
  const shown = [...tracked].sort((a, b) => (a.percent ?? 0) - (b.percent ?? 0)).slice(0, limit);
  if (loading) return <Skeleton className="h-24 w-full" />;
  if (tracked.length === 0) return <EmptyState>No KPI targets set yet.</EmptyState>;
  return (
    <div className="space-y-2.5">
      {shown.map((k) => (
        <div key={k.id} className="space-y-1">
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="text-slate-300 truncate">{k.name}</span>
            <span className="font-mono text-slate-200 shrink-0">
              {formatKpiValue(k.value, k.unit)} <span className="text-slate-500">/ {formatKpiValue(k.target, k.unit)}</span>
            </span>
          </div>
          <ProgressBar percent={Math.min(100, k.percent ?? 0)} color={barColor(k.percent)} />
        </div>
      ))}
      {tracked.length > shown.length && onOpen && (
        <button onClick={onOpen} className="text-[11px] text-blue-400 hover:underline cursor-pointer">
          See all {tracked.length} KPIs
        </button>
      )}
    </div>
  );
}
