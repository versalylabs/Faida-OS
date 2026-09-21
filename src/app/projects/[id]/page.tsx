"use client";

import { useState, useEffect, use } from "react";
import {
  FolderGit2,
  ArrowLeft,
  CheckCircle2,
  Circle,
  Plus,
  Clock,
  BookOpen,
  CheckSquare,
  Loader2,
  Calendar,
  Sparkles,
  ExternalLink,
  FileText,
  X,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { formatDate } from "@/lib/utils";

interface MilestoneItem {
  id: string;
  title: string;
  isDone: boolean;
  order: number;
}

interface TaskItem {
  id: string;
  title: string;
  priority: string;
  status: string;
  estimatedMinutes: number;
}

interface NoteItem {
  id: string;
  title: string;
  content: string;
  category?: string | null;
  tags?: string | null;
  createdAt?: string;
  updatedAt?: string;
  projectId?: string | null;
}

interface ProjectDetail {
  id: string;
  name: string;
  description?: string | null;
  status: string;
  progressPercent: number;
  color?: string | null;
  targetDate?: string | null;
  milestones: MilestoneItem[];
  tasks: TaskItem[];
}

export default function ProjectWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Quick inputs
  const [newMilestone, setNewMilestone] = useState("");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDuration, setNewTaskDuration] = useState("45");
  const [newTaskPriority, setNewTaskPriority] = useState("HIGH");
  const [isAddingTask, setIsAddingTask] = useState(false);

  // Quick Note inputs
  const [showAddNote, setShowAddNote] = useState(false);
  const [newNoteTitle, setNewNoteTitle] = useState("");
  const [newNoteCategory, setNewNoteCategory] = useState("Project Note");
  const [newNoteContent, setNewNoteContent] = useState("");
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [activeModalNote, setActiveModalNote] = useState<NoteItem | null>(null);

  const fetchWorkspace = async () => {
    try {
      const res = await fetch(`/api/projects/${id}`, { cache: "no-store" });
      const data = await res.json();
      if (data.success) {
        setProject(data.project);
        setNotes(data.notes || []);
      }
    } catch (e) {
      console.error("Failed to load workspace:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteTitle.trim() || isAddingNote) return;

    setIsAddingNote(true);
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newNoteTitle.trim(),
          content: newNoteContent.trim(),
          category: newNoteCategory.trim() || "Project Note",
          projectId: id,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setNewNoteTitle("");
        setNewNoteContent("");
        setShowAddNote(false);
        fetchWorkspace();
      }
    } catch (e) {
      console.error("Failed to add note:", e);
    } finally {
      setIsAddingNote(false);
    }
  };

  useEffect(() => {
    fetchWorkspace();
  }, [id]);

  const handleToggleMilestone = async (m: MilestoneItem) => {
    if (!project) return;
    const nextDone = !m.isDone;

    // Optimistic UI update
    const updatedMilestones = project.milestones.map((item) =>
      item.id === m.id ? { ...item, isDone: nextDone } : item
    );
    const doneCount = updatedMilestones.filter((item) => item.isDone).length;
    const newProgress = Math.round((doneCount / updatedMilestones.length) * 100);

    setProject({
      ...project,
      milestones: updatedMilestones,
      progressPercent: newProgress,
    });

    try {
      await fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          milestoneId: m.id,
          milestoneDone: nextDone,
        }),
      });
    } catch (e) {
      fetchWorkspace();
    }
  };

  const handleAddMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMilestone.trim()) return;

    try {
      await fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newMilestoneTitle: newMilestone.trim() }),
      });
      setNewMilestone("");
      fetchWorkspace();
    } catch (e) {
      console.error("Failed to add milestone:", e);
    }
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || isAddingTask) return;

    setIsAddingTask(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTaskTitle.trim(),
          projectId: id,
          priority: newTaskPriority,
          estimatedMinutes: parseInt(newTaskDuration, 10) || 30,
        }),
      });
      if (res.ok) {
        setNewTaskTitle("");
        fetchWorkspace();
      }
    } catch (e) {
      console.error("Failed to add task:", e);
    } finally {
      setIsAddingTask(false);
    }
  };

  const handleToggleTaskDone = async (task: TaskItem) => {
    const nextStatus = task.status === "DONE" ? "TODO" : "DONE";
    try {
      await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: task.id, status: nextStatus }),
      });
      fetchWorkspace();
    } catch (e) {
      console.error("Failed to update task:", e);
    }
  };

  if (isLoading) {
    return (
      <div className="py-24 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
        <span>Loading workspace...</span>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-24 space-y-3">
        <div className="text-sm text-slate-300">Project workspace not found</div>
        <Link href="/projects" className="text-xs text-blue-400 hover:underline">
          ← Back to Project Hub
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Navigation & Header */}
      <div className="space-y-4">
        <Link
          href="/projects"
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>All Projects</span>
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-blue-400 mb-1">
              <FolderGit2 className="h-3.5 w-3.5" />
              Project Workspace
            </div>
            <h1 className="text-2xl lg:text-3xl font-bold text-white flex items-center gap-3">
              <span
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: project.color || "#3b82f6" }}
              />
              {project.name}
            </h1>
            {project.description && (
              <p className="text-xs text-slate-400 mt-1 max-w-2xl">{project.description}</p>
            )}
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className="text-xs font-mono px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-semibold">
              {project.progressPercent}% Velocity
            </span>
          </div>
        </div>

        {/* Dynamic Progress Bar */}
        <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${project.progressPercent}%`,
              backgroundColor: project.color || "#3b82f6",
            }}
          />
        </div>
      </div>

      {/* 2-Column Layout: Left = Milestones & Tasks, Right = Connected Notes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Milestones & Execution */}
        <div className="lg:col-span-2 space-y-6">
          {/* Milestones Card */}
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Milestones Checklist
              </h2>
              <span className="text-[11px] font-mono text-slate-500">
                {project.milestones.filter((m) => m.isDone).length} of{" "}
                {project.milestones.length} completed
              </span>
            </div>

            <div className="space-y-2">
              {project.milestones.map((m) => (
                <button
                  key={m.id}
                  onClick={() => handleToggleMilestone(m)}
                  className="w-full p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 flex items-center gap-3 text-left transition-all cursor-pointer group"
                >
                  {m.isDone ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  ) : (
                    <Circle className="h-4 w-4 text-slate-600 group-hover:text-blue-400 shrink-0 transition-colors" />
                  )}
                  <span
                    className={`text-xs font-medium ${
                      m.isDone ? "line-through text-slate-500" : "text-slate-200"
                    }`}
                  >
                    {m.title}
                  </span>
                </button>
              ))}
            </div>

            {/* Add Milestone Form */}
            <form onSubmit={handleAddMilestone} className="flex gap-2 pt-2 border-t border-slate-800">
              <input
                type="text"
                placeholder="Add new milestone..."
                value={newMilestone}
                onChange={(e) => setNewMilestone(e.target.value)}
                className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500"
              />
              <button
                type="submit"
                disabled={!newMilestone.trim()}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-blue-600 text-slate-300 hover:text-white text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
              >
                Add
              </button>
            </form>
          </div>

          {/* Project Tasks Card */}
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Workspace Tasks ({project.tasks.length})
              </h2>
            </div>

            <div className="space-y-2">
              {project.tasks.length === 0 ? (
                <div className="text-xs text-slate-500 text-center py-4">
                  No tasks assigned to {project.name} yet.
                </div>
              ) : (
                project.tasks.map((task) => {
                  const isDone = task.status === "DONE";
                  return (
                    <div
                      key={task.id}
                      className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleToggleTaskDone(task)}
                          className="text-slate-500 hover:text-blue-400 cursor-pointer"
                        >
                          {isDone ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                          ) : (
                            <Circle className="h-4 w-4" />
                          )}
                        </button>
                        <span
                          className={`text-xs ${
                            isDone ? "line-through text-slate-500" : "text-slate-200 font-medium"
                          }`}
                        >
                          {task.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 font-mono text-[10px] text-slate-500">
                        <span>{task.estimatedMinutes}m</span>
                        <span className="text-amber-400">[{task.priority}]</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Quick Add Task to Project */}
            <form onSubmit={handleAddTask} className="flex gap-2 pt-2 border-t border-slate-800">
              <input
                type="text"
                placeholder="New task for this project..."
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500"
              />
              <select
                value={newTaskPriority}
                onChange={(e) => setNewTaskPriority(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-xl px-2 py-1.5 text-xs text-slate-300 focus:outline-none"
              >
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="URGENT">Urgent</option>
              </select>
              <button
                type="submit"
                disabled={!newTaskTitle.trim() || isAddingTask}
                className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                Add
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Connected Knowledge & Documentation */}
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-blue-400" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Connected Notes ({notes.length})
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowAddNote(!showAddNote)}
                  className="flex items-center gap-1 text-[11px] font-medium text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 px-2.5 py-1 rounded-lg border border-blue-500/20 transition-all cursor-pointer"
                >
                  <Plus className="h-3 w-3" />
                  <span>Note</span>
                </button>
                <Link
                  href={`/notes?projectId=${id}`}
                  className="flex items-center gap-1 text-[11px] font-medium text-slate-400 hover:text-slate-200 bg-slate-800/60 hover:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700/60 transition-all"
                  title="Open Notes Hub filtered by this project"
                >
                  <span>All</span>
                  <ExternalLink className="h-2.5 w-2.5" />
                </Link>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              Notes and knowledge records linked to <strong>{project.name}</strong>.
            </p>

            {/* Quick Add Note Form */}
            {showAddNote && (
              <form
                onSubmit={handleAddNote}
                className="p-3.5 rounded-xl bg-slate-950 border border-blue-500/30 space-y-3 animate-in fade-in duration-200"
              >
                <div className="flex items-center justify-between text-xs font-semibold text-slate-200">
                  <span>Add Note to {project.name}</span>
                  <button
                    type="button"
                    onClick={() => setShowAddNote(false)}
                    className="text-slate-500 hover:text-slate-300"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="Note Title..."
                  value={newNoteTitle}
                  onChange={(e) => setNewNoteTitle(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                  required
                />
                <input
                  type="text"
                  placeholder="Category (e.g. Architecture, Specs, Meeting)..."
                  value={newNoteCategory}
                  onChange={(e) => setNewNoteCategory(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                />
                <textarea
                  placeholder="Note content, ideas, code snippets, or decisions..."
                  value={newNoteContent}
                  onChange={(e) => setNewNoteContent(e.target.value)}
                  rows={3}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500 resize-none"
                />
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowAddNote(false)}
                    className="px-3 py-1 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!newNoteTitle.trim() || isAddingNote}
                    className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {isAddingNote && <Loader2 className="h-3 w-3 animate-spin" />}
                    <span>Save Note</span>
                  </button>
                </div>
              </form>
            )}

            {notes.length === 0 ? (
              <div className="p-5 rounded-xl bg-slate-950 border border-slate-800/80 text-center space-y-2">
                <FileText className="h-6 w-6 text-slate-600 mx-auto" />
                <p className="text-xs text-slate-400">No notes linked to this project yet.</p>
                <button
                  type="button"
                  onClick={() => setShowAddNote(true)}
                  className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 font-medium cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Create first note</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {notes.map((note) => (
                  <div
                    key={note.id}
                    onClick={() => setActiveModalNote(note)}
                    className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/90 hover:border-slate-700 hover:bg-slate-950 transition-all cursor-pointer group space-y-2"
                  >
                    <div className="flex items-center justify-between text-[10px] font-mono text-blue-400">
                      <span className="px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20">
                        {note.category || "General"}
                      </span>
                      {note.updatedAt && (
                        <span className="text-slate-500 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDate(note.updatedAt)}
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-bold text-slate-100 group-hover:text-blue-300 transition-colors flex items-center justify-between">
                      <span>{note.title}</span>
                      <ChevronRight className="h-3.5 w-3.5 text-slate-600 group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all" />
                    </div>
                    <p className="text-[11px] text-slate-400 line-clamp-3 leading-relaxed whitespace-pre-wrap">
                      {note.content}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Note Detail Modal */}
      {activeModalNote && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-150 max-h-[85vh] flex flex-col">
            <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <div className="flex items-center gap-2 text-[10px] font-mono text-blue-400 mb-1">
                  <span className="px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20">
                    {activeModalNote.category || "General"}
                  </span>
                  {activeModalNote.updatedAt && (
                    <span className="text-slate-500">
                      Updated {formatDate(activeModalNote.updatedAt)}
                    </span>
                  )}
                </div>
                <h3 className="text-base font-bold text-white leading-tight">
                  {activeModalNote.title}
                </h3>
              </div>
              <button
                onClick={() => setActiveModalNote(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-1">
              <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">
                {activeModalNote.content || "No content."}
              </p>
            </div>

            <div className="border-t border-slate-800 pt-3 flex items-center justify-between gap-3">
              <Link
                href={`/notes?projectId=${id}`}
                className="text-xs text-blue-400 hover:underline flex items-center gap-1 font-medium"
              >
                <span>Edit in Notes Hub</span>
                <ExternalLink className="h-3 w-3" />
              </Link>
              <button
                onClick={() => setActiveModalNote(null)}
                className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
