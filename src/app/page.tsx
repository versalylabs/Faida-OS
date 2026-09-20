"use client";

import { useState, useEffect } from "react";
import {
  Sparkles,
  CheckCircle2,
  Calendar,
  Clock,
  FolderGit2,
  Wallet,
  ShoppingCart,
  ArrowRight,
  Plus,
  Loader2,
  GraduationCap,
  BookOpen,
  Tag,
  MapPin,
  Bell,
  CheckSquare,
  AlertTriangle,
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

interface ProjectItem {
  id: string;
  name: string;
  description?: string | null;
  status: string;
  progressPercent: number;
  color?: string | null;
  totalTasks?: number;
  completedTasks?: number;
}

interface CalendarScheduleItem {
  id: string;
  title: string;
  dateTime: string;
  type: "EVENT" | "REMINDER";
  location?: string | null;
  isAllDay?: boolean;
  taskTitle?: string | null;
}

interface ShoppingSummary {
  pendingCount: number;
  completedCount: number;
  totalEstimated: number;
  topItems: Array<{
    id: string;
    name: string;
    quantity?: string | null;
    category?: string | null;
    preferredStore?: string | null;
    estimatedPrice?: number | null;
  }>;
}

interface AcademicSummary {
  courseCount: number;
  nextClass?: {
    code: string;
    name: string;
    room?: string | null;
    time: string;
  } | null;
  upcomingDeadline?: {
    title: string;
    courseCode?: string;
    dueDate?: string | null;
  } | null;
}

interface NoteItem {
  id: string;
  title: string;
  category?: string | null;
  updatedAt: string;
  project?: { id: string; name: string; color?: string | null } | null;
}

function formatScheduleTime(dateStr: string, isAllDay = false): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const now = new Date();

  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();

  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const isTomorrow =
    d.getDate() === tomorrow.getDate() &&
    d.getMonth() === tomorrow.getMonth() &&
    d.getFullYear() === tomorrow.getFullYear();

  const timePart = isAllDay
    ? "All day"
    : d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  if (isToday) return `Today • ${timePart}`;
  if (isTomorrow) return `Tomorrow • ${timePart}`;
  return `${d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })} • ${timePart}`;
}

