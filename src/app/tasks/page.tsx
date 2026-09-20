"use client";

import { useState, useEffect } from "react";
import {
  CheckSquare,
  Plus,
  Clock,
  Trash2,
  CheckCircle2,
  Circle,
  FolderGit2,
  Loader2,
  Edit3,
  X,
  ChevronDown,
  ChevronRight,
  ListTodo,
  Calendar,
  AlertCircle,
  Save,
} from "lucide-react";
import { formatDate } from "@/lib/utils";

interface SubtaskItem {
  id: string;
  taskId?: string;
  title: string;
  isDone: boolean;
  createdAt?: string;
  _deleted?: boolean;
}

interface ProjectOption {
  id: string;
  name: string;
  color?: string | null;
}

interface TaskItem {
  id: string;
  title: string;
  description?: string | null;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  status: "BACKLOG" | "TODO" | "IN_PROGRESS" | "DONE" | "ARCHIVED";
  estimatedMinutes: number;
  actualMinutes: number;
  dueDate?: string | null;
  createdAt: string;
  projectId?: string | null;
  project?: { id: string; name: string; color?: string | null } | null;
  subtasks: SubtaskItem[];
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<"ALL" | "TODO" | "DONE">("ALL");
  const [showAddForm, setShowAddForm] = useState(false);
  const [expandedTaskIds, setExpandedTaskIds] = useState<Record<string, boolean>>({});

  // Quick Create Form State
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"LOW" | "MEDIUM" | "HIGH" | "URGENT">("MEDIUM");
  const [estimatedMinutes, setEstimatedMinutes] = useState("30");
  const [projectId, setProjectId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [quickSubtasks, setQuickSubtasks] = useState<string[]>([]);
  const [quickSubtaskInput, setQuickSubtaskInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit Task & Todos Modal State
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPriority, setEditPriority] = useState<"LOW" | "MEDIUM" | "HIGH" | "URGENT">("MEDIUM");
  const [editStatus, setEditStatus] = useState<"BACKLOG" | "TODO" | "IN_PROGRESS" | "DONE" | "ARCHIVED">("TODO");
  const [editEstimatedMinutes, setEditEstimatedMinutes] = useState("30");
  const [editActualMinutes, setEditActualMinutes] = useState("0");
  const [editDueDate, setEditDueDate] = useState("");
  const [editProjectId, setEditProjectId] = useState("");
  const [editSubtasks, setEditSubtasks] = useState<SubtaskItem[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Inline Subtask Add State for expanded tasks
  const [inlineSubtaskInputs, setInlineSubtaskInputs] = useState<Record<string, string>>({});

  const fetchTasks = async () => {
    try {
      const res = await fetch("/api/tasks", { cache: "no-store" });
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

  const fetchProjects = async () => {
    try {
      const res = await fetch("/api/projects", { cache: "no-store" });
      const data = await res.json();
      if (data.success && data.projects) {
        setProjects(data.projects);
      }
    } catch (e) {
      console.error("Failed to load projects:", e);
    }
  };

  useEffect(() => {
    fetchTasks();
    fetchProjects();
  }, []);

  // Toggle task completed status
  const handleToggleDone = async (task: TaskItem) => {
    const nextStatus = task.status === "DONE" ? "TODO" : "DONE";
    // Optimistic update
    setTasks(
      tasks.map((t) => (t.id === task.id ? { ...t, status: nextStatus } : t))
    );

    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json();
      if (!data.success) {
        fetchTasks();
      }
    } catch (e) {
      console.error("Failed to update status:", e);
      fetchTasks();
    }
  };

  // Toggle inline subtask
  const handleToggleSubtaskInline = async (taskId: string, subtask: SubtaskItem) => {
    const nextDone = !subtask.isDone;

    // Optimistic update
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== taskId) return t;
        return {
          ...t,
          subtasks: (t.subtasks || []).map((s) =>
            s.id === subtask.id ? { ...s, isDone: nextDone } : s
          ),
        };
      })
    );

