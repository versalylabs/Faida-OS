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
} from "lucide-react";
import Link from "next/link";
import { formatDate } from "@/lib/utils";

interface MilestoneItem {
  id: string;
  title: string;
  isDone: boolean;
  order: number;
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
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // New Project Form
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [milestonesText, setMilestonesText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchProjects = async () => {
    try {
      const res = await fetch("/api/projects");
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
    const milestones = milestonesText
      .split("\n")
      .map((m) => m.trim())
      .filter((m) => m.length > 0);

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description,
          targetDate: targetDate || null,
          milestones,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setName("");
        setDescription("");
        setTargetDate("");
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
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-500/20 cursor-pointer transition-all shrink-0"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>New Project</span>
        </button>
      </div>

      {/* Create Project Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-4 shadow-2xl">
            <h2 className="text-sm font-bold text-white">Create New Project Workspace</h2>
            <form onSubmit={handleCreateProject} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 block mb-1 font-medium">Project Name</label>
                <input
                  type="text"
                  placeholder="e.g. Melio, Personal Portfolio, Mobile App"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500"
                  autoFocus
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

              <div>
                <label className="text-slate-300 block mb-1 font-medium">Target Completion Date (Optional)</label>
                <input
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                />
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
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-slate-200"
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

      {/* Projects Grid */}
      {isLoading ? (
        <div className="py-16 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
          <span>Loading project workspaces...</span>
        </div>
      ) : projects.length === 0 ? (
        <div className="py-16 text-center text-xs text-slate-500 p-8 rounded-2xl bg-slate-900/40 border border-slate-800">
          No projects created yet. Click &quot;New Project&quot; above to initialize your first workspace.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {projects.map((proj) => (
            <div
              key={proj.id}
              className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 space-y-5 transition-all flex flex-col justify-between"
            >
              <div className="space-y-4">
                {/* Title & Progress Header */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: proj.color || "#3b82f6" }}
                      />
                      {proj.name}
                    </h2>
                    {proj.description && (
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                        {proj.description}
                      </p>
                    )}
                  </div>
                  <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 shrink-0">
                    {proj.progressPercent}%
                  </span>
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

                {/* Milestones Preview */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    <span>Milestones</span>
                    <span className="font-mono">
                      {proj.completedMilestones}/{proj.totalMilestones}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {proj.milestones.slice(0, 3).map((m) => (
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
                    ))}
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
      )}
    </div>
  );
}
