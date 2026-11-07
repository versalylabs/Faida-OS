"use client";

import { useState, useEffect } from "react";
import {
  BarChart3,
  CheckCircle,
  Clock,
  BookOpen,
  Zap,
  TrendingUp,
  FolderGit2,
  Calendar,
  Loader2,
  Sparkles,
  Bot,
  Layers,
} from "lucide-react";
import { formatKES, formatDate } from "@/lib/utils";

import { offlineFetch } from "@/lib/offlineSync";
interface AnalyticsData {
  tasksCompletedWeek: number;
  tasksWeekChange: string;
  activeTasksCount: number;
  deepWorkHours: string;
  totalLearningHours: string;
  subjectHours: Record<string, number>;
  totalSpentKES: number;
  totalEarnedKES: number;
  projectVelocity: {
    id: string;
    name: string;
    progressPercent: number;
    completedMilestones: number;
    totalMilestones: number;
  }[];
}

interface JournalData {
  date: string;
  completedTasksCount: number;
  focusMinutes: number;
  learningMinutes: number;
  summary: string;
  completedTasks: { id: string; title: string; project?: { name: string } | null }[];
  studySessions: { id: string; durationMinutes: number; topic: { title: string; subject: { name: string } } }[];
  activities: { id: string; action: string; details?: string | null; timestamp: string }[];
}

interface AutomationRule {
  id: string;
  name: string;
  trigger: string;
  description: string;
  isActive: boolean;
  timesTriggered: number;
}

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [journal, setJournal] = useState<JournalData | null>(null);
  const [automations, setAutomations] = useState<AutomationRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [anRes, jRes] = await Promise.all([
        offlineFetch("/api/analytics"),
        offlineFetch("/api/journal"),
      ]);

      const anData = await anRes.json();
      const jData = await jRes.json();

      if (anData.success) setAnalytics(anData.analytics);
      if (jData.success) setJournal(jData.today);
    } catch (e) {
      console.error("Failed to load analytics:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleToggleAutomation = async (rule: AutomationRule) => {
    const nextState = !rule.isActive;
    setAutomations(
      automations.map((r) => (r.id === rule.id ? { ...r, isActive: nextState } : r))
    );

    try {
      await offlineFetch("/api/automations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: rule.id, isActive: nextState }),
      });
    } catch (e) {
      fetchData();
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs text-blue-400 font-mono tracking-wider uppercase mb-1">
          <BarChart3 className="h-3.5 w-3.5" />
          Feedback & Velocity
        </div>
        <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-white">
          Personal Analytics & Work Journal
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Auto-constructed retrospective logs, execution velocity, and personal automation rules.
        </p>
      </div>

      {isLoading ? (
        <div className="py-24 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
          <span>Aggregating life analytics...</span>
        </div>
      ) : (
        <>
          {/* Top Velocity Stats */}
          {analytics && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Tasks Completed</span>
                </div>
                <div className="text-2xl font-extrabold text-white">
                  {analytics.tasksCompletedWeek}
                </div>
                <span className="text-[10px] text-emerald-400 font-mono block">
                  {analytics.tasksWeekChange} velocity vs last week
                </span>
              </div>

              <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Clock className="h-3.5 w-3.5 text-blue-400" />
                  <span>Focus Deep Work</span>
                </div>
                <div className="text-2xl font-extrabold text-white">
                  {analytics.deepWorkHours}
                </div>
                <span className="text-[10px] text-blue-400 font-mono block">
                  ~3.7 hours daily avg
                </span>
              </div>

              <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <BookOpen className="h-3.5 w-3.5 text-purple-400" />
                  <span>Learning Invested</span>
                </div>
                <div className="text-2xl font-extrabold text-white">
                  {analytics.totalLearningHours}
                </div>
                <span className="text-[10px] text-purple-400 font-mono block">
                  Databases & Fullstack
                </span>
              </div>

              <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Expenses (KES)</span>
                </div>
                <div className="text-2xl font-extrabold text-white">
                  {formatKES(analytics.totalSpentKES)}
                </div>
                <span className="text-[10px] text-emerald-400 font-mono block">
                  All expenses you have logged
                </span>
              </div>
            </div>
          )}

          {/* Automatic Work Journal */}
          {journal && (
            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-5 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <Sparkles className="h-4 w-4 text-blue-400" />
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                    Automatic Daily Work Journal
                  </h2>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    Live Synthesis
                  </span>
                </div>
                <span className="text-xs font-mono text-slate-500">{journal.date}</span>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 font-mono text-xs text-slate-300 space-y-3 leading-relaxed">
                <div className="text-blue-400 font-bold">// AI Daily Retrospective Summary</div>
                <p className="text-slate-300 font-sans text-xs leading-relaxed">
                  &quot;{journal.summary}&quot;
                </p>

                {journal.completedTasks.length > 0 && (
                  <div className="space-y-1 pt-2 border-t border-slate-800">
                    <div className="text-slate-400 text-[11px] uppercase">
                      Accomplished Tasks ({journal.completedTasks.length})
                    </div>
                    {journal.completedTasks.map((t) => (
                      <div key={t.id} className="text-emerald-400 flex items-center gap-2">
                        <span>✓</span>
                        <span>{t.title}</span>
                        {t.project && (
                          <span className="text-slate-500 text-[10px]">({t.project.name})</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {journal.studySessions.length > 0 && (
                  <div className="space-y-1 pt-2 border-t border-slate-800">
                    <div className="text-slate-400 text-[11px] uppercase">
                      Skill Sessions ({journal.studySessions.length})
                    </div>
                    {journal.studySessions.map((s) => (
                      <div key={s.id} className="text-purple-400 flex items-center gap-2">
                        <span>📚</span>
                        <span>
                          {s.topic.title} • {s.durationMinutes} minutes ({s.topic.subject.name})
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* What Faida really does on its own (no invented rules or counters) */}
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-blue-400" />
              <h2 className="text-sm font-semibold text-slate-100">What Faida does for you automatically</h2>
            </div>
            <ul className="space-y-2.5 text-sm text-slate-300">
              {[
                "Repeating tasks line up their next occurrence the moment you finish one.",
                "Finished tasks and finished work deliverables clear themselves 48 hours after completion.",
                "Overdue and due-today work is flagged in the header and placed first in your daily plan.",
                "Lazy Mode learns your energy by the hour from your check-ins and keeps heavy work for when you have it.",
                "The planner works around your classes and calendar events, and protects lunch and breaks.",
              ].map((line) => (
                <li key={line} className="flex items-start gap-2.5">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-emerald-300 shrink-0" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