    try {
      const res = await fetch(`/api/tasks/${taskId}/subtasks`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subtaskId: subtask.id,
          isDone: nextDone,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        fetchTasks();
      }
    } catch (e) {
      console.error("Failed to toggle subtask:", e);
      fetchTasks();
    }
  };

  // Add inline subtask
  const handleAddInlineSubtask = async (taskId: string) => {
    const titleVal = (inlineSubtaskInputs[taskId] || "").trim();
    if (!titleVal) return;

    try {
      const res = await fetch(`/api/tasks/${taskId}/subtasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: titleVal }),
      });
      const data = await res.json();
      if (data.success && data.subtask) {
        setTasks((prev) =>
          prev.map((t) =>
            t.id === taskId
              ? { ...t, subtasks: [...(t.subtasks || []), data.subtask] }
              : t
          )
        );
        setInlineSubtaskInputs((prev) => ({ ...prev, [taskId]: "" }));
      }
    } catch (e) {
      console.error("Failed to add subtask:", e);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this task?")) return;
    setTasks(tasks.filter((t) => t.id !== id));
    if (editingTask?.id === id) {
      setEditingTask(null);
    }
    try {
      const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.success) {
        fetchTasks();
      }
    } catch (e) {
      console.error("Failed to delete task:", e);
      fetchTasks();
    }
  };

  // Open Edit Modal
  const openEditModal = (task: TaskItem) => {
    setEditingTask(task);
    setEditTitle(task.title);
    setEditDescription(task.description || "");
    setEditPriority(task.priority);
    setEditStatus(task.status);
    setEditEstimatedMinutes(String(task.estimatedMinutes || 30));
    setEditActualMinutes(String(task.actualMinutes || 0));
    setEditDueDate(
      task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 16) : ""
    );
    setEditProjectId(task.projectId || task.project?.id || "");
    setEditSubtasks(
      (task.subtasks || []).map((s) => ({ ...s, _deleted: false }))
    );
    setNewSubtaskTitle("");
  };

  // Close Edit Modal
  const closeEditModal = () => {
    setEditingTask(null);
    setIsSavingEdit(false);
  };

  // Handle Save Edit Modal
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask || !editTitle.trim() || isSavingEdit) return;

    setIsSavingEdit(true);
    try {
      const payload = {
        title: editTitle.trim(),
        description: editDescription.trim() || null,
        priority: editPriority,
        status: editStatus,
        estimatedMinutes: parseInt(editEstimatedMinutes, 10) || 30,
        actualMinutes: parseInt(editActualMinutes, 10) || 0,
        dueDate: editDueDate ? new Date(editDueDate).toISOString() : null,
        projectId: editProjectId || null,
        subtasks: editSubtasks.map((s) => ({
          id: s.id,
          title: s.title,
          isDone: s.isDone,
          _deleted: s._deleted,
        })),
      };

      const res = await fetch(`/api/tasks/${editingTask.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success && data.task) {
        setTasks((prev) =>
          prev.map((t) => (t.id === data.task.id ? data.task : t))
        );
        closeEditModal();
      } else {
        alert(data.error || "Failed to update task");
      }
    } catch (e) {
      console.error("Error saving task:", e);
      alert("Error saving task. Please try again.");
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Subtask management inside Edit Modal
  const handleAddModalSubtask = () => {
    if (!newSubtaskTitle.trim()) return;
    const tempSubtask: SubtaskItem = {
      id: `temp_${Date.now()}_${Math.random()}`,
      title: newSubtaskTitle.trim(),
      isDone: false,
      _deleted: false,
    };
    setEditSubtasks([...editSubtasks, tempSubtask]);
    setNewSubtaskTitle("");
  };

  const handleToggleModalSubtask = (index: number) => {
    setEditSubtasks((prev) =>
      prev.map((s, idx) => (idx === index ? { ...s, isDone: !s.isDone } : s))
    );
  };

  const handleUpdateModalSubtaskTitle = (index: number, newTitle: string) => {
    setEditSubtasks((prev) =>
      prev.map((s, idx) => (idx === index ? { ...s, title: newTitle } : s))
    );
  };

  const handleDeleteModalSubtask = (index: number) => {
    setEditSubtasks((prev) =>
      prev
        .map((s, idx) => (idx === index ? { ...s, _deleted: true } : s))
        .filter((s) => !s.id.startsWith("temp_") || !s._deleted)
    );
  };

  // Quick Create Task
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
          description: description.trim() || undefined,
          priority,
          estimatedMinutes: parseInt(estimatedMinutes, 10) || 30,
          projectId: projectId || undefined,
          dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
          subtasks: quickSubtasks.map((t) => ({ title: t, isDone: false })),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setTitle("");
        setDescription("");
        setProjectId("");
        setDueDate("");
        setQuickSubtasks([]);
        setShowAddForm(false);
        fetchTasks();
      }
    } catch (e) {
      console.error("Failed to create task:", e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const addQuickSubtask = () => {
    if (!quickSubtaskInput.trim()) return;
    setQuickSubtasks([...quickSubtasks, quickSubtaskInput.trim()]);
    setQuickSubtaskInput("");
  };

  const removeQuickSubtask = (index: number) => {
    setQuickSubtasks(quickSubtasks.filter((_, i) => i !== index));
  };

  const toggleExpandTask = (id: string) => {
    setExpandedTaskIds((prev) => ({ ...prev, [id]: !prev[id] }));
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

  const getStatusBadge = (s: string) => {
    switch (s) {
      case "DONE":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
      case "IN_PROGRESS":
        return "bg-cyan-500/10 text-cyan-400 border-cyan-500/30";
      case "BACKLOG":
        return "bg-purple-500/10 text-purple-400 border-purple-500/30";
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
            Task & Todo Management
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Create, edit, organize tasks and nested checklist todos with project tracking.
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

      {/* New Task Inline Form */}
      {showAddForm && (
        <form
          onSubmit={handleCreateTask}
          className="p-5 rounded-2xl bg-slate-900 border border-slate-700 space-y-4 animate-in fade-in"
        >
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-slate-200">Create New Task</div>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="text-slate-500 hover:text-slate-300"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

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
                className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none flex-1"
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
                <option value="90">1.5 hrs</option>
                <option value="120">2 hrs</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <textarea
              placeholder="Notes or description (optional)..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500"
            />
            <div className="space-y-2">
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none"
              >
                <option value="">No Project (General)</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <input
                type="datetime-local"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none"
              />
            </div>
          </div>

          {/* Initial checklist / todos */}
          <div className="pt-2 border-t border-slate-800 space-y-2">
            <label className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5">
              <ListTodo className="h-3 w-3 text-blue-400" />
              <span>Checklist / Todos (Optional)</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Add a checklist step / todo..."
                value={quickSubtaskInput}
                onChange={(e) => setQuickSubtaskInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addQuickSubtask();
                  }
                }}
                className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500"
              />
              <button
                type="button"
                onClick={addQuickSubtask}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium cursor-pointer"
              >
                Add Todo
              </button>
            </div>
            {quickSubtasks.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {quickSubtasks.map((st, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700 text-xs text-slate-300"
                  >
                    <span>{st}</span>
                    <button
                      type="button"
                      onClick={() => removeQuickSubtask(i)}
                      className="text-slate-400 hover:text-rose-400"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
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
          No tasks found in this view. Click &quot;New Task&quot; above to create one.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTasks.map((t) => {
            const isDone = t.status === "DONE";
            const subtasks = t.subtasks || [];
            const completedSubtasks = subtasks.filter((s) => s.isDone).length;
            const isExpanded = !!expandedTaskIds[t.id];

            return (
              <div
                key={t.id}
                className={`rounded-xl border transition-all ${
                  isDone
                    ? "bg-slate-950/40 border-slate-800/60 opacity-65"
                    : "bg-slate-900/60 border-slate-800 hover:border-slate-700"
                }`}
              >
                {/* Main Task Row */}
                <div className="p-3 sm:p-4 flex items-center justify-between gap-2.5 sm:gap-4">
                  <div className="flex items-center gap-2.5 sm:gap-3.5 flex-1 min-w-0">
                    {/* Toggle Done Button */}
                    <button
                      onClick={() => handleToggleDone(t)}
                      className="shrink-0 text-slate-500 hover:text-blue-400 cursor-pointer transition-colors"
                      title={isDone ? "Mark as active" : "Mark as completed"}
                    >
                      {isDone ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                      ) : (
                        <Circle className="h-5 w-5 text-slate-400" />
                      )}
                    </button>

                    {/* Expand/Collapse Chevron for Subtasks */}
                    {subtasks.length > 0 ? (
                      <button
                        onClick={() => toggleExpandTask(t.id)}
                        className="text-slate-500 hover:text-slate-300 p-0.5 rounded cursor-pointer"
                        title={isExpanded ? "Collapse checklist" : "Expand checklist"}
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </button>
                    ) : (
                      <span className="w-1" />
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          onClick={() => openEditModal(t)}
                          className={`text-xs font-semibold cursor-pointer hover:text-blue-400 transition-colors ${
                            isDone ? "line-through text-slate-500" : "text-slate-100"
                          }`}
                        >
                          {t.title}
                        </span>

                        {t.status && t.status !== "TODO" && (
                          <span
                            className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${getStatusBadge(
                              t.status
                            )}`}
                          >
                            {t.status}
                          </span>
                        )}
                      </div>

                      {t.description && (
                        <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                          {t.description}
                        </p>
                      )}

                      <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] text-slate-500 font-mono mt-1 truncate">
                        {t.project && (
                          <span className="text-blue-400 flex items-center gap-1 shrink-0">
                            <FolderGit2 className="h-2.5 w-2.5" />
                            {t.project.name}
                          </span>
                        )}
                        <span>•</span>
                        <span className="flex items-center gap-1 shrink-0">
                          <Clock className="h-2.5 w-2.5" />
                          {t.estimatedMinutes}m est
                        </span>
                        {t.actualMinutes > 0 && (
                          <>
                            <span>•</span>
                            <span className="text-cyan-400 shrink-0">
                              {t.actualMinutes}m spent
                            </span>
                          </>
                        )}
                        {t.dueDate && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1 shrink-0 text-amber-400/80">
                              <Calendar className="h-2.5 w-2.5" />
                              Due {formatDate(t.dueDate)}
                            </span>
                          </>
                        )}
                        {subtasks.length > 0 && (
                          <>
                            <span>•</span>
                            <span
                              onClick={() => toggleExpandTask(t.id)}
                              className="text-indigo-400 flex items-center gap-1 shrink-0 cursor-pointer hover:underline"
                            >
                              <ListTodo className="h-2.5 w-2.5" />
                              {completedSubtasks}/{subtasks.length} todos
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions (Priority, Edit, Delete) */}
                  <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
                    <span
                      className={`text-[9px] sm:text-[10px] font-mono px-1.5 sm:px-2 py-0.5 rounded border ${getPriorityStyle(
                        t.priority
                      )}`}
                    >
                      {t.priority}
                    </span>

                    {/* Edit Task Button */}
                    <button
                      onClick={() => openEditModal(t)}
                      className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-blue-400 transition-colors cursor-pointer"
                      title="Edit task and checklist todos"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>

                    {/* Delete Task Button */}
                    <button
                      onClick={() => handleDelete(t.id)}
                      className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                      title="Delete task"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Inline Expanded Checklist / Todos Drawer */}
                {isExpanded && (
                  <div className="px-4 sm:px-6 pb-3 pt-1 border-t border-slate-800/60 bg-slate-950/30 space-y-2.5">
                    <div className="flex items-center justify-between text-[11px] font-medium text-slate-400 pt-1">
                      <div className="flex items-center gap-1.5">
                        <ListTodo className="h-3.5 w-3.5 text-blue-400" />
                        <span>Checklist Todos ({completedSubtasks}/{subtasks.length})</span>
                      </div>
                      <button
                        onClick={() => openEditModal(t)}
                        className="text-[10px] text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Edit3 className="h-2.5 w-2.5" />
                        Edit all
                      </button>
                    </div>

                    <div className="space-y-1.5">
                      {subtasks.map((s) => (
                        <div
                          key={s.id}
                          className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-slate-900/60 border border-slate-800/80 text-xs"
                        >
                          <button
                            onClick={() => handleToggleSubtaskInline(t.id, s)}
                            className="flex items-center gap-2 flex-1 text-left cursor-pointer"
                          >
                            {s.isDone ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                            ) : (
                              <Circle className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                            )}
                            <span
                              className={`${
                                s.isDone ? "line-through text-slate-500" : "text-slate-200"
                              }`}
                            >
                              {s.title}
                            </span>
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Quick Add Subtask Input */}
                    <div className="flex gap-2 pt-1">
                      <input
                        type="text"
                        placeholder="Add quick todo..."
                        value={inlineSubtaskInputs[t.id] || ""}
                        onChange={(e) =>
                          setInlineSubtaskInputs({
                            ...inlineSubtaskInputs,
                            [t.id]: e.target.value,
                          })
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddInlineSubtask(t.id);
                          }
                        }}
                        className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() => handleAddInlineSubtask(t.id)}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium cursor-pointer"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* EDIT TASK & TODOS MODAL */}
      {editingTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit3 className="h-4 w-4 text-blue-400" />
                <h2 className="text-base font-bold text-white">Edit Task & Todos</h2>
              </div>
              <button
                type="button"
                onClick={closeEditModal}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleSaveEdit} className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
              {/* Title */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">
                  Task Title <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="Task title..."
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Description / Notes</label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Additional context, notes, or instructions..."
                  rows={3}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Status, Priority & Project */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300">Status</label>
                  <select
                    value={editStatus}
                    onChange={(e: any) => setEditStatus(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                  >
                    <option value="TODO">To Do</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="DONE">Done</option>
                    <option value="BACKLOG">Backlog</option>
                    <option value="ARCHIVED">Archived</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300">Priority</label>
                  <select
                    value={editPriority}
                    onChange={(e: any) => setEditPriority(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300">Project</label>
                  <select
                    value={editProjectId}
                    onChange={(e) => setEditProjectId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                  >
                    <option value="">No Project (General)</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Duration & Due Date */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300">Estimated (minutes)</label>
                  <input
                    type="number"
                    min="5"
                    step="5"
                    value={editEstimatedMinutes}
                    onChange={(e) => setEditEstimatedMinutes(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300">Actual (minutes spent)</label>
                  <input
                    type="number"
                    min="0"
                    step="5"
                    value={editActualMinutes}
                    onChange={(e) => setEditActualMinutes(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300">Due Date & Time</label>
                  <input
                    type="datetime-local"
                    value={editDueDate}
                    onChange={(e) => setEditDueDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Subtasks / Todos Checklist Editor */}
              <div className="pt-3 border-t border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ListTodo className="h-4 w-4 text-blue-400" />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                      Checklist / Subtask Todos
                    </span>
                  </div>
                  {editSubtasks.filter((s) => !s._deleted).length > 0 && (
                    <span className="text-[11px] font-mono text-slate-400">
                      {editSubtasks.filter((s) => !s._deleted && s.isDone).length} of{" "}
                      {editSubtasks.filter((s) => !s._deleted).length} completed
                    </span>
                  )}
                </div>

                {/* Subtask list */}
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {editSubtasks.filter((s) => !s._deleted).length === 0 ? (
                    <div className="text-xs text-slate-500 py-2 italic text-center">
                      No checklist todos yet. Add one below!
                    </div>
                  ) : (
                    editSubtasks.map((st, index) => {
                      if (st._deleted) return null;
                      return (
                        <div
                          key={st.id || index}
                          className="flex items-center gap-2 p-2 rounded-xl bg-slate-950/60 border border-slate-800"
                        >
                          <button
                            type="button"
                            onClick={() => handleToggleModalSubtask(index)}
                            className="text-slate-500 hover:text-blue-400 cursor-pointer shrink-0"
                          >
                            {st.isDone ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                            ) : (
                              <Circle className="h-4 w-4 text-slate-500" />
                            )}
                          </button>

                          <input
                            type="text"
                            value={st.title}
                            onChange={(e) =>
                              handleUpdateModalSubtaskTitle(index, e.target.value)
                            }
                            className={`flex-1 bg-transparent text-xs text-slate-100 focus:outline-none ${
                              st.isDone ? "line-through text-slate-500" : ""
                            }`}
                            placeholder="Todo description..."
                          />

                          <button
                            type="button"
                            onClick={() => handleDeleteModalSubtask(index)}
                            className="p-1 text-slate-500 hover:text-rose-400 rounded transition-colors cursor-pointer shrink-0"
                            title="Delete todo"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Add new subtask row */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Add a checklist todo..."
                    value={newSubtaskTitle}
                    onChange={(e) => setNewSubtaskTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddModalSubtask();
                      }
                    }}
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddModalSubtask}
                    className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer"
                  >
                    + Add
                  </button>
                </div>
              </div>

              {/* Modal Actions Footer */}
              <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => handleDelete(editingTask.id)}
                  className="px-3 py-1.5 rounded-xl text-rose-400 hover:bg-rose-500/10 border border-rose-500/30 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Delete Task</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={closeEditModal}
                    className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!editTitle.trim() || isSavingEdit}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {isSavingEdit ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Save className="h-3.5 w-3.5" />
                        <span>Save Changes</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
