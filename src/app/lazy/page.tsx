"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BatteryCharging,
  CalendarClock,
  Check,
  Coffee,
  Layers,
  Loader2,
  Sparkles,
  Timer,
  Trash2,
  Undo2,
  Zap,
} from "lucide-react";
import { cacheOfflineData, getCachedOfflineData } from "@/lib/offlineSync";
import {
  estimateEnergy,
  evaluateTasks,
  pickLowEnergyBatch,
  pickNextStep,
  type EvaluatedEffortTask,
  type RawEffortTask,
} from "@/lib/effort";

interface SavedBucket {
  deferred: number;
  dropped: number;
  batches: number;
  sprints: number;
  minutesFreed: number;
}

interface EffortPayload {
  success: boolean;
  suggestedEnergy: number;
  learnedEnergyByHour: Record<string, number>;
  rawTasks: RawEffortTask[];
  endOfDay: string;
  effortSaved: { week: SavedBucket; total: SavedBucket };
}

interface Toast {
  id: number;
  message: string;
  undo?: () => void;
}

const SPRINT_MINUTES = 15;

function energyMeta(val: number) {
  if (val >= 85) return { label: "Full flow", bar: "from-emerald-400 to-teal-300" };
  if (val >= 65) return { label: "Good capacity", bar: "from-sky-400 to-indigo-400" };
  if (val >= 45) return { label: "Steady", bar: "from-indigo-400 to-violet-400" };
  if (val >= 25) return { label: "Running low", bar: "from-amber-400 to-orange-400" };
  return { label: "Conserve everything", bar: "from-rose-400 to-orange-400" };
}

function dueLabel(iso?: string | null, endOfDayMs?: number): { text: string; hot: boolean } | null {
  if (!iso) return null;
  const due = new Date(iso);
  if (Number.isNaN(due.getTime())) return null;
  const end = endOfDayMs ?? Date.now() + 86400000;
  if (due.getTime() < end - 86400000) return { text: "Overdue", hot: true };
  if (due.getTime() < end) return { text: "Due today", hot: true };
  return { text: `Due ${due.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}`, hot: false };
}

