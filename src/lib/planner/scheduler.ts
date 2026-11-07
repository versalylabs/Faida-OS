/**
 * Daily planner. Builds a day you can actually follow:
 *  - starts from *now* (never schedules into the past) and stops at the end of your working day
 *  - works around fixed commitments (calendar events and classes) and protects lunch
 *  - puts overdue and due-today work first, then by priority, then by what is due soonest
 *  - puts heavy work into your morning window and light work later
 *  - cuts long tasks into focused blocks with short breaks, and never plans beyond your focus budget
 * It is pure (all times are minutes since local midnight), so it is easy to test and reason about.
 */
import { priorityRank } from "@/lib/priority";

export interface PlanTask {
  id: string;
  title: string;
  priority: string;
  estimatedMinutes: number;
  energyCost: number; // 1-10
  dueDate?: string | null; // ISO
  projectName?: string | null;
}

export interface BusyBlock {
  title: string;
  startMin: number;
  endMin: number;
  kind: "EVENT" | "CLASS";
  location?: string | null;
}

export type SlotKind = "TASK" | "BREAK" | "EVENT" | "CLASS" | "LUNCH";

export interface PlanSlot {
  id: string;
  kind: SlotKind;
  taskId?: string;
  title: string;
  projectName?: string | null;
  startMin: number;
  endMin: number;
  priority?: string;
  why?: string;
  part?: { index: number; total: number };
  isLastPart?: boolean;
  location?: string | null;
}

export interface OverflowTask {
  task: PlanTask;
  reason: string;
}

export interface DayPlan {
  slots: PlanSlot[];
  overflow: OverflowTask[];
  notes: string[];
  focusMinutes: number;
  breakMinutes: number;
  commitmentMinutes: number;
  budgetMinutes: number;
  freeMinutesLeft: number;
  dayOver: boolean;
}

export interface PlanOptions {
  nowMin: number;
  endOfDayMs: number; // end of the local day, as an epoch instant
  budgetMinutes: number;
  dayStartMin?: number; // default 08:00
  dayEndMin?: number; // default 20:00
  lunchStartMin?: number; // default 13:00
  lunchEndMin?: number; // default 14:00
  startOverrideMin?: number | null;
}

const MIN_CHUNK = 25;
const MAX_CHUNK = 90;
const HEAVY = 6;
const MORNING_END = 14 * 60;

const roundUp5 = (m: number) => Math.ceil(m / 5) * 5;

interface Gap {
  start: number;
  end: number;
}

function subtract(gaps: Gap[], block: { start: number; end: number }): Gap[] {
  const out: Gap[] = [];
  for (const g of gaps) {
    if (block.end <= g.start || block.start >= g.end) {
      out.push(g);
      continue;
    }
    if (block.start > g.start) out.push({ start: g.start, end: block.start });
    if (block.end < g.end) out.push({ start: block.end, end: g.end });
  }
  return out;
}

