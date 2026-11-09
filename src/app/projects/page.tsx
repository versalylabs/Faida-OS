"use client";

import { useState, useEffect } from "react";
import {
  FolderGit2,
  Plus,
  CheckCircle2,
  Circle,
  ArrowRight,
  Clock,
  CheckSquare,
  Loader2,
  Calendar,
  Edit3,
  Trash2,
  X,
  Search,
  AlertCircle,
  Check,
} from "lucide-react";
import Link from "next/link";
import { formatDate } from "@/lib/utils";
import { dueDay, daysUntil, dueLabel } from "@/lib/dueDay";
import { PROJECT_TEMPLATES, spreadDueDates } from "@/lib/projectTemplates";

import { offlineFetch } from "@/lib/offlineSync";
interface MilestoneItem {
  id: string;
  title: string;
  isDone: boolean;
  order: number;
  dueDate?: string | null;
}

interface ProjectItem {
  id: string;
  name: string;
  description?: string | null;
  status: string;
  progressPercent: number;
  targetDate?: string | null;
  color?: string | null;
  totalTasks: number;
  completedTasks: number;
  totalMilestones: number;
  completedMilestones: number;
  milestones: MilestoneItem[];
  staleDays?: number | null;
  nextAction?: { id: string; title: string; priority: string; dueDate: string | null; overdue: boolean; inProgress: boolean } | null;
  nextMilestone?: { id: string; title: string; dueDate: string | null; overdue: boolean } | null;
}

const COLOR_PRESETS = [
  { label: "Blue", value: "#3b82f6" },
  { label: "Emerald", value: "#10b981" },
  { label: "Purple", value: "#8b5cf6" },
  { label: "Amber", value: "#f59e0b" },
  { label: "Pink", value: "#ec4899" },
  { label: "Cyan", value: "#06b6d4" },
];

const STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Active" },
  { value: "PLANNING", label: "Planning" },
  { value: "PAUSED", label: "Paused" },
  { value: "COMPLETED", label: "Completed" },
];

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [view, setView] = useState<"cards" | "roadmap">("cards");

  // Create Project Form
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [color, setColor] = useState("#3b82f6");
  const [status, setStatus] = useState("ACTIVE");
  const [milestonesText, setMilestonesText] = useState("");
  const [spreadDates, setSpreadDates] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit Project Form
  const [editingProject, setEditingProject] = useState<ProjectItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editStatus, setEditStatus] = useState("ACTIVE");
  const [editColor, setEditColor] = useState("#3b82f6");
  const [editTargetDate, setEditTargetDate] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  // Delete Project Confirmation
  const [deleteConfirmProject, setDeleteConfirmProject] = useState<ProjectItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchProjects = async () => {
    try {
      const res = await offlineFetch("/api/projects", { cache: "no-store" });
      const data = await res.json();
      if (data.success) {
        setProjects(data.projects);
      }
    } catch (e) {
      console.error("Failed to load projects:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isSubmitting) return;

    setIsSubmitting(true);
    const titles = milestonesText
      .split("\n")
      .map((m) => m.trim())
      .filter((m) => m.length > 0);
    // With a target date, spread the milestones evenly between today and that date.
    const dates = spreadDates && targetDate ? spreadDueDates(titles.length, targetDate) : titles.map(() => null);
    const milestones = titles.map((title, i) => ({ title, dueDate: dates[i] }));

    try {
      const res = await offlineFetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          color,
          status,
          targetDate: targetDate || null,
          milestones,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setName("");
        setDescription("");
        setTargetDate("");
        setColor("#3b82f6");
        setStatus("ACTIVE");
        setMilestonesText("");
        setShowCreateModal(false);
        fetchProjects();
      }
    } catch (e) {
      console.error("Failed to create project:", e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditProject = (proj: ProjectItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingProject(proj);
    setEditName(proj.name);
    setEditDescription(proj.description || "");
    setEditStatus(proj.status || "ACTIVE");
    setEditColor(proj.color || "#3b82f6");
    setEditTargetDate(
      proj.targetDate ? new Date(proj.targetDate).toISOString().split("T")[0] : ""
    );
  };

  const handleUpdateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProject || !editName.trim() || isUpdating) return;

    setIsUpdating(true);
    try {
      const res = await offlineFetch(`/api/projects/${editingProject.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          description: editDescription.trim() || null,
          status: editStatus,
          color: editColor,
          targetDate: editTargetDate || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setEditingProject(null);
        fetchProjects();
      }
    } catch (e) {
      console.error("Failed to update project:", e);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteProject = async () => {
    if (!deleteConfirmProject || isDeleting) return;

    setIsDeleting(true);
    try {
      const res = await offlineFetch(`/api/projects/${deleteConfirmProject.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        setDeleteConfirmProject(null);
        fetchProjects();
      }
    } catch (e) {
      console.error("Failed to delete project:", e);
    } finally {
      setIsDeleting(false);
    }
  };

  const getStatusBadge = (s: string) => {
    switch (s) {
      case "ACTIVE":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case "PLANNING":
        return "bg-blue-500/10 text-blue-400 border-blue-500/20";
      case "PAUSED":
        return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      case "COMPLETED":
        return "bg-purple-500/10 text-purple-400 border-purple-500/20";
      default:
        return "bg-slate-800 text-slate-300 border-slate-700";
    }
  };

  const filteredProjects = projects.filter((p) => {
    if (statusFilter !== "ALL" && p.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = p.name.toLowerCase().includes(q);
      const matchDesc = p.description?.toLowerCase().includes(q);
      return matchName || matchDesc;
    }
    return true;
  });

  // Roadmap: every unfinished milestone and project deadline across the projects shown, soonest first.
  interface RoadmapRow {
    key: string;
    project: ProjectItem;
    title: string;
    day: string;
    kind: "milestone" | "deadline";
  }
  const roadmapRows: RoadmapRow[] = [];
  const undatedMilestones: { key: string; project: ProjectItem; title: string }[] = [];
  for (const p of filteredProjects) {
    if (p.status === "COMPLETED") continue;
    for (const m of p.milestones) {
      if (m.isDone) continue;
      if (m.dueDate) roadmapRows.push({ key: `m-${m.id}`, project: p, title: m.title, day: dueDay(m.dueDate), kind: "milestone" });
      else undatedMilestones.push({ key: `u-${m.id}`, project: p, title: m.title });
    }
    if (p.targetDate) roadmapRows.push({ key: `d-${p.id}`, project: p, title: "Project deadline", day: dueDay(p.targetDate), kind: "deadline" });
  }
  roadmapRows.sort((a, b) => a.day.localeCompare(b.day));
  const roadmapGroups = [
    { key: "overdue", label: "Overdue", tone: "text-rose-400", rows: roadmapRows.filter((r) => daysUntil(r.day) < 0) },
    { key: "week", label: "Next 7 days", tone: "text-amber-400", rows: roadmapRows.filter((r) => daysUntil(r.day) >= 0 && daysUntil(r.day) <= 7) },
    { key: "month", label: "Next 30 days", tone: "text-blue-400", rows: roadmapRows.filter((r) => daysUntil(r.day) > 7 && daysUntil(r.day) <= 30) },
    { key: "later", label: "Later", tone: "text-slate-300", rows: roadmapRows.filter((r) => daysUntil(r.day) > 30) },
  ].filter((g) => g.rows.length > 0);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-blue-400 font-mono tracking-wider uppercase mb-1">
            <FolderGit2 className="h-3.5 w-3.5" />
            Workspace Hub
          </div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-white">
            Project Workspaces
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Holistic project management linking milestones, execution tasks, and knowledge notes.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-500/10 cursor-pointer transition-all shrink-0"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>New Project</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search projects by name or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900/80 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Status Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            {["ALL", "ACTIVE", "PLANNING", "PAUSED", "COMPLETED"].map((tab) => {
              const count =
                tab === "ALL"
                  ? projects.length
                  : projects.filter((p) => p.status === tab).length;

              return (
                <button
                  key={tab}
                  onClick={() => setStatusFilter(tab)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
                    statusFilter === tab
                      ? "bg-blue-600 text-white shadow-md shadow-blue-500/10 font-semibold"
                      : "bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-slate-800"
                  }`}
                >
                  {tab === "ALL" ? "All" : tab.charAt(0) + tab.slice(1).toLowerCase()} ({count})
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* View switch */}
      <div className="flex items-center gap-1.5 text-xs">
        {([
          { id: "cards", label: "Projects", Icon: FolderGit2 },
          { id: "roadmap", label: "Roadmap", Icon: Calendar },
        ] as const).map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setView(id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
              view === id
                ? "bg-blue-600 text-white shadow-md shadow-blue-500/10 font-semibold"
                : "bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-slate-800"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* Roadmap: all deadlines across projects */}
      {view === "roadmap" && !isLoading && (
        <div className="space-y-4">
          {roadmapGroups.length === 0 && undatedMilestones.length === 0 ? (
            <div className="py-16 text-center text-xs text-slate-500 p-8 rounded-2xl bg-slate-900/40 border border-slate-800">
              Nothing on the roadmap yet. Give milestones a due date in a project workspace and they will appear here.
            </div>
          ) : (
            <>
              {roadmapGroups.map((g) => (
                <div key={g.key} className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2.5">
                  <h2 className={`text-xs font-bold uppercase tracking-wider ${g.tone}`}>
                    {g.label} <span className="font-mono text-slate-500">({g.rows.length})</span>
                  </h2>
                  <div className="space-y-2">
                    {g.rows.map((r) => (
                      <Link
                        key={r.key}
                        href={`/projects/${r.project.id}`}
                        className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 flex items-center justify-between gap-3 transition-all"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span
                            className="h-2.5 w-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: r.project.color || "#3b82f6" }}
                          />
                          <div className="min-w-0">
                            <div className="text-xs font-medium text-slate-200 break-words">{r.title}</div>
                            <div className="text-[11px] text-slate-500 truncate">
                              {r.project.name}
                              {r.kind === "deadline" ? " · project" : " · milestone"}
                            </div>
                          </div>
                        </div>
                        <span
                          className={`shrink-0 flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                            daysUntil(r.day) < 0
                              ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                              : daysUntil(r.day) <= 3
                              ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                              : "bg-slate-800/80 text-slate-400 border-slate-700"
                          }`}
                        >
                          <Calendar className="h-2.5 w-2.5" />
                          {dueLabel(r.day)}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}

              {undatedMilestones.length > 0 && (
                <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2.5">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    No date set <span className="font-mono text-slate-500">({undatedMilestones.length})</span>
                  </h2>
                  <div className="space-y-2">
                    {undatedMilestones.map((r) => (
                      <Link
                        key={r.key}
                        href={`/projects/${r.project.id}`}
                        className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 flex items-center gap-3 transition-all"
                      >
                        <span
                          className="h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: r.project.color || "#3b82f6" }}
                        />
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-slate-200 break-words">{r.title}</div>
                          <div className="text-[11px] text-slate-500 truncate">{r.project.name} · milestone</div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Projects Grid */}
      {view === "cards" && (isLoading ? (
        <div className="py-16 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
          <span>Loading project workspaces...</span>
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="py-16 text-center text-xs text-slate-500 p-8 rounded-2xl bg-slate-900/40 border border-slate-800">
          No projects found matching your criteria. Click &quot;New Project&quot; above to initialize a workspace.
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,19rem),1fr))] gap-6">
          {filteredProjects.map((proj) => (
            <div
              key={proj.id}
              className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 space-y-5 transition-all flex flex-col justify-between group/card"
            >
              <div className="space-y-4">
                {/* Title, Actions & Progress Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex items-start gap-2 min-w-0">
                      <span
                        className="h-2.5 w-2.5 rounded-full shrink-0 mt-2"
                        style={{ backgroundColor: proj.color || "#3b82f6" }}
                      />
                      <h2 className="text-lg font-bold text-slate-100 group-hover/card:text-blue-400 transition-colors break-words min-w-0 leading-snug">
                        {proj.name}
                      </h2>
                    </div>
                    <span
                      className={`inline-block text-[10px] font-mono uppercase px-2 py-0.5 rounded-full border ${getStatusBadge(
                        proj.status
                      )}`}
                    >
                      {proj.status}
                    </span>

                    {proj.description && (
                      <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">
                        {proj.description}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-semibold">
                      {proj.progressPercent}%
                    </span>
                    <button
                      onClick={(e) => openEditProject(proj, e)}
                      title="Edit Project"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirmProject(proj);
                      }}
                      title="Delete Project"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${proj.progressPercent}%`,
                      backgroundColor: proj.color || "#3b82f6",
                    }}
                  />
                </div>

                {proj.staleDays != null && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    <span>
                      <strong className="font-semibold">Stalled:</strong> no progress in {proj.staleDays} days. Do the next
                      action, or pause the project if it is on hold.
                    </span>
                  </div>
                )}

                {/* Next action */}
                <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/15 space-y-1">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-blue-300">
                    <ArrowRight className="h-3 w-3" />
                    <span>Next action</span>
                  </div>
                  {proj.nextAction ? (
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-medium text-slate-100 break-words min-w-0">
                        {proj.nextAction.title}
                      </span>
                      <span
                        className={`shrink-0 text-[10px] font-mono ${
                          proj.nextAction.overdue ? "text-rose-400" : "text-slate-400"
                        }`}
                      >
                        {proj.nextAction.overdue
                          ? "overdue"
                          : proj.nextAction.inProgress
                          ? "in progress"
                          : proj.nextAction.dueDate
                          ? `due ${formatDate(proj.nextAction.dueDate)}`
                          : ""}
                      </span>
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-500 italic">
                      {proj.status === "COMPLETED"
                        ? "Project completed."
                        : "No open tasks. Open the workspace to add the next step."}
                    </div>
                  )}
                  {proj.nextMilestone && (
                    <div className="text-[11px] text-slate-400 break-words">
                      Milestone: {proj.nextMilestone.title}
                      {proj.nextMilestone.dueDate && (
                        <span className={proj.nextMilestone.overdue ? "text-rose-400" : ""}>
                          {" "}
                          · {proj.nextMilestone.overdue ? "overdue since" : "due"}{" "}
                          {formatDate(proj.nextMilestone.dueDate)}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Milestones Preview */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    <span>Milestones</span>
                    <span className="font-mono">
                      {proj.completedMilestones}/{proj.totalMilestones}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {proj.milestones.length === 0 ? (
                      <div className="text-[11px] text-slate-500 italic">No milestones defined</div>
                    ) : (
                      proj.milestones.slice(0, 3).map((m) => (
                        <div key={m.id} className="flex items-center gap-2 text-xs text-slate-300">
                          {m.isDone ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                          ) : (
                            <Circle className="h-3.5 w-3.5 text-slate-600 shrink-0" />
                          )}
                          <span className={`truncate ${m.isDone ? "line-through text-slate-500" : ""}`}>
                            {m.title}
                          </span>
                        </div>
                      ))
                    )}
                    {proj.milestones.length > 3 && (
                      <div className="text-[11px] text-slate-500 font-mono pl-5">
                        +{proj.milestones.length - 3} more milestones
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer Meta & Action */}
              <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs">
                <div className="flex items-center gap-3 text-slate-400 font-mono text-[11px]">
                  <span className="flex items-center gap-1">
                    <CheckSquare className="h-3 w-3" />
                    {proj.completedTasks}/{proj.totalTasks} tasks
                  </span>
                  {proj.targetDate && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Due {formatDate(proj.targetDate)}
                    </span>
                  )}
                </div>
                <Link
                  href={`/projects/${proj.id}`}
                  className="flex items-center gap-1 text-blue-400 hover:text-blue-300 font-semibold transition-colors"
                >
                  <span>Open Workspace</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      ))}

      {/* CREATE PROJECT MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 modal-overlay z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Plus className="h-4 w-4 text-blue-400" />
                Create New Project Workspace
              </h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateProject} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 block mb-1.5 font-medium">Start from a template</label>
                <div className="flex flex-wrap gap-1.5">
                  {PROJECT_TEMPLATES.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setMilestonesText(t.milestones.join("\n"));
                        if (!description.trim()) setDescription(t.description);
                        if (!name.trim()) setName(t.label);
                      }}
                      className="px-2.5 py-1 rounded-lg border border-slate-700 bg-slate-950 text-slate-300 hover:text-white hover:border-blue-500/60 hover:bg-blue-500/10 transition-colors cursor-pointer"
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-slate-300 block mb-1 font-medium">Project Name</label>
                <input
                  type="text"
                  placeholder="e.g. Versaly Website + Admin, Mobile App, Portfolio"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500"
                  autoFocus
                  required
                />
              </div>

              <div>
                <label className="text-slate-300 block mb-1 font-medium">Description</label>
                <input
                  type="text"
                  placeholder="Brief summary of project objectives"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 block mb-1 font-medium">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                  >
                    {STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-slate-300 block mb-1 font-medium">Target Date</label>
                  <input
                    type="date"
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-300 block mb-1.5 font-medium">Workspace Color</label>
                <div className="flex items-center gap-2">
                  {COLOR_PRESETS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setColor(c.value)}
                      className={`h-7 w-7 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                        color === c.value
                          ? "ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-110"
                          : "opacity-70 hover:opacity-100"
                      }`}
                      style={{ backgroundColor: c.value }}
                      title={c.label}
                    >
                      {color === c.value && <Check className="h-3.5 w-3.5 text-white" />}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-slate-300 block mb-1 font-medium">
                  Milestones (One per line)
                </label>
                <textarea
                  rows={3}
                  placeholder="Core development&#10;Functional testing&#10;Production deployment"
                  value={milestonesText}
                  onChange={(e) => setMilestonesText(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500"
                />
                {targetDate && milestonesText.trim() && (
                  <label className="mt-2 flex items-center gap-2 text-[11px] text-slate-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={spreadDates}
                      onChange={(e) => setSpreadDates(e.target.checked)}
                      className="accent-blue-500"
                    />
                    <span>Spread milestone due dates evenly up to the target date</span>
                  </label>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!name.trim() || isSubmitting}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? "Creating..." : "Create Workspace"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT PROJECT MODAL */}
      {editingProject && (
        <div className="fixed inset-0 modal-overlay z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Edit3 className="h-4 w-4 text-blue-400" />
                Edit Project: {editingProject.name}
              </h2>
              <button
                onClick={() => setEditingProject(null)}
                className="text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateProject} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 block mb-1 font-medium">Project Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                  autoFocus
                  required
                />
              </div>

              <div>
                <label className="text-slate-300 block mb-1 font-medium">Description</label>
                <input
                  type="text"
                  placeholder="Brief summary of project objectives"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 block mb-1 font-medium">Status</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                  >
                    {STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-slate-300 block mb-1 font-medium">Target Date</label>
                  <input
                    type="date"
                    value={editTargetDate}
                    onChange={(e) => setEditTargetDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-300 block mb-1.5 font-medium">Workspace Color</label>
                <div className="flex items-center gap-2">
                  {COLOR_PRESETS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setEditColor(c.value)}
                      className={`h-7 w-7 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                        editColor === c.value
                          ? "ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-110"
                          : "opacity-70 hover:opacity-100"
                      }`}
                      style={{ backgroundColor: c.value }}
                      title={c.label}
                    >
                      {editColor === c.value && <Check className="h-3.5 w-3.5 text-white" />}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingProject(null)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!editName.trim() || isUpdating}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold disabled:opacity-50 cursor-pointer"
                >
                  {isUpdating ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE PROJECT CONFIRMATION MODAL */}
      {deleteConfirmProject && (
        <div className="fixed inset-0 modal-overlay z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <h3 className="text-sm font-bold text-white">Delete Project Workspace?</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to delete <strong className="text-white">&quot;{deleteConfirmProject.name}&quot;</strong>?
            </p>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Tasks and knowledge notes attached to this project will be unlinked and preserved as standalone items. Milestones will be deleted.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setDeleteConfirmProject(null)}
                className="px-3.5 py-1.5 rounded-xl text-slate-400 hover:text-slate-200 text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteProject}
                disabled={isDeleting}
                className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? "Deleting..." : "Delete Project"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
