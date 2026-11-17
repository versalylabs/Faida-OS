"use client";

import { useState } from "react";
import { offlineFetch } from "@/lib/offlineSync";
import { STRATEN_PROFILE } from "@/lib/playbooks";
import type { BusinessItem } from "@/components/business/types";
import { Field, Modal, ghostBtn, inputCls, primaryBtn } from "@/components/business/ui";

const COLORS = ["#3b82f6", "#f59e0b", "#10b981", "#8b5cf6", "#ec4899", "#06b6d4"];

/** Edit what a business is and its monthly revenue target. */
export function EditBusinessModal({ business, onClose, onSaved }: { business: BusinessItem; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(business.name);
  const [type, setType] = useState(business.type);
  const [description, setDescription] = useState(business.description ?? "");
  const [target, setTarget] = useState(String(business.targetMrr ?? 0));
  const [color, setColor] = useState(business.color);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const useBlueprint = () => {
    setType(STRATEN_PROFILE.positioning);
    setDescription("Helps businesses turn their ideas, products and services into professional, marketable and digitally enabled businesses: branding, marketing, websites and business technology.");
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !type.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await offlineFetch("/api/business", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: business.id, name: name.trim(), type: type.trim(), description: description.trim(), targetMrr: parseFloat(target) || 0, color }),
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
    <Modal title={`Edit ${business.name}`} onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Name">
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} required maxLength={120} autoFocus />
          </Field>
          <Field label="What it is">
            <input value={type} onChange={(e) => setType(e.target.value)} className={inputCls} required maxLength={160} />
          </Field>
        </div>
        <Field label="Description">
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={inputCls} maxLength={3000} />
        </Field>
        {business.slug === "straten" && (
          <button type="button" onClick={useBlueprint} className="text-[11px] text-blue-400 hover:text-blue-300 cursor-pointer">
            Use the positioning from the business plan
          </button>
        )}
        <Field label="Monthly recurring revenue target (KES)" hint="Used for the progress bar. 0 means no target is set.">
          <input type="number" min="0" step="any" value={target} onChange={(e) => setTarget(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Colour">
          <div className="flex items-center gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`h-7 w-7 rounded-full cursor-pointer transition-all ${color === c ? "ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-110" : "opacity-70 hover:opacity-100"}`}
                style={{ backgroundColor: c }}
                aria-label={`Colour ${c}`}
              />
            ))}
          </div>
        </Field>
        {error && <p className="text-xs text-rose-400">{error}</p>}
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
          <button type="button" onClick={onClose} className={ghostBtn}>
            Cancel
          </button>
          <button type="submit" disabled={busy} className={primaryBtn}>
            {busy ? "Saving..." : "Save changes"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
