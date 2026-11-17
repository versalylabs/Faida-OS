"use client";

import { useState } from "react";
import { Edit3, Mail, Phone, Plus, Trash2 } from "lucide-react";
import { offlineFetch } from "@/lib/offlineSync";
import { formatKES } from "@/lib/utils";
import { STAGE_LABEL, VERSALY_PRODUCTS, isOpenStage, monthlyValue, parseProductTag, stagesFor, withProductTag } from "@/lib/businessMath";
import type { BusinessItem, ClientItem } from "@/components/business/types";
import { Badge, Card, ConfirmDelete, EmptyState, Field, Modal, ghostBtn, inputCls, primaryBtn } from "@/components/business/ui";

export interface CatalogEntry {
  name: string;
  price: number;
  billing: "ONE_TIME" | "MONTHLY";
  scope: string;
}

const HEALTH_TONE: Record<string, "green" | "amber" | "rose"> = { HEALTHY: "green", ATTENTION: "amber", AT_RISK: "rose" };
const STAGE_TONE: Record<string, string> = {
  LEAD: "bg-slate-500",
  IDENTIFIED: "bg-slate-500",
  CONTACTED: "bg-sky-400",
  DISCOVERY: "bg-cyan-400",
  QUALIFIED: "bg-indigo-400",
  DEMO: "bg-violet-400",
  PROPOSAL: "bg-blue-400",
  ONBOARDING: "bg-purple-400",
  PILOT: "bg-fuchsia-400",
  ACTIVE: "bg-emerald-400",
  COMPLETED: "bg-teal-400",
  PAUSED: "bg-amber-400",
  LOST: "bg-rose-400",
};