export default function DashboardPage() {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [scheduleItems, setScheduleItems] = useState<CalendarScheduleItem[]>([]);
  const [shoppingSummary, setShoppingSummary] = useState<ShoppingSummary>({
    pendingCount: 0,
    completedCount: 0,
    totalEstimated: 0,
    topItems: [],
  });
  const [academicSummary, setAcademicSummary] = useState<AcademicSummary>({
    courseCount: 0,
    nextClass: null,
    upcomingDeadline: null,
  });
  const [recentNotes, setRecentNotes] = useState<NoteItem[]>([]);

  const [attention, setAttention] = useState({ urgentCount: 0, dueTodayCount: 0 });
  const [financeMetrics, setFinanceMetrics] = useState<{
    monthlyBudget: number;
    remainingBudget: number;
    budgetPercentUsed: number;
  }>({
    monthlyBudget: 310000,
    remainingBudget: 223200,
    budgetPercentUsed: 28,
  });
  const [isLoading, setIsLoading] = useState(true);

  const currentDate = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  const loadData = async () => {
    try {
      const [
        tasksData,
        attentionData,
        financeData,
        projectsData,
        calendarData,
        shoppingData,
        universityData,
        notesData,
      ] = await Promise.all([
        fetch("/api/tasks?status=TODO", { cache: "no-store" })
          .then((r) => r.json())
          .catch(() => ({ success: false })),
        fetch("/api/attention", { cache: "no-store" })
          .then((r) => r.json())
          .catch(() => ({ success: false })),
        fetch("/api/finance", { cache: "no-store" })
          .then((r) => r.json())
          .catch(() => ({ success: false })),
        fetch("/api/projects", { cache: "no-store" })
          .then((r) => r.json())
          .catch(() => ({ success: false })),
        fetch("/api/calendar", { cache: "no-store" })
          .then((r) => r.json())
          .catch(() => ({ success: false })),
        fetch("/api/shopping", { cache: "no-store" })
          .then((r) => r.json())
          .catch(() => ({ success: false })),
        fetch("/api/university/dashboard", { cache: "no-store" })
          .then((r) => r.json())
          .catch(() => ({ success: false })),
        fetch("/api/notes", { cache: "no-store" })
          .then((r) => r.json())
          .catch(() => ({ success: false })),
      ]);

      // 1. Tasks
      if (tasksData.success && tasksData.tasks) {
        setTasks(tasksData.tasks);
      }

      // 2. Attention
      if (attentionData.success) {
        setAttention(attentionData);
      }

      // 3. Finance
      if (financeData.success && financeData.metrics) {
        setFinanceMetrics({
          monthlyBudget: financeData.metrics.monthlyBudget,
          remainingBudget: financeData.metrics.remainingBudget,
          budgetPercentUsed: financeData.metrics.budgetPercentUsed,
        });
      }

      // 4. Projects
      if (projectsData.success && projectsData.projects) {
        setProjects(projectsData.projects);
      }

      // 5. Calendar / Scheduler
      if (calendarData.success) {
        const eventsList: CalendarScheduleItem[] = (calendarData.events || []).map(
          (e: any) => ({
            id: e.id,
            title: e.title,
            dateTime: e.startTime,
            type: "EVENT" as const,
            location: e.location,
            isAllDay: e.isAllDay,
            taskTitle: e.task?.title,
          })
        );
        const remindersList: CalendarScheduleItem[] = (
          calendarData.reminders || []
        )
          .filter((r: any) => !r.isCompleted)
          .map((r: any) => ({
            id: r.id,
            title: r.title,
            dateTime: r.dueAt,
            type: "REMINDER" as const,
            taskTitle: r.task?.title,
          }));

        const combined = [...eventsList, ...remindersList].sort(
          (a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime()
        );
        setScheduleItems(combined.slice(0, 4));
      }

      // 6. Smart Shopping
      if (shoppingData.success && shoppingData.items) {
        const pending = shoppingData.items.filter((i: any) => !i.isChecked);
        const totalEst = pending.reduce(
          (acc: number, cur: any) => acc + (cur.estimatedPrice || 0),
          0
        );
        setShoppingSummary({
          pendingCount: shoppingData.pendingCount ?? pending.length,
          completedCount: shoppingData.completedCount ?? 0,
          totalEstimated: totalEst,
          topItems: pending.slice(0, 4),
        });
      }

      // 7. University Hub
      if (universityData.success) {
        let nextClassInfo = null;
        if (universityData.nextClass) {
          nextClassInfo = {
            code: universityData.nextClass.course?.code || "ACAD",
            name: universityData.nextClass.name || "Lecture",
            room: universityData.nextClass.room,
            time: universityData.nextClass.startTime || "",
          };
        } else if (
          universityData.todayClasses &&
          universityData.todayClasses.length > 0
        ) {
          const first = universityData.todayClasses[0];
          nextClassInfo = {
            code: first.course?.code || "ACAD",
            name: first.name || "Lecture",
            room: first.room,
            time: first.startTime || "",
          };
        }

        let upcomingDead = null;
        if (
          universityData.dueSoonAssignments &&
          universityData.dueSoonAssignments.length > 0
        ) {
          const firstAssign = universityData.dueSoonAssignments[0];
          upcomingDead = {
            title: firstAssign.title,
            courseCode: firstAssign.course?.code,
            dueDate: firstAssign.dueDate,
          };
        } else if (
          universityData.upcomingAssessments &&
          universityData.upcomingAssessments.length > 0
        ) {
          const firstAssess = universityData.upcomingAssessments[0];
          upcomingDead = {
            title: `${firstAssess.type}: ${firstAssess.title}`,
            courseCode: firstAssess.course?.code,
            dueDate: firstAssess.date,
          };
        }

        setAcademicSummary({
          courseCount: (universityData.courses || []).length,
          nextClass: nextClassInfo,
          upcomingDeadline: upcomingDead,
        });
      }

      // 8. Notes
      if (notesData.success && notesData.notes) {
        setRecentNotes(notesData.notes.slice(0, 3));
      }
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
  const activeProjects = projects.filter((p) => p.status === "ACTIVE");
  const displayProjects =
    activeProjects.length > 0 ? activeProjects.slice(0, 4) : projects.slice(0, 4);

  return (
    <div className="space-y-6 sm:space-y-8 max-w-7xl mx-auto">
      {/* Welcome & Command Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 sm:pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs text-blue-400 font-mono tracking-wider uppercase mb-1">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
            Mission Control • {currentDate}
          </div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-white">
            Personal Command Center
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Execution engine online. Real-time priorities, schedule, academic deadlines & cashflow.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <Link
            href="/capture"
            className="flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium text-xs shadow-lg shadow-blue-500/25 transition-all"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Universal Capture</span>
          </Link>
          <Link
            href="/planner"
            className="flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-medium transition-all"
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
          <div className="space-y-1.5 flex-1">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-blue-300 flex items-center gap-2">
                Faida Intelligence Briefing
                <span className="text-[10px] bg-blue-500/20 border border-blue-500/30 text-blue-300 px-2 py-0.5 rounded-full font-mono">
                  Autonomous
                </span>
              </h2>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed max-w-3xl">
              &quot;Good day. You have <strong>{tasks.length} active tasks</strong> in the execution queue,{" "}
              <strong>{scheduleItems.length} upcoming events</strong> on your schedule,{" "}
              <strong>{projects.length} active projects</strong>, and{" "}
              <strong>{shoppingSummary.pendingCount} items</strong> to buy on your shopping list.
              Faida has organized your priorities across all subsystems.&quot;
            </p>
          </div>
        </div>
      </div>

      {/* PRIMARY ROW: Tasks Focus, Active Projects, Finance */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* 1. Today's Focus & Tasks Queue */}
        <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-4 sm:p-5 space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
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
              <Link
                href="/tasks"
                className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 block hover:border-red-500/40 transition-colors group"
              >
                <div className="text-xs font-semibold text-red-200 group-hover:text-white transition-colors">
                  {topPriorityTask.title}
                </div>
                <p className="text-[11px] text-red-300/80 mt-1">
                  Project: {topPriorityTask.project?.name || "General"} • Priority:{" "}
                  {topPriorityTask.priority}
                </p>
              </Link>
            ) : (
              <div className="p-4 rounded-xl bg-slate-950 text-xs text-slate-500 text-center">
                All tasks completed! Capture more via `Ctrl + K`.
              </div>
            )}

            <div className="space-y-2 pt-2 border-t border-slate-800/80">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                  Upcoming Queue
                </span>
                <Link href="/tasks" className="text-[11px] text-blue-400 hover:underline">
                  View All ({tasks.length})
                </Link>
              </div>
              {upcomingQueue.length > 0 ? (
                <ul className="space-y-2 text-xs">
                  {upcomingQueue.map((q) => (
                    <li key={q.id}>
                      <Link
                        href="/tasks"
                        className="flex items-center justify-between p-2 rounded-lg bg-slate-800/40 hover:bg-slate-800/70 text-slate-300 transition-colors"
                      >
                        <span className="truncate pr-2">{q.title}</span>
                        <span className="text-[10px] text-slate-400 font-mono shrink-0">
                          {q.estimatedMinutes}m
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-[11px] text-slate-600 italic">Queue is clear</div>
              )}
            </div>
          </div>
        </div>

        {/* 2. Active Projects */}
        <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-4 sm:p-5 space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderGit2 className="h-4 w-4 text-blue-400" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Active Projects {projects.length > 0 && `(${activeProjects.length || projects.length})`}
                </h2>
              </div>
              <Link
                href="/projects"
                className="text-[11px] text-blue-400 hover:underline flex items-center gap-1"
              >
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            <div className="space-y-2.5">
              {isLoading ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin mx-auto mb-1 text-blue-400" />
                  Loading projects...
                </div>
              ) : displayProjects.length === 0 ? (
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 text-xs text-slate-500 text-center space-y-2">
                  <div>No projects created yet.</div>
                  <Link
                    href="/projects"
                    className="inline-flex items-center gap-1 text-blue-400 hover:underline font-medium"
                  >
                    <Plus className="h-3 w-3" />
                    <span>Create Project</span>
                  </Link>
                </div>
              ) : (
                displayProjects.map((proj) => {
                  const color = proj.color || "#3b82f6";
                  return (
                    <Link
                      key={proj.id}
                      href={`/projects/${proj.id}`}
                      className="p-3 rounded-lg bg-slate-800/50 hover:bg-slate-800/80 border border-slate-800 hover:border-slate-700 space-y-2 block transition-all group"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="h-2 w-2 rounded-full shrink-0"
                            style={{ backgroundColor: color }}
                          />
                          <span className="text-xs font-medium text-slate-200 group-hover:text-white truncate">
                            {proj.name}
                          </span>
                        </div>
                        <span
                          className="text-[10px] font-mono shrink-0 ml-2 font-semibold"
                          style={{ color: color }}
                        >
                          {proj.progressPercent}%
                        </span>
                      </div>
                      <div className="w-full bg-slate-700/50 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.max(4, proj.progressPercent)}%`,
                            backgroundColor: color,
                          }}
                        />
                      </div>
                    </Link>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* 3. Life Operations: Finance & Attention */}
        <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-4 sm:p-5 space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-emerald-400" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Finance (KES)
                </h2>
              </div>
              <Link href="/finance" className="text-[11px] text-blue-400 hover:underline">
                Manage
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-slate-800/40 border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase font-medium">
                  Monthly Budget
                </div>
                <div className="text-sm font-semibold text-slate-100 mt-1">
                  {formatKES(financeMetrics.monthlyBudget)}
                </div>
                <div
                  className={`text-[10px] mt-0.5 ${
                    financeMetrics.budgetPercentUsed > 90
                      ? "text-rose-400"
                      : "text-emerald-400"
                  }`}
                >
                  {financeMetrics.monthlyBudget > 0
                    ? `${Math.max(0, 100 - financeMetrics.budgetPercentUsed)}% remaining`
                    : "No budget set"}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-slate-800/40 border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase font-medium">
                  Active Alerts
                </div>
                <div className="text-sm font-semibold text-amber-400 mt-1">
                  {attention.urgentCount} Urgent
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {attention.dueTodayCount} due today
                </div>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-slate-800/30 border border-slate-800/60 flex items-center justify-between text-xs">
            <span className="text-slate-400">Dynamic Daily Planner:</span>
            <Link href="/planner" className="text-blue-400 hover:underline font-medium">
              Open Planner →
            </Link>
          </div>
        </div>
      </div>

      {/* SECONDARY ROW: Scheduler Card, Smart Shopping Card, Academic Command Hub */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* 4. SCHEDULER & UPCOMING EVENTS CARD */}
        <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-4 sm:p-5 space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-sky-400" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Upcoming Schedule
                </h2>
              </div>
              <Link
                href="/calendar"
                className="text-[11px] text-blue-400 hover:underline flex items-center gap-1"
              >
                Calendar <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            {isLoading ? (
              <div className="py-8 text-center text-xs text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin mx-auto mb-1 text-sky-400" />
                Loading schedule...
              </div>
            ) : scheduleItems.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 text-xs text-slate-500 text-center space-y-2">
                <div>No upcoming events or reminders scheduled.</div>
                <Link
                  href="/calendar"
                  className="inline-flex items-center gap-1 text-sky-400 hover:underline font-medium"
                >
                  <Plus className="h-3 w-3" />
                  <span>Add Event / Reminder</span>
                </Link>
              </div>
            ) : (
              <div className="space-y-2.5">
                {scheduleItems.map((item) => (
                  <Link
                    key={item.id}
                    href="/calendar"
                    className="p-2.5 rounded-lg bg-slate-800/40 hover:bg-slate-800/70 border border-slate-800/80 hover:border-slate-700 block transition-all group"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-slate-200 group-hover:text-sky-300 truncate">
                        {item.title}
                      </span>
                      <span
                        className={`text-[9px] font-mono px-1.5 py-0.2 rounded border shrink-0 ${
                          item.type === "EVENT"
                            ? "bg-sky-500/10 text-sky-400 border-sky-500/30"
                            : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                        }`}
                      >
                        {item.type}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono mt-1 flex-wrap">
                      <span className="text-sky-400/90 flex items-center gap-1">
                        <Clock className="h-2.5 w-2.5" />
                        {formatScheduleTime(item.dateTime, item.isAllDay)}
                      </span>
                      {item.location && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1 text-slate-500">
                            <MapPin className="h-2.5 w-2.5" />
                            {item.location}
                          </span>
                        </>
                      )}
                      {item.taskTitle && (
                        <>
                          <span>•</span>
                          <span className="text-slate-500 truncate max-w-[120px]">
                            {item.taskTitle}
                          </span>
                        </>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400">
            <span>Synchronized with Reminders</span>
            <Link href="/calendar" className="text-sky-400 hover:underline">
              View agenda →
            </Link>
          </div>
        </div>

        {/* 5. SMART SHOPPING CARD */}
        <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-4 sm:p-5 space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-emerald-400" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Smart Shopping
                </h2>
              </div>
              <Link
                href="/shopping"
                className="text-[11px] text-blue-400 hover:underline flex items-center gap-1"
              >
                Shopping List <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            {/* Shopping Summary Stats */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-2.5 rounded-lg bg-slate-800/40 border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase font-medium">
                  To Buy
                </div>
                <div className="text-base font-bold text-emerald-400 mt-0.5">
                  {shoppingSummary.pendingCount} items
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-800/40 border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase font-medium">
                  Estimated Cost
                </div>
                <div className="text-sm font-semibold text-slate-200 mt-0.5">
                  {formatKES(shoppingSummary.totalEstimated)}
                </div>
              </div>
            </div>

            {/* Top Pending Items */}
            {isLoading ? (
              <div className="py-4 text-center text-xs text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin mx-auto mb-1 text-emerald-400" />
                Loading inventory...
              </div>
            ) : shoppingSummary.topItems.length === 0 ? (
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 text-xs text-slate-500 text-center">
                Shopping list is clear! All supplies stocked.
              </div>
            ) : (
              <div className="space-y-1.5">
                {shoppingSummary.topItems.map((item) => (
                  <Link
                    key={item.id}
                    href="/shopping"
                    className="p-2 rounded-lg bg-slate-800/30 hover:bg-slate-800/60 border border-slate-800/60 flex items-center justify-between text-xs transition-colors"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="text-slate-200 truncate font-medium">
                        {item.name}
                      </span>
                      {item.quantity && item.quantity !== "1" && (
                        <span className="text-[10px] text-slate-400 font-mono px-1 py-0.2 rounded bg-slate-800 shrink-0">
                          x{item.quantity}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0 font-mono text-[10px]">
                      {item.category && (
                        <span className="text-emerald-400/90">
                          {item.category}
                        </span>
                      )}
                      {item.estimatedPrice && (
                        <span className="text-slate-400">
                          ~{formatKES(item.estimatedPrice)}
                        </span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400">
            <span>Custom categories enabled</span>
            <Link href="/shopping" className="text-emerald-400 hover:underline">
              Add items →
            </Link>
          </div>
        </div>

        {/* 6. ACADEMIC COMMAND CENTER CARD */}
        <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-4 sm:p-5 space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GraduationCap className="h-4 w-4 text-indigo-400" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Academic Command Hub
                </h2>
              </div>
              <Link
                href="/university"
                className="text-[11px] text-blue-400 hover:underline flex items-center gap-1"
              >
                University <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            {/* Academic Status Overview */}
            <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-indigo-300 font-semibold">
                  BSc Applied Computing
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300">
                  {academicSummary.courseCount} Active Units
                </span>
              </div>

              {/* Next Class */}
              {academicSummary.nextClass ? (
                <div className="text-[11px] text-slate-300 space-y-0.5 pt-1 border-t border-indigo-500/20">
                  <div className="flex items-center justify-between font-mono text-[10px] text-indigo-400">
                    <span>NEXT CLASS</span>
                    <span>{academicSummary.nextClass.time}</span>
                  </div>
                  <div className="font-semibold text-slate-200 truncate">
                    {academicSummary.nextClass.code} - {academicSummary.nextClass.name}
                  </div>
                  {academicSummary.nextClass.room && (
                    <div className="text-[10px] text-slate-400">
                      Room: {academicSummary.nextClass.room}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-[11px] text-slate-400 italic pt-1 border-t border-indigo-500/20">
                  No upcoming classes scheduled for today.
                </div>
              )}
            </div>

            {/* Upcoming Academic Deadline */}
            {academicSummary.upcomingDeadline ? (
              <div className="p-2.5 rounded-lg bg-slate-800/40 border border-slate-800 text-xs space-y-1">
                <div className="flex items-center justify-between text-[10px] font-mono text-amber-400">
                  <span>UPCOMING DEADLINE</span>
                  {academicSummary.upcomingDeadline.dueDate && (
                    <span>
                      Due{" "}
                      {new Date(
                        academicSummary.upcomingDeadline.dueDate
                      ).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  )}
                </div>
                <div className="font-medium text-slate-200 truncate">
                  {academicSummary.upcomingDeadline.title}
                </div>
                {academicSummary.upcomingDeadline.courseCode && (
                  <span className="text-[10px] text-indigo-400 font-mono">
                    {academicSummary.upcomingDeadline.courseCode}
                  </span>
                )}
              </div>
            ) : (
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80 text-xs text-slate-500 text-center">
                No immediate CATs or assignment deadlines pending.
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400">
            <span>Moodle / LMS Synced</span>
            <Link href="/university" className="text-indigo-400 hover:underline">
              Enter hub →
            </Link>
          </div>
        </div>
      </div>

      {/* TERTIARY SECTION: Recent Second Brain Notes */}
      {recentNotes.length > 0 && (
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-amber-400" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Second Brain • Recent Notes & Knowledge
              </h2>
            </div>
            <Link
              href="/notes"
              className="text-[11px] text-blue-400 hover:underline flex items-center gap-1"
            >
              All Notes <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {recentNotes.map((note) => (
              <Link
                key={note.id}
                href="/notes"
                className="p-3 rounded-xl bg-slate-950/60 hover:bg-slate-950 border border-slate-800/80 hover:border-slate-700 block transition-all group"
              >
                <div className="text-xs font-semibold text-slate-200 group-hover:text-amber-300 truncate">
                  {note.title}
                </div>
                <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono mt-1 truncate">
                  {note.category && (
                    <span className="text-slate-400">{note.category}</span>
                  )}
                  {note.project && (
                    <>
                      <span>•</span>
                      <span className="text-blue-400">{note.project.name}</span>
                    </>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
