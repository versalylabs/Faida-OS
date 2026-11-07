"use client";

import { useState } from "react";
import { CheckCircle2, ChevronDown, ChevronUp, Circle, ListChecks, Loader2, Sparkles } from "lucide-react";
import { canPlan, isQuizLike } from "@/lib/planRules";
import { isOnline } from "@/lib/offlineSync";

interface PlanTarget {
  id: string;
  title: string;
  status: string;
  dueDate?: string | null;
  subtasks: { id: string; title: string; isDone: boolean }[];
}

/**
 * "Plan steps": only shown where it helps (reports, projects, presentations, programming work), never on
 * quizzes, CATs or finished work. It writes a short checklist spread over the days before the deadline.
 */
export function PlanButton({ a, onDone, compact = false }: { a: PlanTarget; onDone: () => void; compact?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canPlan(a)) return null;

  const run = async () => {
    if (!isOnline()) {
      setError("Planning needs a connection.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/university/plan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ taskId: a.id }) });
      const json = await res.json();
      if (json.success) onDone();
      else setError(json.error || "Could not plan that assignment.");
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={run}
        disabled={busy}
        title="Split this into a short checklist spread before the deadline"
        className={`press flex items-center gap-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium whitespace-nowrap shrink-0 disabled:opacity-60 ${compact ? "p-1.5" : "px-2.5 py-1"}`}
      >
        {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3 text-blue-300" />}
        {compact ? <span className="sr-only">Plan steps</span> : "Plan steps"}
      </button>
      {error && (
        <span role="alert" className="text-[10px] text-rose-300 max-w-[14rem] text-right">
          {error}
        </span>
      )}
    </div>
  );
}

/** The plan itself: progress, and the steps with tick boxes (show or hide). */
export function PlanChecklist({
  a,
  onToggle,
  onReplanned,
  defaultOpen = false,
}: {
  a: PlanTarget;
  onToggle: (taskId: string, subtaskId: string, done: boolean) => void;
  onReplanned: () => void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (a.subtasks.length === 0) return null;
  const done = a.subtasks.filter((s) => s.isDone).length;
  const percent = Math.round((done / a.subtasks.length) * 100);
  const canReplan = a.status !== "DONE" && !isQuizLike(a.title) && done < a.subtasks.length;

  const replan = async () => {
    if (!isOnline()) return setError("Planning needs a connection.");
    if (!confirm("Replace the unfinished steps with a fresh plan? Steps you have ticked stay.")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/university/plan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ taskId: a.id, replace: true }) });
      const json = await res.json();
      if (json.success) onReplanned();
      else setError(json.error || "Could not re-plan.");
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pt-2 border-t border-slate-800/70 space-y-2">
      <div className="flex items-center gap-2 text-[11px] text-slate-300">
        <ListChecks className="h-3.5 w-3.5 text-emerald-300 shrink-0" />
        <div className="flex-1 max-w-xs bg-slate-800 rounded-full h-1.5 overflow-hidden" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${percent}%` }} />
        </div>
        <span className="text-[10px] shrink-0 font-medium">
          {done}/{a.subtasks.length} steps
        </span>
        <button onClick={() => setOpen((v) => !v)} className="ml-auto flex items-center gap-1 text-blue-300 hover:underline whitespace-nowrap shrink-0" aria-expanded={open}>
          {open ? "Hide" : "Show steps"}
          {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
      </div>

      {open && (
        <div className="space-y-1">
          {a.subtasks.map((s) => {
            const [main, ...rest] = s.title.split(" · ");
            return (
              <button
                key={s.id}
                onClick={() => onToggle(a.id, s.id, !s.isDone)}
                className="w-full flex items-start gap-2 text-left px-2 py-1.5 rounded-lg hover:bg-slate-800/60"
                aria-label={`${s.isDone ? "Untick" : "Tick"}: ${main}`}
              >
                {s.isDone ? <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /> : <Circle className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />}
                <span className="min-w-0">
                  <span className={`block text-[11px] break-words ${s.isDone ? "line-through text-slate-500" : "text-slate-100"}`}>{main}</span>
                  {rest.length > 0 && <span className="block text-[10px] text-slate-400">{rest.join(" · ")}</span>}
                </span>
              </button>
            );
          })}
          {canReplan && (
            <div className="flex items-center gap-2 pt-1">
              <button onClick={replan} disabled={busy} className="text-[11px] text-blue-300 hover:underline disabled:opacity-60 flex items-center gap-1">
                {busy && <Loader2 className="h-3 w-3 animate-spin" />} Re-plan the rest
              </button>
              {error && <span className="text-[10px] text-rose-300">{error}</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