export function ClientModal({
  businesses,
  defaultBusinessId,
  editing,
  catalog,
  onClose,
  onSaved,
}: {
  businesses: BusinessItem[];
  defaultBusinessId: string;
  editing: ClientItem | null;
  catalog?: CatalogEntry[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [businessId, setBusinessId] = useState(editing?.businessId ?? defaultBusinessId);
  const [name, setName] = useState(editing?.name ?? "");
  const [industry, setIndustry] = useState(editing?.industry ?? "");
  const initialTag = parseProductTag(editing?.scope);
  const [scope, setScope] = useState(initialTag.text);
  const [product, setProduct] = useState(initialTag.product ?? "");
  const [status, setStatus] = useState(editing?.status ?? stagesFor(businesses.find((b) => b.id === (editing?.businessId ?? defaultBusinessId))?.slug)[0].key);
  const [contractType, setContractType] = useState(editing?.contractType ?? "ONE_TIME");
  const [contractValue, setContractValue] = useState(editing ? String(editing.contractValue) : "");
  const [billingCycle, setBillingCycle] = useState(editing?.billingCycle ?? "ONE_TIME");
  const [contactPerson, setContactPerson] = useState(editing?.contactPerson ?? "");
  const [contactEmail, setContactEmail] = useState(editing?.contactEmail ?? "");
  const [contactPhone, setContactPhone] = useState(editing?.contactPhone ?? "");
  const [health, setHealth] = useState(editing?.health ?? "HEALTHY");
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const selectedSlug = businesses.find((b) => b.id === businessId)?.slug;
  const isVersaly = (selectedSlug || "").toLowerCase() === "versaly";
  const stageOptions = stagesFor(selectedSlug);

  const applyCatalog = (idx: string) => {
    const item = catalog?.[Number(idx)];
    if (!item) return;
    setScope(item.name + (item.scope ? `: ${item.scope}` : ""));
    setContractValue(String(item.price));
    if (item.billing === "MONTHLY") {
      setContractType("RETAINER");
      setBillingCycle("MONTHLY");
    } else {
      setContractType("ONE_TIME");
      setBillingCycle("ONE_TIME");
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      const body = {
        ...(editing ? { id: editing.id } : {}),
        businessId,
        name: name.trim(),
        industry: industry.trim(),
        scope: withProductTag(isVersaly ? product : "", scope.trim()),
        status,
        contractType,
        contractValue: parseFloat(contractValue) || 0,
        billingCycle,
        contactPerson: contactPerson.trim(),
        contactEmail: contactEmail.trim(),
        contactPhone: contactPhone.trim(),
        health,
        notes: notes.trim(),
      };
      const res = await offlineFetch("/api/business/clients", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        onSaved();
        onClose();
      } else setError(data.error || "Could not save the client");
    } catch {
      setError("Could not save the client");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={editing ? `Edit client: ${editing.name}` : "Add client or prospect"} onClose={onClose} wide>
      <form onSubmit={save} className="space-y-3">
        {!editing && catalog && catalog.length > 0 && (
          <Field label="Quick fill from the product catalogue" hint="Fills the package and the price; you can change both.">
            <select defaultValue="" onChange={(e) => applyCatalog(e.target.value)} className={inputCls}>
              <option value="">Choose a package (optional)</option>
              {catalog.map((c, i) => (
                <option key={c.name} value={i}>
                  {c.name} · {formatKES(c.price)}
                  {c.billing === "MONTHLY" ? "/month" : ""}
                </option>
              ))}
            </select>
          </Field>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Business or person *">
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} autoFocus required maxLength={200} />
          </Field>
          <Field label="Industry">
            <input value={industry} onChange={(e) => setIndustry(e.target.value)} className={inputCls} placeholder="e.g. Restaurant, Real estate" maxLength={120} />
          </Field>
        </div>
        {isVersaly && (
          <Field label="Product they are interested in">
            <select value={product} onChange={(e) => setProduct(e.target.value)} className={inputCls}>
              <option value="">Not decided</option>
              {VERSALY_PRODUCTS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label={isVersaly ? "Notes on their needs and current tools" : "What are they buying (scope)"}>
          <textarea value={scope} onChange={(e) => setScope(e.target.value)} rows={2} className={inputCls} maxLength={2000} />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Business">
            <select
              value={businessId}
              onChange={(e) => {
                setBusinessId(e.target.value);
                const next = stagesFor(businesses.find((b) => b.id === e.target.value)?.slug);
                if (!next.some((s) => s.key === status)) setStatus(next[0].key);
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
          <Field label="Stage">
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls}>
              {!stageOptions.some((s) => s.key === status) && <option value={status}>{STAGE_LABEL[status] ?? status}</option>}
              {stageOptions.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Value (KES)">
            <input type="number" min="0" step="any" value={contractValue} onChange={(e) => setContractValue(e.target.value)} className={inputCls} placeholder="0" />
          </Field>
          <Field label="Contract type">
            <select value={contractType} onChange={(e) => setContractType(e.target.value)} className={inputCls}>
              <option value="ONE_TIME">One-time</option>
              <option value="RETAINER">Retainer</option>
              <option value="MILESTONE">Milestones</option>
            </select>
          </Field>
          <Field label="Billing">
            <select value={billingCycle} onChange={(e) => setBillingCycle(e.target.value)} className={inputCls}>
              <option value="ONE_TIME">One-time</option>
              <option value="MONTHLY">Monthly</option>
              <option value="QUARTERLY">Quarterly</option>
              <option value="PROJECT">Per project</option>
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Contact person">
            <input value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} className={inputCls} maxLength={120} />
          </Field>
          <Field label="Email">
            <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Phone / WhatsApp">
            <input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className={inputCls} maxLength={40} />
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Relationship health">
            <select value={health} onChange={(e) => setHealth(e.target.value)} className={inputCls}>
              <option value="HEALTHY">Healthy</option>
              <option value="ATTENTION">Needs attention</option>
              <option value="AT_RISK">At risk</option>
            </select>
          </Field>
          <Field label="Notes">
            <input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} maxLength={5000} />
          </Field>
        </div>
        {error && <p className="text-xs text-rose-400">{error}</p>}
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
          <button type="button" onClick={onClose} className={ghostBtn}>
            Cancel
          </button>
          <button type="submit" disabled={!name.trim() || busy} className={primaryBtn}>
            {busy ? "Saving..." : editing ? "Save changes" : "Add client"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** The sales pipeline for one business, grouped by stage, with one-tap stage changes. */
export function ClientsSection({
  business,
  businesses,
  catalog,
  onChanged,
}: {
  business: BusinessItem;
  businesses: BusinessItem[];
  catalog?: CatalogEntry[];
  onChanged: () => void;
}) {
  const [modal, setModal] = useState<{ client: ClientItem | null } | null>(null);
  const [deleting, setDeleting] = useState<ClientItem | null>(null);
  const [busy, setBusy] = useState(false);
  const clients = business.clients;

  const changeStage = async (c: ClientItem, status: string) => {
    await offlineFetch("/api/business/clients", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: c.id, status }),
    }).catch(() => {});
    onChanged();
  };

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    await offlineFetch(`/api/business/clients?id=${deleting.id}`, { method: "DELETE" }).catch(() => {});
    setBusy(false);
    setDeleting(null);
    onChanged();
  };

  const defs = stagesFor(business.slug);
  // The business's own stages, plus any stage an older client still carries
  const extraKeys = Array.from(new Set(clients.map((c) => c.status))).filter((k) => !defs.some((d) => d.key === k));
  const stages = [...defs.map((d) => d.key), ...extraKeys].map((s) => ({ stage: s, list: clients.filter((c) => c.status === s) }));
  const openPipeline = clients.filter((c) => isOpenStage(c.status));
  const isVersaly = business.slug.toLowerCase() === "versaly";

  return (
    <div className="space-y-4">
      <Card
        title={`Clients & pipeline (${clients.length})`}
        action={
          <button onClick={() => setModal({ client: null })} className={`${primaryBtn} flex items-center gap-1.5`}>
            <Plus className="h-3.5 w-3.5" /> Add client
          </button>
        }
      >
        <div className="flex flex-wrap gap-2 text-[11px]">
          <Badge tone="blue">Pipeline value {formatKES(openPipeline.reduce((a, c) => a + (c.contractValue || 0), 0))}</Badge>
          <Badge tone="green">Monthly recurring {formatKES(business.mrr)}</Badge>
          {business.projectValue > 0 && <Badge tone="purple">Active project work {formatKES(business.projectValue)}</Badge>}
        </div>

        {clients.length === 0 ? (
          <EmptyState>No clients or prospects yet. Add the first lead and move it through the stages as the deal progresses.</EmptyState>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,17rem),1fr))] gap-3">
            {stages
              .filter((s) => s.list.length > 0 || s.stage === defs[0].key || s.stage === "ACTIVE")
              .map(({ stage, list }) => (
                <div key={stage} className="rounded-xl bg-slate-950/50 border border-slate-800/80 p-3 space-y-2.5 min-w-0">
                  <div className="flex items-center justify-between gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-300">
                    <span className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${STAGE_TONE[stage]}`} />
                      {STAGE_LABEL[stage] ?? stage}
                    </span>
                    <span className="font-mono text-slate-500">{list.length}</span>
                  </div>
                  {list.length === 0 && <p className="text-[11px] text-slate-600 px-1">Nothing here</p>}
                  {list.map((c) => (
                    <div key={c.id} className="p-3 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors space-y-2 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-slate-100 break-words">{c.name}</div>
                          {c.industry && <div className="text-[11px] text-slate-500 break-words">{c.industry}</div>}
                        </div>
                        <div className="flex items-center shrink-0">
                          <button onClick={() => setModal({ client: c })} className="p-1.5 rounded-lg text-slate-500 hover:text-blue-400 hover:bg-slate-800 cursor-pointer" title="Edit" aria-label={`Edit ${c.name}`}>
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => setDeleting(c)} className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer" title="Delete" aria-label={`Delete ${c.name}`}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      {(() => {
                        const tag = parseProductTag(c.scope);
                        return (
                          <>
                            {isVersaly && tag.product && <Badge tone="purple">{tag.product}</Badge>}
                            {tag.text && <p className="text-[11px] text-slate-400 line-clamp-2 break-words">{tag.text}</p>}
                          </>
                        );
                      })()}
                      <div className="flex flex-wrap items-center gap-1.5">
                        {c.contractValue > 0 && (
                          <Badge tone="slate">
                            {formatKES(c.contractValue)}
                            {c.billingCycle === "MONTHLY" ? "/mo" : c.billingCycle === "QUARTERLY" ? "/qtr" : ""}
                          </Badge>
                        )}
                        {monthlyValue(c) > 0 && <Badge tone="green">recurring</Badge>}
                        {c.health !== "HEALTHY" && <Badge tone={HEALTH_TONE[c.health] ?? "slate"}>{c.health === "AT_RISK" ? "At risk" : "Needs attention"}</Badge>}
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <select
                          value={c.status}
                          onChange={(e) => changeStage(c, e.target.value)}
                          className="min-w-0 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-slate-300 focus:outline-none focus:border-blue-500"
                          aria-label={`Stage for ${c.name}`}
                        >
                          {!defs.some((d) => d.key === c.status) && <option value={c.status}>{STAGE_LABEL[c.status] ?? c.status}</option>}
                          {defs.map((s) => (
                            <option key={s.key} value={s.key}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                        <div className="flex items-center gap-1 shrink-0">
                          {c.contactPhone && (
                            <a href={`tel:${c.contactPhone}`} className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-400 hover:bg-slate-800" title={`Call ${c.contactPhone}`} aria-label="Call">
                              <Phone className="h-3.5 w-3.5" />
                            </a>
                          )}
                          {c.contactEmail && (
                            <a href={`mailto:${c.contactEmail}`} className="p-1.5 rounded-lg text-slate-500 hover:text-blue-400 hover:bg-slate-800" title={`Email ${c.contactEmail}`} aria-label="Email">
                              <Mail className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
          </div>
        )}
      </Card>

      {modal && (
        <ClientModal
          businesses={businesses}
          defaultBusinessId={business.id}
          editing={modal.client}
          catalog={catalog}
          onClose={() => setModal(null)}
          onSaved={onChanged}
        />
      )}
      {deleting && (
        <ConfirmDelete
          title="Delete client?"
          busy={busy}
          onCancel={() => setDeleting(null)}
          onConfirm={remove}
          body={
            <>
              Delete <strong className="text-white">{deleting.name}</strong>? Their deliverables and any payments you recorded stay, just without a client name.
            </>
          }
        />
      )}
    </div>
  );
}
