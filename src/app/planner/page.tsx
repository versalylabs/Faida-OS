"use client";

import { useState, useEffect } from "react";
import {
  Calendar,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertCircle,
  Coffee,
  Sparkles,
  Loader2,
  FolderGit2,
} from "lucide-react";
import { ScheduleSlot, DailyScheduleResult } from "@/lib/planner/scheduler";

export default function PlannerPage() {
  const [hours, setHours] = useState(4.5);
  const [schedule, setSchedule] = useState<DailyScheduleResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isReplanning, setIsReplanning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const fetchPlan = async (focusHours: number) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/planner?hours=${focusHours}`);
      const data = await res.json();
      if (data.success) {
        setSchedule(data.plan);
      }
    } catch (e) {
      console.error("Failed to load planner:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPlan(hours);
  }, [hours]);

  const handleReplan = async (completedSlotId?: string) => {
    if (!schedule || isReplanning) return;
    setIsReplanning(true);
    setMessage(null);

    try {
      const res = await fetch("/api/planner", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentSlots: schedule.slots,
          completedSlotId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSchedule({
          ...schedule,
          slots: data.slots,
        });
        setMessage(
          completedSlotId
            ? "Task completed! Schedule shifted automatically."
            : "Remaining day successfully replanned from current time."
        );
        setTimeout(() => setMessage(null), 4000);
      }
    } catch (e) {
      console.error("Failed to replan:", e);
    } finally {
      setIsReplanning(false);
    }
  };

  const getPriorityBorder = (p: string) => {
    switch (p) {
      case "URGENT":
        return "border-l-4 border-l-rose-500";
      case "HIGH":
        return "border-l-4 border-l-amber-500";
      case "LOW":
        return "border-l-4 border-l-slate-700";
      default:
        return "border-l-4 border-l-blue-500";
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-blue-400 font-mono tracking-wider uppercase mb-1">
            <Calendar className="h-3.5 w-3.5" />
            Dynamic Schedule Engine
          </div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-white">
            Intelligent Daily Planner
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Auto-allocates focus time by priority and dynamically reorganizes your day when plans drift.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => handleReplan()}
            disabled={isReplanning || isLoading || !schedule?.slots?.length}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 hover:bg-slate-800 text-slate-200 text-xs font-semibold shadow-md transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 text-blue-400 ${isReplanning ? "animate-spin" : ""}`}
            />
            <span>{isReplanning ? "Replanning..." : "Replan Remaining Day"}</span>
          </button>
        </div>
      </div>

      {/* Focus Hours Selector & Metrics */}
      <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-semibold text-slate-200 block">
              Available Focus Budget Today
            </span>
            <span className="text-[11px] text-slate-400">
              Faida constructs a realistic timeline with built-in 15m cognitive buffers.
            </span>
          </div>

          {/* Quick hour chips */}
          <div className="flex items-center gap-2">
            {[3.0, 4.5, 6.0, 7.5].map((h) => (
              <button
                key={h}
                onClick={() => setHours(h)}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all cursor-pointer ${
                  hours === h
                    ? "bg-blue-600 text-white font-semibold shadow-sm"
                    : "bg-slate-800 text-slate-400 hover:text-slate-200"
                }`}
              >
                {h}h
              </button>
            ))}
          </div>
        </div>

        {schedule && (
          <div className="grid grid-cols-3 gap-3 pt-3 border-t border-slate-800/80 text-xs">
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="text-[10px] text-slate-500 uppercase font-mono">Work Allocated</span>
              <div className="font-semibold text-blue-400 mt-0.5">
                {Math.floor(schedule.totalAllocatedMinutes / 60)}h {schedule.totalAllocatedMinutes % 60}m
              </div>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="text-[10px] text-slate-500 uppercase font-mono">Buffer Breaks</span>
              <div className="font-semibold text-amber-400 mt-0.5">
                {schedule.totalBufferMinutes} mins
              </div>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="text-[10px] text-slate-500 uppercase font-mono">Total Budget</span>
              <div className="font-semibold text-slate-200 mt-0.5">{hours} Hours</div>
            </div>
          </div>
        )}
      </div>

      {message && (
        <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300 animate-in fade-in flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-blue-400 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {/* Timeline Slots */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Today&apos;s Time-Blocked Schedule
        </h2>

        {isLoading ? (
          <div className="py-12 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
            <span>Computing optimal schedule...</span>
          </div>
        ) : !schedule || schedule.slots.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500 p-6 rounded-2xl bg-slate-900/40 border border-slate-800">
            No pending tasks to schedule. Capture new tasks via `Ctrl + K` or `/tasks`!
          </div>
        ) : (
          <div className="space-y-2.5">
            {schedule.slots.map((slot) => {
              const isDone = slot.status === "DONE";

              if (slot.isBreak) {
                return (
                  <div
                    key={slot.id}
                    className="p-3 rounded-xl bg-slate-950/50 border border-dashed border-slate-800 flex items-center justify-between text-xs text-slate-500 font-mono"
                  >
                    <div className="flex items-center gap-2">
                      <Coffee className="h-3.5 w-3.5 text-amber-500/70" />
                      <span>{slot.title} ({slot.durationMinutes}m)</span>
                    </div>
                    <span>{slot.startTime} - {slot.endTime}</span>
                  </div>
                );
              }

              return (
                <div
                  key={slot.id}
                  className={`p-4 rounded-xl border flex items-center justify-between gap-4 transition-all ${
                    isDone
                      ? "bg-slate-950/40 border-slate-800/60 opacity-60"
                      : `bg-slate-900/70 border-slate-800 hover:border-slate-700 ${getPriorityBorder(
                          slot.priority
                        )}`
                  }`}
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="font-mono text-xs font-semibold text-blue-400 w-28 shrink-0">
                      {slot.startTime} - {slot.endTime}
                    </div>
                    <div className="min-w-0">
                      <div
                        className={`text-xs font-semibold truncate ${
                          isDone ? "line-through text-slate-500" : "text-slate-100"
                        }`}
                      >
                        {slot.title}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono mt-0.5">
                        {slot.projectName && (
                          <span className="text-blue-400 flex items-center gap-1">
                            <FolderGit2 className="h-2.5 w-2.5" />
                            {slot.projectName}
                          </span>
                        )}
                        <span>•</span>
                        <span>{slot.durationMinutes}m duration</span>
                        <span>•</span>
                        <span className="text-amber-400">{slot.priority}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {!isDone ? (
                      <button
                        onClick={() => handleReplan(slot.id)}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-emerald-600 hover:text-white text-xs font-medium text-slate-300 border border-slate-700 transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Done & Replan</span>
                      </button>
                    ) : (
                      <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                        Completed
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Overflow Tasks */}
        {schedule && schedule.overflowTasks && schedule.overflowTasks.length > 0 && (
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
            <div className="flex items-center gap-2 text-amber-400 font-medium">
              <AlertCircle className="h-3.5 w-3.5" />
              <span>Overflow Queue ({schedule.overflowTasks.length} tasks deferred to tomorrow)</span>
            </div>
            <p className="text-[11px] text-slate-500">
              These tasks exceeded today&apos;s {hours}h focus capacity to protect you from burnout.
            </p>
            <ul className="space-y-1 text-slate-400 pt-1">
              {schedule.overflowTasks.map((t) => (
                <li key={t.id} className="flex items-center justify-between text-[11px]">
                  <span>• {t.title}</span>
                  <span className="font-mono text-slate-500">{t.estimatedMinutes}m</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
