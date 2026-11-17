"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Edit3, ExternalLink, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { offlineFetch } from "@/lib/offlineSync";
import { formatKES } from "@/lib/utils";
import { PURCHASE_CATEGORIES } from "@/lib/businessMath";
import type { BusinessItem, PurchaseItem } from "@/components/business/types";
import { useAccounts } from "@/components/business/useAccounts";
import { Badge, Card, ConfirmDelete, EmptyState, Field, Modal, Skeleton, Stat, dayLabel, daysFromToday, ghostBtn, inputCls, primaryBtn } from "@/components/business/ui";

const PRIORITY_RANK: Record<string, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
const PRIORITY_TONE: Record<string, "slate" | "blue" | "amber" | "rose"> = { LOW: "slate", MEDIUM: "blue", HIGH: "amber", URGENT: "rose" };
const categoryLabel = (v: string) => PURCHASE_CATEGORIES.find((c) => c.value === v)?.label ?? v;

function PurchaseModal({
  businesses,
  defaultBusinessId,
  editing,
  onClose,
  onSaved,
}: {
  businesses: BusinessItem[];
  defaultBusinessId: string;
  editing: PurchaseItem | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [businessId, setBusinessId] = useState(editing?.businessId ?? defaultBusinessId);
  const [name, setName] = useState(editing?.name ?? "");
  const [category, setCategory] = useState(editing?.category ?? "EQUIPMENT");
  const [cost, setCost] = useState(editing ? String(editing.estimatedCost) : "");
  const [priority, setPriority] = useState(editing?.priority ?? "MEDIUM");
  const [status, setStatus] = useState(editing?.status === "PLANNED" ? "PLANNED" : "WISHLIST");
  const [neededBy, setNeededBy] = useState(editing?.neededBy ? new Date(editing.neededBy).toISOString().slice(0, 10) : "");
  const [link, setLink] = useState(editing?.link ?? "");
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      const common = {
        name: name.trim(),
        category,
        estimatedCost: parseFloat(cost) || 0,
        priority,
        neededBy: neededBy || null,
        link: link.trim() || null,
        notes: notes.trim() || null,
      };
      const body = editing ? { id: editing.id, ...common, ...(editing.status !== "BOUGHT" ? { status } : {}) } : { businessId, ...common };
      const res = await offlineFetch("/api/business/purchases", {
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
    <Modal title={editing ? "Edit item" : "Add something to buy"} onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        <Field label="What do you need? *">
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} autoFocus required maxLength={200} placeholder="e.g. Mirrorless camera, ring light" />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Estimated cost (KES)">
            <input type="number" min="0" step="any" value={cost} onChange={(e) => setCost(e.target.value)} className={inputCls} placeholder="0" />
          </Field>
          <Field label="Category">
            <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
              {PURCHASE_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Priority">
            <select value={priority} onChange={(e) => setPriority(e.target.value)} className={inputCls}>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
          </Field>
          <Field label="Needed by">
            <input type="date" value={neededBy} onChange={(e) => setNeededBy(e.target.value)} className={inputCls} />
          </Field>
          {editing && editing.status !== "BOUGHT" ? (
            <Field label="Status">
              <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls}>
                <option value="WISHLIST">Wishlist</option>
                <option value="PLANNED">Planned</option>
              </select>
            </Field>
          ) : (
            !editing && (
              <Field label="Business">
                <select value={businessId} onChange={(e) => setBusinessId(e.target.value)} className={inputCls}>
                  {businesses.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </Field>
            )
          )}
        </div>
        <Field label="Link to the product or shop">
          <input type="url" value={link} onChange={(e) => setLink(e.target.value)} className={inputCls} placeholder="https://" maxLength={500} />
        </Field>
        <Field label="Notes">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputCls} maxLength={2000} placeholder="Why you need it, model, where to buy" />
        </Field>
        {error && <p className="text-xs text-rose-400">{error}</p>}
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
          <button type="button" onClick={onClose} className={ghostBtn}>
            Cancel
          </button>
          <button type="submit" disabled={!name.trim() || busy} className={primaryBtn}>
            {busy ? "Saving..." : editing ? "Save changes" : "Add item"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function BoughtModal({ item, onClose, onSaved }: { item: PurchaseItem; onClose: () => void; onSaved: () => void }) {
  const [cost, setCost] = useState(String(item.estimatedCost || ""));
  const [logExpense, setLogExpense] = useState(true);
  const { accounts, loaded } = useAccounts();
  const [accountId, setAccountId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (loaded && !accountId) setAccountId(accounts.find((a) => a.isDefault)?.id ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await offlineFetch("/api/business/purchases", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, status: "BOUGHT", actualCost: parseFloat(cost) || 0, logExpense, accountId: accountId || null }),
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
    <Modal title={`Bought: ${item.name}`} onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        <Field label="What did it actually cost? (KES)">
          <input type="number" min="0" step="any" value={cost} onChange={(e) => setCost(e.target.value)} className={inputCls} autoFocus />
        </Field>
        <label className="flex items-start gap-2 text-xs text-slate-300 cursor-pointer">
          <input type="checkbox" checked={logExpense} onChange={(e) => setLogExpense(e.target.checked)} className="accent-blue-500 mt-0.5" />
          <span>Also record it as a business expense, so it shows in this business's money and in your Finance page.</span>
        </label>
        {logExpense && (
          <Field label="Paid from account" hint="The cost comes off this account's balance.">
            <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className={inputCls}>
              <option value="">No account (do not change a balance)</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} · {formatKES(a.balance)}
                </option>
              ))}
            </select>
          </Field>
        )}
        {error && <p className="text-xs text-rose-400">{error}</p>}
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
          <button type="button" onClick={onClose} className={ghostBtn}>
            Cancel
          </button>
          <button type="submit" disabled={busy} className={primaryBtn}>
            {busy ? "Saving..." : "Mark as bought"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** The things a business still needs to buy (a camera, software, a laptop...), and what has been bought. */
export function PurchasesSection({
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
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modal, setModal] = useState<{ item: PurchaseItem | null } | null>(null);
  const [bought, setBought] = useState<PurchaseItem | null>(null);
  const [deleting, setDeleting] = useState<PurchaseItem | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await offlineFetch(`/api/business/purchases${businessId ? `?businessId=${businessId}` : ""}`, { cache: "no-store" });
      const json = await res.json();
      if (json.success) {
        setItems(json.purchases || []);
        setError("");
      } else setError(json.error || "Could not load the list");
    } catch {
      setError("Could not load the list");
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
    await offlineFetch(`/api/business/purchases?id=${deleting.id}`, { method: "DELETE" }).catch(() => {});
    setBusy(false);
    setDeleting(null);
    changed();
  };

  const toBuy = items
    .filter((p) => p.status !== "BOUGHT")
    .sort((a, b) => (PRIORITY_RANK[a.priority] ?? 2) - (PRIORITY_RANK[b.priority] ?? 2) || (a.neededBy ? Date.parse(a.neededBy) : Infinity) - (b.neededBy ? Date.parse(b.neededBy) : Infinity));
  const done = items.filter((p) => p.status === "BOUGHT").sort((a, b) => Date.parse(b.purchasedAt || b.createdAt) - Date.parse(a.purchasedAt || a.createdAt));
  const estimate = toBuy.reduce((a, p) => a + (p.estimatedCost || 0), 0);
  const spent = done.reduce((a, p) => a + (p.actualCost ?? p.estimatedCost ?? 0), 0);
  const nameOf = (id: string) => businesses.find((b) => b.id === id);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <Stat label="Still to buy" loading={loading} value={formatKES(estimate)} sub={`${toBuy.length} item${toBuy.length === 1 ? "" : "s"}`} icon={<ShoppingBag className="h-4 w-4 text-amber-400" />} />
        <Stat label="Already bought" loading={loading} value={formatKES(spent)} sub={`${done.length} item${done.length === 1 ? "" : "s"}`} icon={<Check className="h-4 w-4 text-emerald-400" />} />
      </div>

      {error && <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">{error}</div>}

      <Card
        title="To buy"
        action={
          <button onClick={() => setModal({ item: null })} className={`${primaryBtn} flex items-center gap-1.5`}>
            <Plus className="h-3.5 w-3.5" /> Add item
          </button>
        }
      >
        {loading ? (
          <Skeleton className="h-16 w-full" />
        ) : toBuy.length === 0 ? (
          <EmptyState>Nothing on the list. Add equipment, software or anything the business needs to buy, with a rough cost and when you need it.</EmptyState>
        ) : (
          <div className="space-y-2">
            {toBuy.map((p) => {
              const days = daysFromToday(p.neededBy);
              const biz = !businessId ? nameOf(p.businessId) : null;
              return (
                <div key={p.id} className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition-colors flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="text-xs font-semibold text-slate-100 break-words">{p.name}</div>
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                      {biz && (
                        <span className="flex items-center gap-1">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: biz.color }} />
                          {biz.name}
                        </span>
                      )}
                      <Badge tone="slate">{categoryLabel(p.category)}</Badge>
                      <Badge tone={PRIORITY_TONE[p.priority] ?? "slate"}>{p.priority.toLowerCase()}</Badge>
                      {p.status === "PLANNED" && <Badge tone="purple">planned</Badge>}
                      {p.neededBy && <Badge tone={days !== null && days < 0 ? "rose" : days !== null && days <= 7 ? "amber" : "slate"}>needed {days !== null && days < 0 ? "(late) " : ""}{dayLabel(p.neededBy)}</Badge>}
                    </div>
                    {p.notes && <p className="text-[11px] text-slate-500 break-words">{p.notes}</p>}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-xs font-mono font-semibold text-slate-200 mr-1">{formatKES(p.estimatedCost)}</span>
                    {p.link && (
                      <a href={p.link} target="_blank" rel="noreferrer" className="p-1.5 rounded-lg text-slate-500 hover:text-blue-400 hover:bg-slate-800" title="Open link" aria-label={`Open link for ${p.name}`}>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                    <button onClick={() => setBought(p)} className="px-2.5 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 text-emerald-300 text-[11px] font-semibold cursor-pointer flex items-center gap-1">
                      <Check className="h-3 w-3" /> Bought
                    </button>
                    <button onClick={() => setModal({ item: p })} className="p-1.5 rounded-lg text-slate-500 hover:text-blue-400 hover:bg-slate-800 cursor-pointer" title="Edit" aria-label={`Edit ${p.name}`}>
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => setDeleting(p)} className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer" title="Delete" aria-label={`Delete ${p.name}`}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {done.length > 0 && (
        <Card title="Bought">
          <div className="space-y-2">
            {done.slice(0, 15).map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-950/40 border border-slate-800/60">
                <div className="min-w-0">
                  <div className="text-xs text-slate-300 break-words">{p.name}</div>
                  <div className="text-[11px] text-slate-500">{p.purchasedAt ? dayLabel(p.purchasedAt) : ""}</div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-xs font-mono text-slate-400">{formatKES(p.actualCost ?? p.estimatedCost)}</span>
                  <button onClick={() => setDeleting(p)} className="p-1.5 rounded-lg text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer" title="Delete" aria-label={`Delete ${p.name}`}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {modal && <PurchaseModal businesses={businesses} defaultBusinessId={defaultBusinessId} editing={modal.item} onClose={() => setModal(null)} onSaved={changed} />}
      {bought && <BoughtModal item={bought} onClose={() => setBought(null)} onSaved={changed} />}
      {deleting && (
        <ConfirmDelete
          title="Delete item?"
          busy={busy}
          onCancel={() => setDeleting(null)}
          onConfirm={remove}
          body={
            <>
              Delete <strong className="text-white">{deleting.name}</strong> from the list? An expense you already recorded for it is not removed.
            </>
          }
        />
      )}
    </div>
  );
}
