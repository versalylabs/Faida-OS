"use client";

import { useState } from "react";
import { Calendar, Edit3, Plus, Trash2 } from "lucide-react";
import { offlineFetch } from "@/lib/offlineSync";
import type { BusinessItem, DeliverableItem } from "@/components/business/types";
import { Badge, Card, ConfirmDelete, EmptyState, Field, Modal, dayLabel, daysFromToday, ghostBtn, inputCls, primaryBtn } from "@/components/business/ui";

export const STATUS_LABEL: Record<string, string> = { PENDING: "To do", IN_PROGRESS: "In progress", REVIEW: "In review", COMPLETED: "Done" };
const PRIORITY_TONE: Record<string, "slate" | "blue" | "amber" | "rose"> = { LOW: "slate", MEDIUM: "blue", HIGH: "amber", URGENT: "rose" };

export function DeliverableModal({
  businesses,
  defaultBusinessId,
  editing,
  onClose,
  onSaved,
}: {
  businesses: BusinessItem[];
  defaultBusinessId: string;
  editing: DeliverableItem | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [businessId, setBusinessId] = useState(editing?.businessId ?? defaultBusinessId);
  const [clientId, setClientId] = useState(editing?.clientId ?? "");
  const [title, setTitle] = useState(editing?.title ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [priority, setPriority] = useState(editing?.priority ?? "MEDIUM");
  const [status, setStatus] = useState(editing?.status ?? "PENDING");
  const [dueDate, setDueDate] = useState(editing?.dueDate ? new Date(editing.dueDate).toISOString().slice(0, 10) : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const clients = businesses.find((b) => b.id === businessId)?.clients ?? [];

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      const body = editing
        ? { id: editing.id, title: title.trim(), description: description.trim(), priority, status, dueDate: dueDate || null }
        : { businessId, clientId: clientId || null, title: title.trim(), description: description.trim(), priority, dueDate: dueDate || null };
      const res = await offlineFetch("/api/business/deliverables", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        onSaved();
        onClose();
      } else setError(data.error || "Could not save the deliverable");
    } catch {
      setError("Could not save the deliverable");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={editing ? "Edit deliverable" : "Add deliverable"} onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        <Field label="What has to be delivered *">
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} autoFocus required maxLength={200} placeholder="e.g. Social Media Business kit for Mama Pima" />
        </Field>
        {!editing && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
            <Field label="Client">
              <select value={clientId} onChange={(e) => setClientId(e.target.value)} className={inputCls}>
                <option value="">No client</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Priority">
            <select value={priority} onChange={(e) => setPriority(e.target.value)} className={inputCls}>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
          </Field>
          <Field label="Due date">
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputCls} />
          </Field>
          {editing && (
            <Field label="Status">
              <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls}>
                {Object.entries(STATUS_LABEL).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </div>
        <Field label="Details">
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={inputCls} maxLength={5000} />
        </Field>
        {error && <p className="text-xs text-rose-400">{error}</p>}
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
          <button type="button" onClick={onClose} className={ghostBtn}>
            Cancel
          </button>
          <button type="submit" disabled={!title.trim() || busy} className={primaryBtn}>
            {busy ? "Saving..." : editing ? "Save changes" : "Add deliverable"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** Deliverables (client work with a due date) for one business or for all of them. */
export function DeliverablesSection({
  items,
  businesses,
  defaultBusinessId,
  showBusiness = false,
  onChanged,
}: {
  items: DeliverableItem[];
  businesses: BusinessItem[];
  defaultBusinessId: string;
  showBusiness?: boolean;
  onChanged: () => void;
}) {
  const [filter, setFilter] = useState<"OPEN" | "ALL" | "COMPLETED">("OPEN");
  const [modal, setModal] = useState<{ item: DeliverableItem | null } | null>(null);
  const [deleting, setDeleting] = useState<DeliverableItem | null>(null);
  const [busy, setBusy] = useState(false);

  const clientName = (d: DeliverableItem) => businesses.flatMap((b) => b.clients).find((c) => c.id === d.clientId)?.name;
  const businessOf = (d: DeliverableItem) => businesses.find((b) => b.id === d.businessId);

  const shown = items
    .filter((d) => (filter === "ALL" ? true : filter === "COMPLETED" ? d.status === "COMPLETED" : d.status !== "COMPLETED"))
    .sort((a, b) => {
      const ad = a.dueDate ? Date.parse(a.dueDate) : Infinity;
      const bd = b.dueDate ? Date.parse(b.dueDate) : Infinity;
      return ad - bd;
    });

  const setStatus = async (d: DeliverableItem, status: string) => {
    await offlineFetch("/api/business/deliverables", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: d.id, status }),
    }).catch(() => {});
    onChanged();
  };

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    await offlineFetch(`/api/business/deliverables?id=${deleting.id}`, { method: "DELETE" }).catch(() => {});
    setBusy(false);
    setDeleting(null);
    onChanged();
  };

  return (
    <>
      <Card
        title={`Client work (${items.filter((d) => d.status !== "COMPLETED").length} open)`}
        action={
          <button onClick={() => setModal({ item: null })} className={`${primaryBtn} flex items-center gap-1.5`}>
            <Plus className="h-3.5 w-3.5" /> Add deliverable
          </button>
        }
      >
        <div className="flex items-center gap-1.5 text-xs">
          {(["OPEN", "COMPLETED", "ALL"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-xl font-medium cursor-pointer transition-all ${
                filter === f ? "bg-blue-600 text-white font-semibold" : "bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-slate-800"
              }`}
            >
              {f === "OPEN" ? "Open" : f === "COMPLETED" ? "Done" : "All"}
            </button>
          ))}
        </div>

        {shown.length === 0 ? (
          <EmptyState>{filter === "OPEN" ? "No open client work. Add a deliverable when a client orders something." : "Nothing here."}</EmptyState>
        ) : (
          <div className="space-y-2">
            {shown.map((d) => {
              const days = d.status === "COMPLETED" ? null : daysFromToday(d.dueDate);
              const biz = businessOf(d);
              return (
                <div key={d.id} className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition-colors flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className={`text-xs font-semibold break-words ${d.status === "COMPLETED" ? "line-through text-slate-500" : "text-slate-100"}`}>{d.title}</div>
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                      {showBusiness && biz && (
                        <span className="flex items-center gap-1">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: biz.color }} />
                          {biz.name}
                        </span>
                      )}
                      {clientName(d) && <span>{clientName(d)}</span>}
                      <Badge tone={PRIORITY_TONE[d.priority] ?? "slate"}>{d.priority.toLowerCase()}</Badge>
                      {d.dueDate && (
                        <Badge tone={days !== null && days < 0 ? "rose" : days !== null && days <= 2 ? "amber" : "slate"}>
                          <Calendar className="h-2.5 w-2.5 mr-1" />
                          {days === null ? dayLabel(d.dueDate) : days < 0 ? `Overdue ${-days}d` : days === 0 ? "Due today" : days === 1 ? "Due tomorrow" : dayLabel(d.dueDate)}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <select
                      value={d.status}
                      onChange={(e) => setStatus(d, e.target.value)}
                      className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-slate-300 focus:outline-none focus:border-blue-500"
                      aria-label={`Status of ${d.title}`}
                    >
                      {Object.entries(STATUS_LABEL).map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </select>
                    <button onClick={() => setModal({ item: d })} className="p-1.5 rounded-lg text-slate-500 hover:text-blue-400 hover:bg-slate-800 cursor-pointer" title="Edit" aria-label={`Edit ${d.title}`}>
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => setDeleting(d)} className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer" title="Delete" aria-label={`Delete ${d.title}`}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <p className="text-[11px] text-slate-500">Finished work clears itself 24 hours after you complete it.</p>
      </Card>

      {modal && <DeliverableModal businesses={businesses} defaultBusinessId={defaultBusinessId} editing={modal.item} onClose={() => setModal(null)} onSaved={onChanged} />}
      {deleting && (
        <ConfirmDelete
          title="Delete deliverable?"
          busy={busy}
          onCancel={() => setDeleting(null)}
          onConfirm={remove}
          body={
            <>
              Delete <strong className="text-white">{deleting.title}</strong>? This cannot be undone.
            </>
          }
        />
      )}
    </>
  );
}
