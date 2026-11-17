"use client";

import { offlineFetch } from "@/lib/offlineSync";

export interface TrackedProjectInput {
  name: string;
  description: string;
  color: string;
  targetDate?: string | null;
  milestones: { title: string; dueDate?: string | null }[];
  tasks?: { title: string; dueDate?: string | null; category?: string }[];
}

export interface ProjectSummary {
  id: string;
  name: string;
  status: string;
  progressPercent: number;
  staleDays?: number | null;
  nextAction?: { title: string; overdue: boolean; dueDate: string | null } | null;
  nextMilestone?: { title: string; dueDate: string | null; overdue: boolean } | null;
  totalTasks?: number;
  completedTasks?: number;
}

/** The user's projects as the Projects page sees them, so business pages show the same live numbers. */
export async function fetchProjects(): Promise<ProjectSummary[]> {
  const res = await offlineFetch("/api/projects", { cache: "no-store" });
  const data = await res.json();
  return data?.success ? (data.projects as ProjectSummary[]) : [];
}

/** Creates a project with dated milestones, then its tasks one by one. Returns the new project's id. */
export async function createTrackedProject(input: TrackedProjectInput, onProgress?: (done: number, total: number) => void): Promise<string> {
  const total = input.tasks?.length ?? 0;
  const res = await offlineFetch("/api/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: input.name,
      description: input.description,
      color: input.color,
      targetDate: input.targetDate ?? null,
      milestones: input.milestones.map((m) => ({ title: m.title, dueDate: m.dueDate ?? null })),
    }),
  });
  const data = await res.json();
  if (!data.success || !data.project?.id) throw new Error(data.error || "Could not create the project");
  const id = data.project.id as string;

  let done = 0;
  for (const t of input.tasks ?? []) {
    await offlineFetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: t.title, projectId: id, dueDate: t.dueDate ?? null, priority: "MEDIUM", estimatedMinutes: 60, category: t.category ?? "Business" }),
    });
    done++;
    onProgress?.(done, total);
  }
  return id;
}

/** Does a project name match a product? Word-boundary match on any alias, case-insensitive. */
export function projectMatches(projectName: string, aliases: string[]): boolean {
  const name = projectName.toLowerCase();
  return aliases.some((a) => new RegExp(`(^|[^a-z0-9])${a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`).test(name));
}
