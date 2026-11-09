import { priorityRank } from "@/lib/priority";

/**
 * "What should I do next on this project?" One answer, picked the same way everywhere
 * (project cards, the briefing), so the project hub and the dashboard never disagree.
 */

export interface NextTaskInput {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate?: Date | string | null;
  estimatedMinutes?: number | null;
  createdAt?: Date | string | null;
}

export interface NextMilestoneInput {
  id: string;
  title: string;
  isDone: boolean;
  order: number;
  dueDate?: Date | string | null;
}

export interface NextAction {
  id: string;
  title: string;
  priority: string;
  dueDate: string | null; // ISO
  overdue: boolean;
  inProgress: boolean;
  estimatedMinutes: number | null;
}

export interface NextMilestone {
  id: string;
  title: string;
  dueDate: string | null; // ISO
  overdue: boolean;
}

/** Statuses that are not something you can start on now. */
const NOT_ACTIONABLE = new Set(["DONE", "CANCELLED", "ARCHIVED", "BACKLOG", "BLOCKED"]);

const ms = (v: Date | string | null | undefined) => (v ? new Date(v).getTime() : Number.POSITIVE_INFINITY);

export function pickNextAction(tasks: NextTaskInput[], now: Date = new Date()): NextAction | null {
  const open = tasks.filter((t) => !NOT_ACTIONABLE.has(t.status));
  if (open.length === 0) return null;

  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const isOverdue = (t: NextTaskInput) => !!t.dueDate && new Date(t.dueDate).getTime() < startOfToday.getTime();

  // Overdue first, then work already started, then priority, then the soonest due date, then oldest.
  const best = [...open].sort(
    (a, b) =>
      Number(isOverdue(b)) - Number(isOverdue(a)) ||
      Number(b.status === "IN_PROGRESS") - Number(a.status === "IN_PROGRESS") ||
      priorityRank(a.priority) - priorityRank(b.priority) ||
      ms(a.dueDate) - ms(b.dueDate) ||
      ms(a.createdAt) - ms(b.createdAt)
  )[0];

  return {
    id: best.id,
    title: best.title,
    priority: best.priority,
    dueDate: best.dueDate ? new Date(best.dueDate).toISOString() : null,
    overdue: isOverdue(best),
    inProgress: best.status === "IN_PROGRESS",
    estimatedMinutes: best.estimatedMinutes ?? null,
  };
}

/** The next unfinished milestone: dated ones by date, then undated ones in their listed order. */
export function pickNextMilestone(milestones: NextMilestoneInput[], now: Date = new Date()): NextMilestone | null {
  const open = milestones.filter((m) => !m.isDone);
  if (open.length === 0) return null;
  const best = [...open].sort((a, b) => ms(a.dueDate) - ms(b.dueDate) || a.order - b.order)[0];
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  return {
    id: best.id,
    title: best.title,
    dueDate: best.dueDate ? new Date(best.dueDate).toISOString() : null,
    overdue: !!best.dueDate && new Date(best.dueDate).getTime() < startOfToday.getTime(),
  };
}
