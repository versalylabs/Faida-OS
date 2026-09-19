"use client";

import { useState, useEffect } from "react";
import {
  CheckSquare,
  Plus,
  Clock,
  Trash2,
  Filter,
  CheckCircle2,
  Circle,
  FolderGit2,
  Loader2,
  Sparkles,
} from "lucide-react";
import { formatDate } from "@/lib/utils";

interface TaskItem {
  id: string;
  title: string;
  description?: string | null;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  status: "TODO" | "IN_PROGRESS" | "DONE" | "BACKLOG";
  estimatedMinutes: number;
  actualMinutes: number;
  dueDate?: string | null;
  createdAt: string;
  project?: { id: string; name: string } | null;
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<"ALL" | "TODO" | "DONE">("ALL");
  const [showAddForm, setShowAddForm] = useState(false);

  // Form State
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<"LOW" | "MEDIUM" | "HIGH" | "URGENT">("MEDIUM");
  const [estimatedMinutes, setEstimatedMinutes] = useState("30");
  const [projectHint, setProjectHint] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchTasks = async () => {
    try {
      const res = await fetch("/api/tasks");
      const data = await res.json();
      if (data.success) {
        setTasks(data.tasks);
      }
    } catch (e) {
      console.error("Failed to load tasks:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const handleToggleDone = async (task: TaskItem) => {
    const nextStatus = task.status === "DONE" ? "TODO" : "DONE";
    // Optimistic update
    setTasks(
      tasks.map((t) => (t.id === task.id ? { ...t, status: nextStatus } : t))
    );

    try {
      await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: task.id, status: nextStatus }),
      });
    } catch (e) {
      console.error("Failed to update status:", e);
      fetchTasks();
    }
  };

  const handleDelete = async (id: string) => {
    setTasks(tasks.filter((t) => t.id !== id));
    try {
      await fetch(`/api/tasks?id=${id}`, { method: "DELETE" });
    } catch (e) {
      fetchTasks();
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          priority,
          estimatedMinutes: parseInt(estimatedMinutes, 10) || 30,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setTitle("");
        setShowAddForm(false);
        fetchTasks();
      }
    } catch (e) {
      console.error("Failed to create task:", e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredTasks = tasks.filter((t) => {
    if (filter === "TODO") return t.status !== "DONE";
    if (filter === "DONE") return t.status === "DONE";
    return true;
  });

  const getPriorityStyle = (p: string) => {
    switch (p) {
      case "URGENT":
        return "bg-rose-500/10 text-rose-400 border-rose-500/30";
      case "HIGH":
        return "bg-amber-500/10 text-amber-400 border-amber-500/30";
      case "LOW":
        return "bg-slate-800 text-slate-400 border-slate-700";
      default:
        return "bg-blue-500/10 text-blue-400 border-blue-500/30";
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-blue-400 font-mono tracking-wider uppercase mb-1">
            <CheckSquare className="h-3.5 w-3.5" />
            Execution Engine
          </div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-white">
            Task Management
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Connected to projects, daily planner, and intelligent reminders.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-500/20 cursor-pointer transition-all"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>New Task</span>
          </button>
        </div>
      </div>

      {/* New Task Inline Modal/Form */}
      {showAddForm && (
        <form
          onSubmit={handleCreateTask}
          className="p-5 rounded-2xl bg-slate-900 border border-slate-700 space-y-4 animate-in fade-in"
        >
          <div className="text-xs font-semibold text-slate-200">Quick Create Task</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              type="text"
              placeholder="What needs to get done?"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="md:col-span-2 bg-slate-950 border border-slate-700 rounded-xl px-4 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
              autoFocus
            />
            <div className="flex gap-2">
              <select
                value={priority}
                onChange={(e: any) => setPriority(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
              <select
                value={estimatedMinutes}
                onChange={(e) => setEstimatedMinutes(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none flex-1"
              >
                <option value="15">15 min</option>
                <option value="30">30 min</option>
                <option value="45">45 min</option>
                <option value="60">1 hour</option>
                <option value="90">1.5 hours</option>
                <option value="120">2 hours</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim() || isSubmitting}
              className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? "Adding..." : "Add Task"}
            </button>
          </div>
        </form>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          {(["ALL", "TODO", "DONE"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                filter === tab
                  ? "bg-blue-600/15 text-blue-400 border border-blue-500/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {tab === "ALL" ? `All (${tasks.length})` : tab === "TODO" ? "Active" : "Completed"}
            </button>
          ))}
        </div>
        <span className="text-[11px] text-slate-500 font-mono">
          {tasks.filter((t) => t.status !== "DONE").length} pending
        </span>
      </div>

      {/* Task List */}
      {isLoading ? (
        <div className="py-12 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
          <span>Loading tasks...</span>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="py-12 text-center text-xs text-slate-500">
          No tasks found in this view. Use Universal Capture (`Ctrl + K`) or click &quot;New Task&quot; above.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTasks.map((t) => {
            const isDone = t.status === "DONE";
            return (
              <div
                key={t.id}
                className={`p-3 sm:p-4 rounded-xl border flex items-center justify-between gap-2.5 sm:gap-4 transition-all ${
                  isDone
                    ? "bg-slate-950/40 border-slate-800/60 opacity-60"
                    : "bg-slate-900/60 border-slate-800 hover:border-slate-700"
                }`}
              >
                <div className="flex items-center gap-2.5 sm:gap-3.5 flex-1 min-w-0">
                  <button
                    onClick={() => handleToggleDone(t)}
                    className="shrink-0 text-slate-500 hover:text-blue-400 cursor-pointer transition-colors"
                  >
                    {isDone ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <Circle className="h-4 w-4" />
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div
                      className={`text-xs font-semibold truncate ${
                        isDone ? "line-through text-slate-500" : "text-slate-200"
                      }`}
                    >
                      {t.title}
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] text-slate-500 font-mono mt-0.5 truncate">
                      {t.project && (
                        <span className="text-blue-400 flex items-center gap-1 shrink-0">
                          <FolderGit2 className="h-2.5 w-2.5" />
                          {t.project.name}
                        </span>
                      )}
                      <span>•</span>
                      <span className="flex items-center gap-1 shrink-0">
                        <Clock className="h-2.5 w-2.5" />
                        {t.estimatedMinutes}m
                      </span>
                      {t.dueDate && (
                        <>
                          <span>•</span>
                          <span className="shrink-0">Due {formatDate(t.dueDate)}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                  <span
                    className={`text-[9px] sm:text-[10px] font-mono px-1.5 sm:px-2 py-0.5 rounded border ${getPriorityStyle(
                      t.priority
                    )}`}
                  >
                    {t.priority}
                  </span>
                  <button
                    onClick={() => handleDelete(t.id)}
                    className="p-1 hover:bg-slate-800 rounded text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                    title="Delete task"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
