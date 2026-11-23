"use client";

import { useState } from "react";
import { Check, Loader2, Undo2 } from "lucide-react";
import { formatKES } from "@/lib/utils";

export interface CapturedItem {
  type: string;
  title: string;
  when: string | null;
  amount: number | null;
  note: string | null;
  undo: { kind: string; ids: string[]; entityId: string };
}

const LABEL: Record<string, string> = {
  TASK: "Task",
  REMINDER: "Reminder",
  EVENT: "Event",
  SHOPPING: "Shopping",
  NOTE: "Note",
  KNOWLEDGE: "Note",
  FINANCE: "Money",
  LEARNING: "Learning",
};

function whenLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const tomorrow = new Date(Date.now() + 86400000);
  const day =
    d.toDateString() === today.toDateString() ? "today" : d.toDateString() === tomorrow.toDateString() ? "tomorrow" : d.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" });
  return `${day} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

/** What one capture turned into, one line per item, each with its own Undo. */
export function CaptureResults({ items, onUndone }: { items: CapturedItem[]; onUndone?: () => void }) {
  const [undone, setUndone] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const undo = async (item: CapturedItem) => {
    setBusy(item.undo.entityId);
    try {
      const res = await fetch("/api/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ undo: item.undo }),
      });
      const json = await res.json();
      if (json.success) {
        setUndone((u) => ({ ...u, [item.undo.entityId]: true }));
        onUndone?.();
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-1.5">
      {items.length > 1 && <div className="text-xs text-slate-300">Saved {items.length} things:</div>}
      {items.map((item) => {
        const gone = undone[item.undo.entityId];
        return (
          <div
            key={item.undo.entityId}
            className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs ${gone ? "bg-slate-950/40 border-white/5 text-slate-500" : "bg-blue-500/10 border-blue-500/20 text-blue-100"}`}
          >
            <Check className={`h-3.5 w-3.5 shrink-0 ${gone ? "text-slate-600" : "text-blue-300"}`} />
            <span className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] uppercase tracking-wide shrink-0">{LABEL[item.type] || item.type}</span>
            <span className={`min-w-0 flex-1 truncate ${gone ? "line-through" : ""}`}>
              {item.title}
              {item.amount ? ` · ${formatKES(item.amount)}` : ""}
              {item.when && item.type !== "TASK" ? ` · ${whenLabel(item.when)}` : ""}
              {item.note ? ` · ${item.note}` : ""}
            </span>
            {gone ? (
              <span className="text-[11px] shrink-0">Undone</span>
            ) : (
              <button
                onClick={() => undo(item)}
                disabled={busy !== null}
                className="press flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-900/70 border border-white/10 text-[11px] text-slate-200 cursor-pointer shrink-0 disabled:opacity-50"
              >
                {busy === item.undo.entityId ? <Loader2 className="h-3 w-3 animate-spin" /> : <Undo2 className="h-3 w-3" />}
                Undo
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
