"use client";

import { useState, useEffect } from "react";
import {
  BatteryCharging,
  BatteryMedium,
  BatteryWarning,
  Zap,
  CheckCircle2,
  Trash2,
  Sparkles,
  RefreshCw,
  Layers,
  ArrowRight,
  Loader2,
  Smile,
  Bot,
  Flame,
} from "lucide-react";

interface EvaluatedTask {
  id: string;
  title: string;
  projectName?: string | null;
  estimatedMinutes: number;
  priority: string;
  energyCost: number;
  action: "SKIP" | "AUTOMATE" | "OPTIMIZE" | "JUST_DO_IT";
  actionReason: string;
}

interface EffortData {
  currentEnergy: number;
  isLazyMode: boolean;
  tasks: EvaluatedTask[];
  lowEnergyBatch: {
    tasks: EvaluatedTask[];
    totalMinutes: number;
    count: number;
  };
  effortSaved: {
    tasksAutomated: number;
    tasksEliminated: number;
    tasksOptimized: number;
    batchesCompleted: number;
    savedTimeFormatted: string;
  };
}

export default function LazyModePage() {
  const [energy, setEnergy] = useState<number>(60);
  const [isLazyActive, setIsLazyActive] = useState<boolean>(false);
  const [data, setData] = useState<EffortData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isExecutingBatch, setIsExecutingBatch] = useState<boolean>(false);
  const [batchMessage, setBatchMessage] = useState<string | null>(null);

  const fetchEffort = async (energyVal: number, lazy: boolean) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/effort?energy=${energyVal}&lazy=${lazy}`);
      const result = await res.json();
      if (result.success) {
        setData(result);
      }
    } catch (e) {
      console.error("Failed to load effort engine:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEffort(energy, isLazyActive);
  }, [energy, isLazyActive]);

  const handleToggleLazyMode = () => {
    const nextLazy = !isLazyActive;
    setIsLazyActive(nextLazy);
    if (nextLazy) {
      setEnergy(20); // Switch to Energy Conservation Mode
    } else {
      setEnergy(60);
    }
  };

  const handleExecuteBatch = async () => {
    if (!data?.lowEnergyBatch?.tasks?.length || isExecutingBatch) return;

    setIsExecutingBatch(true);
    setBatchMessage(null);
    const taskIds = data.lowEnergyBatch.tasks.map((t) => t.id);

    try {
      const res = await fetch("/api/effort", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "DO_BATCH", taskIds }),
      });
      const resData = await res.json();
      if (resData.success) {
        setBatchMessage(resData.message);
        fetchEffort(energy, isLazyActive);
        setTimeout(() => setBatchMessage(null), 5000);
      }
    } catch (e) {
      console.error("Failed to execute batch:", e);
    } finally {
      setIsExecutingBatch(false);
    }
  };

  const getEnergyLabel = (val: number) => {
    if (val >= 90) return { label: "Maximum Flow", color: "text-emerald-400", bg: "bg-emerald-500" };
    if (val >= 70) return { label: "High Capacity", color: "text-blue-400", bg: "bg-blue-500" };
    if (val >= 50) return { label: "Normal Focus", color: "text-indigo-400", bg: "bg-indigo-500" };
    if (val >= 30) return { label: "Low Energy", color: "text-amber-400", bg: "bg-amber-500" };
    if (val >= 15) return { label: "Minimal Capacity", color: "text-orange-400", bg: "bg-orange-500" };
    return { label: "Survival mode 😂", color: "text-rose-400", bg: "bg-rose-500" };
  };

  const currentEnergyMeta = getEnergyLabel(energy);

  return (
    <div className="space-y-5 sm:space-y-8 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 sm:pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs text-amber-400 font-mono tracking-wider uppercase mb-1">
            <span>🛋️</span>
            Faida Effort Engine
          </div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            <span>Do Less. Waste Less Energy.</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Faida evaluates everything on your plate and finds the lowest-effort path to the outcome.
          </p>
        </div>

        {/* Big Lazy Button */}
        <button
          onClick={handleToggleLazyMode}
          className={`w-full sm:w-auto px-5 py-3 rounded-2xl font-bold text-xs shadow-xl transition-all cursor-pointer flex items-center justify-center gap-2.5 shrink-0 ${
            isLazyActive
              ? "bg-amber-500 text-slate-950 ring-4 ring-amber-500/20 animate-pulse"
              : "bg-slate-900 hover:bg-slate-800 text-amber-300 border border-amber-500/30 hover:border-amber-500/60"
          }`}
        >
          <span className="text-base">😮‍💨</span>
          <span>{isLazyActive ? "Lazy Mode: ACTIVE" : "I'm Feeling Lazy."}</span>
        </button>
      </div>

      {/* Energy Battery Dashboard */}
      <div className="p-4 sm:p-6 rounded-2xl bg-gradient-to-br from-slate-900/90 to-slate-950 border border-slate-800 space-y-4 sm:space-y-5 shadow-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700 text-amber-400">
              <BatteryCharging className="h-6 w-6" />
            </div>
            <div>
              <div className="text-xs text-slate-400 font-medium">Faida Energy Gauge</div>
              <div className="text-xl font-extrabold text-white flex items-center gap-2">
                <span>🔋 {energy}%</span>
                <span className={`text-xs font-mono font-medium ${currentEnergyMeta.color}`}>
                  • {currentEnergyMeta.label}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Override Presets */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] text-slate-500">Override:</span>
            {[
              { label: "10% Survival 😂", val: 10 },
              { label: "25% Exhausted", val: 25 },
              { label: "60% Normal", val: 60 },
              { label: "90% Flow", val: 90 },
            ].map((p) => (
              <button
                key={p.val}
                onClick={() => {
                  setEnergy(p.val);
                  setIsLazyActive(p.val <= 25);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-mono transition-all cursor-pointer ${
                  energy === p.val
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold"
                    : "bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Battery Fill Bar */}
        <div className="w-full bg-slate-950 h-3.5 rounded-full overflow-hidden p-0.5 border border-slate-800">
          <div
            className={`h-full rounded-full transition-all duration-500 ${currentEnergyMeta.bg}`}
            style={{ width: `${energy}%` }}
          />
        </div>

        {/* Contextual Intelligence Recommendation */}
        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs text-slate-300 flex items-start gap-3">
          <Sparkles className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-semibold text-slate-100">Faida Recommendation:</span>
            <p className="text-slate-400 leading-relaxed">
              {energy <= 30
                ? "You're running low on capacity. Faida has suppressed demanding architectural work and assembled your low-energy batch below. You can knock out 5 things in ~20 minutes with zero cognitive fatigue."
                : energy >= 80
                ? "High energy detected! This is your optimal window for deep architectural thinking, complex debugging, or intense learning sessions."
                : "Steady focus window. Mix 1 high-effort task with quick low-friction items to maintain momentum."}
            </p>
          </div>
        </div>
      </div>

      {/* Batch Message Notification */}
      {batchMessage && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{batchMessage}</span>
        </div>
      )}

      {/* Energy Batching Card */}
      {data?.lowEnergyBatch && data.lowEnergyBatch.tasks.length > 0 && (
        <div className="p-4 sm:p-6 rounded-2xl bg-gradient-to-r from-blue-950/30 via-slate-900 to-indigo-950/30 border border-blue-500/30 space-y-4 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-base">🧺</span>
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                  Low-Energy Batch
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  {data.lowEnergyBatch.count} micro-tasks
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Quick, low-friction tasks bundled together. Total time required:{" "}
                <strong className="text-slate-200">~{data.lowEnergyBatch.totalMinutes} minutes</strong>.
              </p>
            </div>

            <button
              onClick={handleExecuteBatch}
              disabled={isExecutingBatch}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-blue-500/25 transition-all cursor-pointer flex items-center justify-center gap-2 shrink-0 disabled:opacity-50"
            >
              {isExecutingBatch ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Zap className="h-3.5 w-3.5" />
                  <span>[DO THE WHOLE BATCH]</span>
                </>
              )}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 sm:gap-2.5 pt-2">
            {data.lowEnergyBatch.tasks.map((task) => (
              <div
                key={task.id}
                className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between gap-2 text-xs"
              >
                <div className="truncate text-slate-300 font-medium">
                  {task.title}
                </div>
                <span className="text-[10px] font-mono text-slate-500 shrink-0">
                  {task.estimatedMinutes}m • ⚡ {task.energyCost}/10
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4 Action Columns */}
      <div className="space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Effort Engine Decision Breakdown
        </h2>

        {isLoading ? (
          <div className="py-20 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-amber-400" />
            <span>Evaluating cognitive overhead...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* 1. SKIP */}
            <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <span>🗑️</span> SKIP
                </span>
                <span className="text-[10px] font-mono text-slate-500">
                  {data?.tasks.filter((t) => t.action === "SKIP").length || 0}
                </span>
              </div>
              <p className="text-[10px] text-slate-500 leading-relaxed">
                &quot;You don&apos;t actually need to tackle this right now.&quot;
              </p>
              <div className="space-y-2 pt-2 border-t border-slate-800/80">
                {data?.tasks
                  .filter((t) => t.action === "SKIP")
                  .map((t) => (
                    <div
                      key={t.id}
                      className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1 text-xs"
                    >
                      <div className="font-medium text-slate-300 truncate">{t.title}</div>
                      <div className="text-[10px] text-rose-400/80">{t.actionReason}</div>
                    </div>
                  ))}
              </div>
            </div>

            {/* 2. AUTOMATE */}
            <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-300 flex items-center gap-1.5">
                  <Bot className="h-3.5 w-3.5" /> AUTOMATE
                </span>
                <span className="text-[10px] font-mono text-slate-500">
                  {data?.tasks.filter((t) => t.action === "AUTOMATE").length || 0}
                </span>
              </div>
              <p className="text-[10px] text-slate-500 leading-relaxed">
                &quot;Faida or routine scripts can handle this.&quot;
              </p>
              <div className="space-y-2 pt-2 border-t border-slate-800/80">
                {data?.tasks
                  .filter((t) => t.action === "AUTOMATE")
                  .map((t) => (
                    <div
                      key={t.id}
                      className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1 text-xs"
                    >
                      <div className="font-medium text-slate-300 truncate">{t.title}</div>
                      <div className="text-[10px] text-blue-400">{t.actionReason}</div>
                    </div>
                  ))}
              </div>
            </div>

            {/* 3. OPTIMIZE (Quick Wins) */}
            <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5" /> QUICK WINS
                </span>
                <span className="text-[10px] font-mono text-slate-500">
                  {data?.tasks.filter((t) => t.action === "OPTIMIZE").length || 0}
                </span>
              </div>
              <p className="text-[10px] text-slate-500 leading-relaxed">
                &quot;Here&apos;s the quickest path with minimal friction.&quot;
              </p>
              <div className="space-y-2 pt-2 border-t border-slate-800/80">
                {data?.tasks
                  .filter((t) => t.action === "OPTIMIZE")
                  .map((t) => (
                    <div
                      key={t.id}
                      className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1 text-xs"
                    >
                      <div className="font-medium text-slate-300 truncate">{t.title}</div>
                      <div className="text-[10px] text-emerald-400 font-mono">
                        ⚡ {t.energyCost}/10 energy • {t.estimatedMinutes}m
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* 4. JUST DO IT */}
            <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                  <span>🫡</span> JUST DO IT
                </span>
                <span className="text-[10px] font-mono text-slate-500">
                  {data?.tasks.filter((t) => t.action === "JUST_DO_IT").length || 0}
                </span>
              </div>
              <p className="text-[10px] text-slate-500 leading-relaxed">
                &quot;Unfortunately, this one actually requires you.&quot;
              </p>
              <div className="space-y-2 pt-2 border-t border-slate-800/80">
                {data?.tasks
                  .filter((t) => t.action === "JUST_DO_IT")
                  .map((t) => (
                    <div
                      key={t.id}
                      className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1 text-xs"
                    >
                      <div className="font-medium text-slate-300 truncate">{t.title}</div>
                      <div className="text-[10px] text-amber-400 font-mono">
                        ⚡ {t.energyCost}/10 energy • {t.estimatedMinutes}m
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Effort Saved Lifetime Metric */}
      {data?.effortSaved && (
        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-amber-400">
              <span>🛋️</span>
              Total Effort Saved
            </div>
            <div className="text-2xl font-black text-white">
              {data.effortSaved.savedTimeFormatted} Saved This Week
            </div>
            <p className="text-xs text-slate-400">
              You accomplished 31 things without doing 31 separate tasks.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
              <div className="text-base font-bold text-blue-400">
                {data.effortSaved.tasksAutomated}
              </div>
              <div className="text-[10px] text-slate-500 uppercase">Automated</div>
            </div>
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
              <div className="text-base font-bold text-rose-400">
                {data.effortSaved.tasksEliminated}
              </div>
              <div className="text-[10px] text-slate-500 uppercase">Eliminated</div>
            </div>
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
              <div className="text-base font-bold text-emerald-400">
                {data.effortSaved.tasksOptimized}
              </div>
              <div className="text-[10px] text-slate-500 uppercase">Optimized</div>
            </div>
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
              <div className="text-base font-bold text-purple-400">
                {data.effortSaved.batchesCompleted}
              </div>
              <div className="text-[10px] text-slate-500 uppercase">Batches</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
