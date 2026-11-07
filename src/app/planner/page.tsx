"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarClock, Check, Coffee, GraduationCap, Loader2, MapPin, RefreshCw, Sparkles, Utensils, CalendarDays } from "lucide-react";
import { formatClock, type DayPlan, type PlanSlot } from "@/lib/planner/scheduler";
import { cacheOfflineData, getCachedOfflineData } from "@/lib/offlineSync";

interface PlanResponse {
  success: boolean;
  plan: DayPlan;
  now: { minutes: number; dateLabel: string };
}

const HOUR_CHOICES = [2, 3, 4.5, 6, 7.5];

function minutesLabel(total: number) {
  const h = Math.floor(total / 60);
  const m = Math.round(total % 60);
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

const priorityBar: Record<string, string> = {
  URGENT: "border-l-rose-400",
  HIGH: "border-l-amber-400",
  MEDIUM: "border-l-indigo-300",
  LOW: "border-l-slate-500",
};

export default function PlannerPage() {
  const [hours, setHours] = useState(4.5);
  const [data, setData] = useState<PlanResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [busyTask, setBusyTask] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const load = useCallback(async (focusHours: number, quiet = false) => {
    if (!quiet) setIsLoading(true);
    try {
      const res = await fetch(`/api/planner?hours=${focusHours}`, { cache: "no-store" });
      const json = await res.json();
      if (json.success) {
        setData(json);
        cacheOfflineData(`planner_${focusHours}`, json);
      }
    } catch (e) {
      console.error("Failed to load planner:", e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const cached = getCachedOfflineData<PlanResponse>(`planner_${hours}`);
    if (cached?.plan) {
      setData(cached);
      setIsLoading(false);
    }
    load(hours, Boolean(cached?.plan));
  }, [hours, load]);

  // The plan follows the clock: refresh once a minute while the tab is open
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === "visible") {
        setTick((n) => n + 1);
        load(hours, true);
      }
    }, 60000);
    return () => clearInterval(t);
  }, [hours, load]);

  const flash = (text: string) => {
    setMessage(text);
    setTimeout(() => setMessage(null), 4000);
  };

  const act = async (taskId: string, action: "COMPLETE" | "DEFER", okText: string) => {
    setBusyTask(taskId);
    try {
      const res = await fetch("/api/effort", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, taskId, days: 1 }),
      });
      const json = await res.json();
      if (json.success) {
        flash(okText);
        await load(hours, true);
      } else {
        flash("That did not save. Try again.");
      }
    } catch {
      flash("You seem to be offline. Try again when you're back.");
    } finally {
      setBusyTask(null);
    }
  };

  const plan = data?.plan;
  const nowMin = data?.now.minutes ?? 0;

  const nextTaskSlot = useMemo(() => plan?.slots.find((s) => s.kind === "TASK"), [plan, tick]);

  const renderSlot = (slot: PlanSlot) => {
    const range = `${formatClock(slot.startMin)} – ${formatClock(slot.endMin)}`;
    const minutes = slot.endMin - slot.startMin;
    const isNow = nowMin >= slot.startMin && nowMin < slot.endMin;

    if (slot.kind === "BREAK") {
      return (
        <div key={slot.id} className="flex items-center gap-3 pl-3 py-1 text-xs text-slate-300">
          <Coffee className="h-3.5 w-3.5 text-slate-400" />
          <span className="tabular-nums">{range}</span>
          <span>Break, {minutes} min</span>
        </div>
      );
    }

    if (slot.kind === "LUNCH") {
      return (
        <div key={slot.id} className="flex items-center gap-3 pl-3 py-1.5 text-xs text-slate-300">
          <Utensils className="h-3.5 w-3.5 text-amber-300" />
          <span className="tabular-nums">{range}</span>
          <span>Lunch, away from the screen</span>
        </div>
      );
    }

    if (slot.kind === "EVENT" || slot.kind === "CLASS") {
      return (
        <div key={slot.id} className={`p-3.5 rounded-2xl bg-slate-950/40 border border-dashed ${isNow ? "border-amber-300/60" : "border-white/20"} flex items-start gap-3`}>
          {slot.kind === "CLASS" ? <GraduationCap className="h-4 w-4 text-sky-300 mt-0.5 shrink-0" /> : <CalendarDays className="h-4 w-4 text-violet-300 mt-0.5 shrink-0" />}
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-slate-100 truncate">{slot.title}</div>
            <div className="text-xs text-slate-300 flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
              <span className="tabular-nums">{range}</span>
              <span>{slot.kind === "CLASS" ? "Class" : "Fixed event"}</span>
              {slot.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> {slot.location}
                </span>
              )}
            </div>
          </div>
          {isNow && <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-300/20 text-amber-100 border border-amber-300/40 shrink-0">Now</span>}
        </div>
      );
    }

    const isNext = nextTaskSlot?.id === slot.id;
    return (
      <div
        key={slot.id}
        className={`p-4 rounded-2xl bg-slate-900/60 border border-slate-800 border-l-4 ${priorityBar[slot.priority || "MEDIUM"] || "border-l-indigo-300"} ${
          isNow || isNext ? "ring-1 ring-amber-300/50" : ""
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs tabular-nums text-slate-300">{range}</span>
              <span className="text-xs text-slate-400">{minutes} min</span>
              {slot.part && <span className="text-[11px] text-slate-400">Part {slot.part.index} of {slot.part.total}</span>}
              {(isNow || isNext) && (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-300/20 text-amber-100 border border-amber-300/40">{isNow ? "Now" : "Up next"}</span>
              )}
            </div>
            <div className="text-base font-medium text-white mt-1 break-words">{slot.title}</div>
            <div className="text-xs text-slate-300 mt-1 flex flex-wrap gap-x-3">
              {slot.projectName && <span>{slot.projectName}</span>}
              {slot.why && <span className="text-amber-200">{slot.why}</span>}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {slot.isLastPart !== false && slot.taskId && (
              <button
                onClick={() => act(slot.taskId!, "COMPLETE", `Done: ${slot.title}`)}
                disabled={busyTask === slot.taskId}
                title="Mark done"
                className="press glass-orb h-9 w-9 text-emerald-200 cursor-pointer"
              >
                {busyTask === slot.taskId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              </button>
            )}
            {slot.taskId && (
              <button
                onClick={() => act(slot.taskId!, "DEFER", `Moved to tomorrow: ${slot.title}`)}
                disabled={busyTask === slot.taskId}
                title="Move to tomorrow"
                className="press glass-orb h-9 w-9 text-slate-200 cursor-pointer"
              >
                <CalendarClock className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-sky-300 mb-1">
            <CalendarClock className="h-3.5 w-3.5" />
            Today, {data ? new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" }) : "…"}
          </div>
          <h1 className="text-2xl lg:text-3xl font-semibold tracking-tight text-white">Your day, planned</h1>
          <p className="text-sm text-slate-300 mt-1 max-w-xl">
            Built from right now, around your classes and events, with lunch and breaks protected. The heavy work goes in your morning.
          </p>
        </div>
        <button
          onClick={() => load(hours)}
          disabled={isLoading}
          className="press flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-slate-900/70 border border-white/15 text-slate-100 text-sm font-medium cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 text-sky-300 ${isLoading ? "animate-spin" : ""}`} />
          Rebuild from now
        </button>
      </div>

      <div className="p-4 sm:p-5 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-white">Focus time you want today</div>
            <div className="text-xs text-slate-300">Planned work never goes beyond this. Pick less on a low-energy day.</div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {HOUR_CHOICES.map((h) => (
              <button
                key={h}
                onClick={() => setHours(h)}
                className={`press px-3.5 py-1.5 rounded-full text-xs font-medium border cursor-pointer transition-all ${
                  hours === h ? "bg-sky-400/20 text-sky-100 border-sky-300/50" : "bg-slate-950/50 text-slate-200 border-white/10 hover:border-white/30"
                }`}
              >
                {h}h
              </button>
            ))}
          </div>
        </div>
        {plan && (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(7rem,1fr))] gap-3 text-center">
            {[
              { label: "Focus planned", value: minutesLabel(plan.focusMinutes) },
              { label: "Breaks", value: minutesLabel(plan.breakMinutes) },
              { label: "Fixed commitments", value: minutesLabel(plan.commitmentMinutes) },
              { label: "Free time left", value: minutesLabel(plan.freeMinutesLeft) },
            ].map((m) => (
              <div key={m.label} className="px-2 py-3 rounded-2xl bg-slate-950/50 border border-slate-800 min-w-0">
                <div className="text-lg font-semibold text-white tabular-nums">{m.value}</div>
                <div className="text-[11px] text-slate-300 truncate">{m.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {message && <div className="morph-in p-3 rounded-2xl bg-emerald-400/10 border border-emerald-300/30 text-sm text-emerald-100">{message}</div>}

      {plan?.notes.map((n, i) => (
        <div key={i} className="flex items-start gap-2 text-sm text-slate-200 px-1">
          <Sparkles className="h-4 w-4 text-amber-300 shrink-0 mt-0.5" />
          <span>{n}</span>
        </div>
      ))}

      {isLoading && !plan ? (
        <div className="py-16 text-center text-sm text-slate-300 flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-sky-300" />
          Building your day…
        </div>
      ) : plan && plan.slots.length === 0 ? (
        <div className="p-8 rounded-3xl bg-slate-900/60 border border-slate-800 text-center space-y-1">
          <div className="text-lg font-semibold text-white">{plan.dayOver ? "The working day is over" : "Nothing to plan"}</div>
          <p className="text-sm text-slate-300">
            {plan.dayOver ? "Rest. Tomorrow's plan builds itself from what is still open." : "Add a task with a time estimate and it will appear here."}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5 morph-in">{plan?.slots.map(renderSlot)}</div>
      )}

      {plan && plan.overflow.length > 0 && (
        <div className="space-y-2.5">
          <h2 className="text-sm font-semibold text-slate-100">Did not fit today ({plan.overflow.length})</h2>
          {plan.overflow.map(({ task, reason }) => (
            <div key={task.id} className="p-3.5 rounded-2xl bg-slate-950/40 border border-white/10 flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm text-slate-100 truncate">{task.title}</div>
                <div className="text-xs text-slate-300">{reason}</div>
              </div>
              <button
                onClick={() => act(task.id, "DEFER", `Moved to tomorrow: ${task.title}`)}
                disabled={busyTask === task.id}
                className="press px-3.5 py-1.5 rounded-full bg-slate-800 border border-white/15 text-xs text-slate-100 cursor-pointer shrink-0"
              >
                Tomorrow
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
