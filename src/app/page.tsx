"use client";

import { useState, useEffect } from "react";
import {
  Sparkles,
  CheckCircle2,
  Calendar,
  Clock,
  AlertTriangle,
  FolderGit2,
  Wallet,
  ShoppingCart,
  ArrowRight,
  Plus,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { formatKES } from "@/lib/utils";

interface TaskItem {
  id: string;
  title: string;
  priority: string;
  estimatedMinutes: number;
  status: string;
  project?: { name: string } | null;
}

export default function DashboardPage() {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [attention, setAttention] = useState({ urgentCount: 0, dueTodayCount: 0 });
  const [isLoading, setIsLoading] = useState(true);

  const currentDate = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  const loadData = async () => {
    try {
      const [tasksRes, attentionRes] = await Promise.all([
        fetch("/api/tasks?status=TODO"),
        fetch("/api/attention"),
      ]);
      const tasksData = await tasksRes.json();
      const attentionData = await attentionRes.json();

      if (tasksData.success) setTasks(tasksData.tasks);
      if (attentionData.success) setAttention(attentionData);
    } catch (e) {
      console.error("Dashboard data load error:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const topPriorityTask = tasks[0];
  const upcomingQueue = tasks.slice(1, 4);

  return (
    <div className="space-y-5 sm:space-y-8 max-w-7xl mx-auto">
      {/* Welcome & Command Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 sm:pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs text-blue-400 font-mono tracking-wider uppercase mb-1">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
            Mission Control • {currentDate}
          </div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-white">
            Personal Command Center
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Execution engine online. Tracking priorities, schedule drift, and KES cashflow.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <Link
            href="/capture"
            className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium text-xs shadow-lg shadow-blue-500/25 transition-all"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Universal Capture</span>
          </Link>
          <Link
            href="/planner"
            className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-medium transition-all"
          >
            <Calendar className="h-3.5 w-3.5 text-blue-400" />
            <span>Plan My Day</span>
          </Link>
        </div>
      </div>

      {/* Faida AI Copilot Briefing Box */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-950/40 via-slate-900 to-slate-950 border border-blue-500/20 p-4 sm:p-6 shadow-xl">
        <div className="flex items-start gap-3 sm:gap-4">
          <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0 shadow-inner">
            <Sparkles className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
          <div className="space-y-2 flex-1">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-blue-300 flex items-center gap-2">
                Faida Intelligence Briefing
                <span className="text-[10px] bg-blue-500/20 border border-blue-500/30 text-blue-300 px-2 py-0.5 rounded-full font-mono">
                  Autonomous
                </span>
              </h2>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed max-w-3xl">
              &quot;Good day. You have <strong>{tasks.length} active tasks</strong> in the execution queue.
              Faida has organized your priorities and allocated buffer intervals in your daily planner.&quot;
            </p>
          </div>
        </div>
      </div>

      {/* Grid: Main Operations */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Today's Focus & Priority */}
        <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-red-500" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Top Priority Focus
              </h2>
            </div>
            {topPriorityTask && (
              <span className="text-[11px] text-slate-400 font-mono">
                {topPriorityTask.estimatedMinutes}m est
              </span>
            )}
          </div>

          {isLoading ? (
            <div className="py-8 text-center text-xs text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin mx-auto mb-1 text-blue-400" />
              Loading focus queue...
            </div>
          ) : topPriorityTask ? (
            <div className="p-3.5 rounded-lg bg-red-500/10 border border-red-500/20">
              <div className="text-xs font-semibold text-red-200">
                {topPriorityTask.title}
              </div>
              <p className="text-[11px] text-red-300/80 mt-1">
                Project: {topPriorityTask.project?.name || "General"} • Priority: {topPriorityTask.priority}
              </p>
            </div>
          ) : (
            <div className="p-4 rounded-lg bg-slate-950 text-xs text-slate-500 text-center">
              All tasks completed! Capture more via `Ctrl + K`.
            </div>
          )}

          <div className="space-y-2 pt-2 border-t border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                Upcoming Queue
              </span>
              <Link href="/tasks" className="text-[11px] text-blue-400 hover:underline">
                View All
              </Link>
            </div>
            {upcomingQueue.length > 0 ? (
              <ul className="space-y-2 text-xs">
                {upcomingQueue.map((q) => (
                  <li
                    key={q.id}
                    className="flex items-center justify-between p-2 rounded bg-slate-800/40 text-slate-300"
                  >
                    <span className="truncate pr-2">{q.title}</span>
                    <span className="text-[10px] text-slate-400 font-mono shrink-0">
                      {q.estimatedMinutes}m
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-[11px] text-slate-600 italic">Queue is clear</div>
            )}
          </div>
        </div>

        {/* Active Projects */}
        <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FolderGit2 className="h-4 w-4 text-blue-400" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Active Projects
              </h2>
            </div>
            <Link href="/projects" className="text-[11px] text-blue-400 hover:underline flex items-center gap-1">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="space-y-3">
            <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-200">Faida OS</span>
                <span className="text-[10px] font-mono text-blue-400">Phase 2 Active</span>
              </div>
              <div className="w-full bg-slate-700/50 h-1.5 rounded-full overflow-hidden">
                <div className="bg-blue-500 h-full rounded-full w-[65%]" />
              </div>
            </div>
            <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-200">Melio</span>
                <span className="text-[10px] font-mono text-indigo-400">84%</span>
              </div>
              <div className="w-full bg-slate-700/50 h-1.5 rounded-full overflow-hidden">
                <div className="bg-indigo-500 h-full rounded-full w-[84%]" />
              </div>
            </div>
          </div>
        </div>

        {/* Life Operations: Finance & Attention */}
        <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-emerald-400" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Finance (KES)
              </h2>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
              KES Tracked
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-slate-800/40 border border-slate-800">
              <div className="text-[10px] text-slate-400 uppercase font-medium">Monthly Budget</div>
              <div className="text-sm font-semibold text-slate-100 mt-1">{formatKES(310000)}</div>
              <div className="text-[10px] text-emerald-400 mt-0.5">72% remaining</div>
            </div>
            <div className="p-3 rounded-lg bg-slate-800/40 border border-slate-800">
              <div className="text-[10px] text-slate-400 uppercase font-medium">Active Alerts</div>
              <div className="text-sm font-semibold text-amber-400 mt-1">
                {attention.urgentCount} Urgent
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">{attention.dueTodayCount} due today</div>
            </div>
          </div>
          <div className="p-3 rounded-lg bg-slate-800/30 border border-slate-800/60 flex items-center justify-between text-xs">
            <span className="text-slate-400">Next Scheduled Replan:</span>
            <Link href="/planner" className="text-blue-400 hover:underline font-medium">
              Open Dynamic Planner →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