function formatMinutes(total: number) {
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

export default function LazyModePage() {
  const [raw, setRaw] = useState<RawEffortTask[]>([]);
  const [endOfDay, setEndOfDay] = useState<number>(Date.now() + 86400000);
  const [saved, setSaved] = useState<EffortPayload["effortSaved"] | null>(null);
  const [learned, setLearned] = useState<Record<string, number>>({});
  const [energy, setEnergy] = useState<number>(60);
  const [lazyOn, setLazyOn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [notNow, setNotNow] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [showWaiting, setShowWaiting] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [timer, setTimer] = useState<{ taskId: string; sprint: boolean; endsAt: number } | null>(null);
  const [now, setNow] = useState(Date.now());
  const [batchRun, setBatchRun] = useState<string[] | null>(null);
  const [batchDone, setBatchDone] = useState<string[]>([]);
  const toastId = useRef(0);
  const checkinTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const apply = useCallback((p: EffortPayload) => {
    setRaw(p.rawTasks || []);
    setEndOfDay(new Date(p.endOfDay).getTime());
    setSaved(p.effortSaved);
    setLearned(p.learnedEnergyByHour || {});
  }, []);

  const load = useCallback(async () => {
    try {
      const hour = new Date().getHours();
      const res = await fetch(`/api/effort?hour=${hour}`, { cache: "no-store" });
      const result = await res.json();
      if (result.success) {
        apply(result);
        cacheOfflineData("effort_engine_v2", result);
        return result as EffortPayload;
      }
    } catch (e) {
      console.error("Failed to load Lazy Mode:", e);
    } finally {
      setIsLoading(false);
    }
    return null;
  }, [apply]);

  // Show last time's answer at once, start from the energy you usually have at this hour, then refresh
  useEffect(() => {
    const hour = new Date().getHours();
    const cached = getCachedOfflineData<EffortPayload>("effort_engine_v2");
    if (cached?.rawTasks) {
      apply(cached);
      setIsLoading(false);
      setEnergy(cached.learnedEnergyByHour?.[hour] ?? estimateEnergy(hour));
    } else {
      setEnergy(estimateEnergy(hour));
    }
    load().then((fresh) => {
      if (fresh) setEnergy(fresh.suggestedEnergy);
    });
  }, [apply, load]);

  // Countdown clock, only while a timer is running
  useEffect(() => {
    if (!timer) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [timer]);

  const lazyEffective = lazyOn || energy <= 30;

  // Everything below is worked out on this device, so the slider and every tap respond instantly
  const evaluated = useMemo(() => evaluateTasks(raw, energy, lazyEffective, endOfDay), [raw, energy, lazyEffective, endOfDay]);
  const essentials = useMemo(() => evaluated.filter((t) => t.essential), [evaluated]);
  const waiting = useMemo(() => evaluated.filter((t) => !t.essential), [evaluated]);
  const batch = useMemo(() => pickLowEnergyBatch(evaluated), [evaluated]);
  const next = useMemo(() => pickNextStep(evaluated, energy, notNow), [evaluated, energy, notNow]);
  const meta = energyMeta(energy);
  const learnedNow = learned[String(new Date().getHours())];

  const pushToast = (message: string, undo?: () => void) => {
    const id = ++toastId.current;
    setToasts((prev) => [...prev, { id, message, undo }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 7000);
  };

  const post = async (body: Record<string, unknown>) => {
    const res = await fetch("/api/effort", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.json();
  };

  const removeLocal = (id: string) => setRaw((prev) => prev.filter((t) => t.id !== id));

  const checkin = (level: number) => {
    setEnergy(level);
    setLazyOn(level <= 25);
    if (checkinTimer.current) clearTimeout(checkinTimer.current);
    // Wait until the slider stops moving, then remember it
    checkinTimer.current = setTimeout(() => {
      post({ action: "CHECKIN", level, hour: new Date().getHours() }).catch(() => {});
    }, 1200);
  };

  const complete = async (task: EvaluatedEffortTask, kind?: "BATCH" | "SPRINT") => {
    setBusy(task.id);
    removeLocal(task.id);
    try {
      await post({ action: "COMPLETE", taskId: task.id, kind });
      pushToast(`Done: ${task.title}`);
      load();
    } catch {
      pushToast("Could not save that. Check your connection and try again.");
      load();
    } finally {
      setBusy(null);
    }
  };

  const defer = async (task: EvaluatedEffortTask, days: number) => {
    setBusy(task.id);
    removeLocal(task.id);
    try {
      const r = await post({ action: "DEFER", taskId: task.id, days });
      if (!r.success) throw new Error("defer failed");
      pushToast(days === 1 ? `Moved to tomorrow: ${task.title}` : `Moved ${days} days out: ${task.title}`, async () => {
        await post({ action: "RESTORE", taskId: task.id, status: r.previous?.status, dueDate: r.previous?.dueDate, eventId: r.eventId });
        load();
      });
      load();
    } catch {
      pushToast("Could not move that task.");
      load();
    } finally {
      setBusy(null);
    }
  };

  const drop = async (task: EvaluatedEffortTask) => {
    setBusy(task.id);
    removeLocal(task.id);
    try {
      const r = await post({ action: "DROP", taskId: task.id });
      if (!r.success) throw new Error("drop failed");
      pushToast(`Dropped: ${task.title}`, async () => {
        await post({ action: "RESTORE", taskId: task.id, status: r.previous?.status, dueDate: r.previous?.dueDate, eventId: r.eventId });
        load();
      });
      load();
    } catch {
      pushToast("Could not drop that task.");
      load();
    } finally {
      setBusy(null);
    }
  };

  const startTimer = (task: EvaluatedEffortTask, sprint: boolean) => {
    const minutes = sprint ? SPRINT_MINUTES : Math.min(Math.max(task.estimatedMinutes, 10), 50);
    setNow(Date.now());
    setTimer({ taskId: task.id, sprint, endsAt: Date.now() + minutes * 60000 });
  };

  const finishTimer = async (taskDone: boolean) => {
    if (!timer) return;
    const task = evaluated.find((t) => t.id === timer.taskId);
    const wasSprint = timer.sprint;
    setTimer(null);
    if (!task) return;
    if (taskDone) {
      await complete(task, wasSprint ? "SPRINT" : undefined);
    } else if (wasSprint) {
      await post({ action: "SPRINT", taskId: task.id }).catch(() => {});
      pushToast("Good. 15 minutes is enough for now. The task stays open.");
      load();
    }
  };

  const startBatch = () => {
    setBatchRun(batch.tasks.map((t) => t.id));
    setBatchDone([]);
  };

  const tickBatchItem = async (task: EvaluatedEffortTask) => {
    setBatchDone((prev) => [...prev, task.id]);
    try {
      await post({ action: "COMPLETE", taskId: task.id, kind: "BATCH" });
      load();
    } catch {
      pushToast("Could not save that one.");
    }
  };

  const remaining = timer ? Math.max(0, timer.endsAt - now) : 0;
  const mm = String(Math.floor(remaining / 60000)).padStart(2, "0");
  const ss = String(Math.floor((remaining % 60000) / 1000)).padStart(2, "0");
  const timerTask = timer ? evaluated.find((t) => t.id === timer.taskId) : null;
  const batchItems = batchRun ? batchRun.map((id) => batch.tasks.find((t) => t.id === id) || raw.find((t) => t.id === id)).filter(Boolean) as any[] : [];

  const renderTask = (task: EvaluatedEffortTask) => {
    const due = dueLabel(task.dueDate, endOfDay);
    return (
      <div className="group flex items-center gap-3 p-3 rounded-2xl bg-slate-950/50 border border-slate-800 transition-all hover:border-white/25">
        <button
          onClick={() => complete(task)}
          disabled={busy === task.id}
          title="Mark done"
          className="press h-8 w-8 shrink-0 rounded-full border border-white/25 flex items-center justify-center text-transparent hover:text-emerald-300 hover:border-emerald-300/60 transition-colors cursor-pointer"
        >
          <Check className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-slate-100 truncate">{task.title}</div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-400 mt-0.5">
            <span>{task.estimatedMinutes} min</span>
            <span className="flex items-center gap-0.5" title={`Energy cost ${task.energyCost} of 10`}>
              <Zap className="h-3 w-3 text-amber-300" /> {task.energyCost}/10
            </span>
            {due && <span className={due.hot ? "text-amber-300" : ""}>{due.text}</span>}
            {task.projectName && <span className="truncate">{task.projectName}</span>}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => defer(task, 1)}
            disabled={busy === task.id}
            title="Move to tomorrow"
            className="press glass-orb h-8 w-8 text-slate-200 cursor-pointer"
          >
            <CalendarClock className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => drop(task)}
            disabled={busy === task.id}
            title="Drop it for good"
            className="press glass-orb h-8 w-8 text-slate-200 hover:text-rose-300 cursor-pointer"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5 sm:space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-amber-300 mb-1">
            <span>🛋️</span>
            Lazy Mode
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">Do less. Keep your energy.</h1>
          <p className="text-sm text-slate-300 mt-1 max-w-xl">
            Tell Faida how much you have in the tank. It shows the one thing worth doing and lets everything else wait.
          </p>
        </div>
        <button
          onClick={() => {
            const next = !lazyOn;
            setLazyOn(next);
            setEnergy(next ? 20 : (learned[String(new Date().getHours())] ?? estimateEnergy(new Date().getHours())));
          }}
          className={`press w-full sm:w-auto px-5 py-3 rounded-full font-semibold text-sm transition-all cursor-pointer flex items-center justify-center gap-2.5 shrink-0 ${
            lazyOn
              ? "bg-amber-400 text-slate-950 shadow-[0_8px_22px_-8px_rgba(251,191,36,0.5)]"
              : "glass-orb !rounded-full text-amber-200 px-5"
          }`}
        >
          <span>😮‍💨</span>
          <span>{lazyOn ? "Lazy Mode is on" : "I'm feeling lazy"}</span>
        </button>
      </div>

      {/* Energy */}
      <div className="p-4 sm:p-5 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="glass-orb h-11 w-11 text-amber-300">
              <BatteryCharging className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs text-slate-300">Your energy right now</div>
              <div className="text-xl font-semibold text-white flex items-baseline gap-2">
                {energy}%
                <span className="text-xs font-normal text-slate-300">{meta.label}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {[
              { label: "Drained", val: 10 },
              { label: "Tired", val: 25 },
              { label: "Okay", val: 60 },
              { label: "Sharp", val: 90 },
            ].map((p) => (
              <button
                key={p.val}
                onClick={() => checkin(p.val)}
                className={`press px-3.5 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer border ${
                  energy === p.val
                    ? "bg-amber-400/20 text-amber-200 border-amber-300/50"
                    : "bg-slate-950/50 text-slate-200 border-white/10 hover:border-white/30"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="relative">
          <div className="h-3 rounded-full bg-slate-950/70 overflow-hidden border border-white/10">
            <div
              className={`h-full rounded-full bg-gradient-to-r ${meta.bar} transition-all duration-500 ease-out`}
              style={{ width: `${energy}%` }}
            />
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={energy}
            onChange={(e) => checkin(Number(e.target.value))}
            aria-label="Energy level"
            className="absolute inset-0 w-full h-3 opacity-0 cursor-pointer"
          />
        </div>

        <p className="text-xs text-slate-300 flex items-start gap-2">
          <Sparkles className="h-3.5 w-3.5 text-amber-300 shrink-0 mt-0.5" />
          <span>
            {learnedNow !== undefined
              ? `You usually report about ${learnedNow}% around this time. `
              : "Faida learns your daily rhythm from these check-ins. "}
            {lazyEffective
              ? "Only what can't wait is shown first, and demanding work is held back."
              : energy >= 80
              ? "Good window for the hard, deep work."
              : "A steady window. Mix one meaningful task with a few quick ones."}
          </span>
        </p>
      </div>

      {/* Do this now */}
      {isLoading ? (
        <div className="py-16 text-center text-sm text-slate-300 flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-amber-300" />
          Finding your next step…
        </div>
      ) : timer && timerTask ? (
        <div className="morph-in p-6 sm:p-8 rounded-[2rem] bg-slate-900/60 border border-amber-300/30 text-center space-y-4">
          <div className="text-xs text-amber-200">{timer.sprint ? "15-minute sprint" : "Focus time"}</div>
          <div className="text-lg font-semibold text-white">{timerTask.title}</div>
          <div className="text-6xl sm:text-7xl font-semibold tabular-nums text-white tracking-tight">
            {mm}:{ss}
          </div>
          <p className="text-sm text-slate-300">
            {remaining === 0 ? "Time. Stop here if you want to; that was enough." : "One thing only. Nothing else matters for these minutes."}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            <button onClick={() => finishTimer(true)} className="press px-5 py-2.5 rounded-full bg-blue-600 text-white text-sm font-semibold cursor-pointer flex items-center gap-2">
              <Check className="h-4 w-4" /> Task is done
            </button>
            {timer.sprint && (
              <button onClick={() => finishTimer(false)} className="press px-5 py-2.5 rounded-full bg-slate-800 text-slate-100 text-sm font-medium border border-white/15 cursor-pointer">
                Sprint done, task stays open
              </button>
            )}
            <button onClick={() => setTimer(null)} className="press px-4 py-2.5 rounded-full text-slate-300 text-sm cursor-pointer hover:text-white">
              Cancel
            </button>
          </div>
        </div>
      ) : next ? (
        <div className="morph-in relative p-5 sm:p-7 rounded-[2rem] bg-slate-900/60 border border-amber-300/25 space-y-4 overflow-hidden">
          <div className="text-xs text-amber-200 flex items-center gap-2">
            <Zap className="h-3.5 w-3.5" />
            {next.mode === "SPRINT" ? "Do this for 15 minutes" : "Do this now"}
          </div>
          <div className="text-2xl sm:text-3xl font-semibold text-white leading-snug">{next.task.title}</div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-200">
            <span className="px-3 py-1 rounded-full bg-white/10 border border-white/15">{next.task.estimatedMinutes} min</span>
            <span className="px-3 py-1 rounded-full bg-white/10 border border-white/15">Energy {next.task.energyCost}/10</span>
            {dueLabel(next.task.dueDate, endOfDay) && (
              <span className="px-3 py-1 rounded-full bg-amber-300/15 border border-amber-300/30 text-amber-100">
                {dueLabel(next.task.dueDate, endOfDay)!.text}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-300">{next.why}</p>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              onClick={() => startTimer(next.task, next.mode === "SPRINT")}
              className="press px-6 py-3 rounded-full bg-blue-600 text-white text-sm font-semibold cursor-pointer flex items-center gap-2"
            >
              <Timer className="h-4 w-4" />
              {next.mode === "SPRINT" ? "Start 15 minutes" : "Start"}
            </button>
            <button
              onClick={() => complete(next.task)}
              className="press px-5 py-3 rounded-full bg-slate-800 text-slate-100 text-sm font-medium border border-white/15 cursor-pointer flex items-center gap-2"
            >
              <Check className="h-4 w-4" /> Already done
            </button>
            <button
              onClick={() => defer(next.task, 1)}
              className="press px-5 py-3 rounded-full text-slate-200 text-sm cursor-pointer flex items-center gap-2 hover:text-white"
            >
              <CalendarClock className="h-4 w-4" /> Tomorrow
            </button>
            <button
              onClick={() => setNotNow((prev) => [...prev, next.task.id])}
              className="press px-4 py-3 rounded-full text-slate-300 text-sm cursor-pointer hover:text-white"
            >
              Not this one
            </button>
          </div>
        </div>
      ) : (
        <div className="morph-in p-8 rounded-[2rem] bg-slate-900/60 border border-white/10 text-center space-y-2">
          <Coffee className="h-8 w-8 mx-auto text-amber-300" />
          <div className="text-lg font-semibold text-white">Nothing needs you right now</div>
          <p className="text-sm text-slate-300">
            {notNow.length > 0 ? (
              <>
                You skipped everything that was left.{" "}
                <button onClick={() => setNotNow([])} className="underline cursor-pointer text-amber-200">
                  Show them again
                </button>
              </>
            ) : (
              "Your list is clear. Rest, and let the energy build."
            )}
          </p>
        </div>
      )}

      {/* What can't wait */}
      {!isLoading && essentials.length > 0 && (
        <div className="space-y-2.5">
          <h2 className="text-sm font-semibold text-slate-100">Can't wait today ({essentials.length})</h2>
          <div className="space-y-2">
            {essentials.map((t) => (
              <div key={t.id}>{renderTask(t)}</div>
            ))}
          </div>
        </div>
      )}

      {/* Quick wins */}
      {!isLoading && batch.tasks.length > 0 && (
        <div className="p-4 sm:p-5 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-white flex items-center gap-2">
                <Layers className="h-4 w-4 text-sky-300" /> Quick wins
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                {batch.count} light task{batch.count === 1 ? "" : "s"} you can clear in about {batch.totalMinutes} minutes, without much thinking.
              </p>
            </div>
            {!batchRun && (
              <button onClick={startBatch} className="press px-5 py-2.5 rounded-full bg-blue-600 text-white text-sm font-semibold cursor-pointer shrink-0">
                Start quick wins
              </button>
            )}
          </div>
          {batchRun && (
            <div className="space-y-2">
              {batchItems.map((t: any) => {
                const done = batchDone.includes(t.id);
                return (
                  <button
                    key={t.id}
                    onClick={() => !done && tickBatchItem(t)}
                    className={`press w-full flex items-center gap-3 p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      done ? "bg-emerald-400/10 border-emerald-300/30" : "bg-slate-950/50 border-white/10 hover:border-white/30"
                    }`}
                  >
                    <span
                      className={`h-6 w-6 rounded-full border flex items-center justify-center shrink-0 transition-all ${
                        done ? "bg-emerald-400 border-emerald-300 text-slate-950 scale-110" : "border-white/30 text-transparent"
                      }`}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </span>
                    <span className={`flex-1 text-sm ${done ? "line-through text-slate-400" : "text-slate-100"}`}>{t.title}</span>
                    <span className="text-[11px] text-slate-400">{t.estimatedMinutes} min</span>
                  </button>
                );
              })}
              {batchDone.length === batchRun.length && (
                <div className="morph-in text-sm text-emerald-200 text-center pt-1">All clear. That took almost no energy.</div>
              )}
              <div className="text-right">
                <button onClick={() => setBatchRun(null)} className="text-xs text-slate-300 hover:text-white cursor-pointer">
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Everything else can wait */}
      {!isLoading && waiting.length > 0 && (
        <div className="space-y-2.5">
          <button
            onClick={() => setShowWaiting((v) => !v)}
            className="press flex items-center gap-2 text-sm font-semibold text-slate-100 cursor-pointer"
          >
            Can wait ({waiting.length})
            <span className="text-xs font-normal text-slate-300">{showWaiting ? "Hide" : "Show"}</span>
          </button>
          {showWaiting && (
            <div className="space-y-2 morph-in">
              {waiting.map((t) => (
                <div key={t.id} className="space-y-1">
                  {renderTask(t)}
                  <p className="text-[11px] text-slate-400 px-3">{t.actionReason}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Effort saved: real numbers */}
      <div className="p-4 sm:p-5 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-3">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <div className="text-sm font-semibold text-white">Energy you've kept this week</div>
          <div className="text-2xl font-semibold text-amber-200 tabular-nums">{formatMinutes(saved?.week.minutesFreed ?? 0)}</div>
        </div>
        <p className="text-xs text-slate-300">
          {saved && (saved.week.deferred || saved.week.dropped || saved.week.sprints || saved.week.batches)
            ? "Time you didn't have to spend, from tasks you deferred or dropped."
            : "Defer, drop or batch something and it will be counted here."}
        </p>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(5.5rem,1fr))] gap-3 text-center">
          {[
            { label: "Deferred", value: saved?.week.deferred ?? 0 },
            { label: "Dropped", value: saved?.week.dropped ?? 0 },
            { label: "Quick wins", value: saved?.week.batches ?? 0 },
            { label: "Sprints", value: saved?.week.sprints ?? 0 },
          ].map((s) => (
            <div key={s.label} className="px-2 py-3 rounded-2xl bg-slate-950/50 border border-slate-800 min-w-0">
              <div className="text-lg font-semibold text-white tabular-nums">{s.value}</div>
              <div className="text-[11px] text-slate-300 truncate">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Undo toasts */}
      <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[60] space-y-2 w-[min(92vw,26rem)]">
        {toasts.map((t) => (
          <div key={t.id} className="morph-in glass-panel rounded-full px-4 py-2.5 flex items-center gap-3 text-sm text-slate-100">
            <span className="flex-1 truncate">{t.message}</span>
            {t.undo && (
              <button
                onClick={() => {
                  t.undo?.();
                  setToasts((prev) => prev.filter((x) => x.id !== t.id));
                }}
                className="press flex items-center gap-1 text-amber-200 font-medium cursor-pointer shrink-0"
              >
                <Undo2 className="h-3.5 w-3.5" /> Undo
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