export function formatClock(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = Math.round(min % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function buildDayPlan(tasks: PlanTask[], busy: BusyBlock[], opts: PlanOptions): DayPlan {
  const dayStart = opts.dayStartMin ?? 8 * 60;
  const dayEnd = opts.dayEndMin ?? 20 * 60;
  const lunchStart = opts.lunchStartMin ?? 13 * 60;
  const lunchEnd = opts.lunchEndMin ?? 14 * 60;
  const earliest = Math.max(opts.startOverrideMin ?? 0, dayStart, roundUp5(opts.nowMin));

  const notes: string[] = [];
  const slots: PlanSlot[] = [];
  const overflow: OverflowTask[] = [];

  // Fixed commitments still ahead of us today (shown on the timeline even if they started already)
  const commitments = busy
    .filter((b) => b.endMin > opts.nowMin && b.startMin < dayEnd + 240)
    .sort((a, b) => a.startMin - b.startMin);
  for (const b of commitments) {
    slots.push({
      id: `${b.kind}-${b.startMin}-${b.title}`,
      kind: b.kind,
      title: b.title,
      startMin: Math.max(b.startMin, 0),
      endMin: b.endMin,
      location: b.location,
    });
  }
  const commitmentMinutes = commitments.reduce((acc, b) => acc + Math.max(0, b.endMin - Math.max(b.startMin, earliest)), 0);

  const dayOver = earliest >= dayEnd - MIN_CHUNK;
  if (dayOver) {
    notes.push("The working day is nearly over. What is left will be waiting for you in tomorrow's plan.");
    const sorted = [...tasks].sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority));
    for (const task of sorted) overflow.push({ task, reason: "No working time left today" });
    return {
      slots: slots.sort((a, b) => a.startMin - b.startMin),
      overflow,
      notes,
      focusMinutes: 0,
      breakMinutes: 0,
      commitmentMinutes,
      budgetMinutes: opts.budgetMinutes,
      freeMinutesLeft: 0,
      dayOver: true,
    };
  }

  // Free gaps: the rest of the day minus commitments and lunch
  let gaps: Gap[] = [{ start: earliest, end: dayEnd }];
  for (const b of commitments) gaps = subtract(gaps, { start: b.startMin, end: b.endMin });
  if (lunchEnd > earliest) {
    gaps = subtract(gaps, { start: Math.max(lunchStart, earliest), end: lunchEnd });
    if (lunchStart >= earliest || opts.nowMin < lunchEnd) {
      slots.push({
        id: "lunch",
        kind: "LUNCH",
        title: "Lunch",
        startMin: Math.max(lunchStart, earliest),
        endMin: lunchEnd,
      });
    }
  }
  gaps = gaps.filter((g) => g.end - g.start >= 15).sort((a, b) => a.start - b.start);

  // Order: overdue / due today first, then priority, then soonest due, then the shorter task
  const isDueToday = (t: PlanTask) => (t.dueDate ? new Date(t.dueDate).getTime() < opts.endOfDayMs : false);
  const isOverdue = (t: PlanTask) => (t.dueDate ? new Date(t.dueDate).getTime() < opts.endOfDayMs - 86400000 : false);
  const ordered = [...tasks].sort((a, b) => {
    const rank = (t: PlanTask) => (isOverdue(t) ? 0 : isDueToday(t) ? 1 : 2);
    const dueA = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
    const dueB = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
    return (
      rank(a) - rank(b) ||
      priorityRank(a.priority) - priorityRank(b.priority) ||
      dueA - dueB ||
      a.estimatedMinutes - b.estimatedMinutes
    );
  });

  let focusUsed = 0;
  let breakUsed = 0;
  let chunkIdCounter = 0;

  for (const task of ordered) {
    let need = Math.min(Math.max(task.estimatedMinutes || 30, 5), 240);
    const heavy = task.energyCost >= HEAVY;
    const placedParts: PlanSlot[] = [];
    const parts = Math.max(1, Math.ceil(need / MAX_CHUNK));

    while (need > 0) {
      if (focusUsed >= opts.budgetMinutes) break;
      const wanted = Math.min(need, MAX_CHUNK, opts.budgetMinutes - focusUsed);
      const fits = (g: Gap) => g.end - g.start >= Math.min(wanted, MIN_CHUNK);
      // Heavy work goes to the morning window when there is one
      const preferred = heavy ? gaps.filter((g) => g.start < MORNING_END && fits(g)) : [];
      const gap = (preferred.length ? preferred : gaps.filter(fits))[0];
      if (!gap) break;

      const length = Math.min(wanted, gap.end - gap.start);
      const start = gap.start;
      const end = start + length;
      placedParts.push({
        id: `task-${task.id}-${chunkIdCounter++}`,
        kind: "TASK",
        taskId: task.id,
        title: task.title,
        projectName: task.projectName,
        startMin: start,
        endMin: end,
        priority: task.priority,
      });
      need -= length;
      focusUsed += length;

      // A short break after each block when there is room, a longer one after a long block
      const breakLen = length >= 60 ? 15 : length >= 40 ? 10 : 5;
      const after = end + breakLen;
      if (after < gap.end - 10) {
        slots.push({ id: `break-${start}`, kind: "BREAK", title: "Break", startMin: end, endMin: after });
        breakUsed += breakLen;
        gap.start = after;
      } else {
        gap.start = end;
      }
      gaps = gaps.filter((g) => g.end - g.start >= 15);
    }

    if (placedParts.length === 0) {
      overflow.push({
        task,
        reason: focusUsed >= opts.budgetMinutes ? "Beyond today's focus budget" : "No free block big enough today",
      });
      continue;
    }

    const placedMinutes = placedParts.reduce((acc, p) => acc + (p.endMin - p.startMin), 0);
    const requested = Math.min(Math.max(task.estimatedMinutes || 30, 5), 240);
    placedParts.forEach((p, i) => {
      const why: string[] = [];
      if (isOverdue(task)) why.push("Overdue");
      else if (isDueToday(task)) why.push("Due today");
      else if (task.priority === "URGENT") why.push("Urgent");
      if (heavy && p.startMin < MORNING_END) why.push("Heavy, so placed in your morning");
      if (placedParts.length > 1) p.part = { index: i + 1, total: Math.max(parts, placedParts.length) };
      p.isLastPart = i === placedParts.length - 1 && placedMinutes >= requested;
      p.why = why.join(" · ") || undefined;
      slots.push(p);
    });

    if (placedMinutes < requested) {
      overflow.push({
        task,
        reason: `Only ${placedMinutes} of ${requested} minutes fit today. The rest carries over.`,
      });
    }
  }

  slots.sort((a, b) => a.startMin - b.startMin || (a.kind === "BREAK" ? 1 : 0) - (b.kind === "BREAK" ? 1 : 0));

  // A break only makes sense between two blocks of work: drop any that is not followed by a task
  for (let i = slots.length - 1; i >= 0; i--) {
    if (slots[i].kind === "BREAK" && slots[i + 1]?.kind !== "TASK") slots.splice(i, 1);
  }

  const freeMinutesLeft = gaps.reduce((acc, g) => acc + (g.end - g.start), 0);

  if (overflow.some((o) => isDueToday(o.task))) {
    notes.push("Some things due today did not fit. Consider moving them to tomorrow, or raise your focus budget.");
  }
  if (commitments.length > 0) {
    notes.push(`Planned around ${commitments.length} fixed commitment${commitments.length === 1 ? "" : "s"} today.`);
  }

  return {
    slots,
    overflow,
    notes,
    focusMinutes: focusUsed,
    breakMinutes: breakUsed,
    commitmentMinutes,
    budgetMinutes: opts.budgetMinutes,
    freeMinutesLeft,
    dayOver: false,
  };
}
