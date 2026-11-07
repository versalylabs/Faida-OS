/**
 * Lazy Mode ("Effort Engine") logic. It is pure, so the server uses it for the first answer and the
 * page re-runs it locally whenever the energy slider moves: no network round trip per tick.
 *
 * Goal: spend as little energy as possible while the important things still get done.
 *  - "Essential" = urgent, or due today / overdue. Everything else can wait on a low-energy day.
 *  - The next task is chosen to fit the energy you have right now, never the one that would drain you.
 *  - A task too heavy for your energy is offered as a 15-minute sprint, not as the whole thing.
 */
import { priorityRank } from "@/lib/priority";

export type EffortAction = "SKIP" | "AUTOMATE" | "OPTIMIZE" | "JUST_DO_IT";

export interface RawEffortTask {
  id: string;
  title: string;
  projectName?: string | null;
  estimatedMinutes: number;
  priority: string;
  isAcademic: boolean;
  dueDate?: string | null; // ISO
}

export interface EvaluatedEffortTask {
  id: string;
  title: string;
  projectName?: string | null;
  estimatedMinutes: number;
  priority: string;
  dueDate?: string | null;
  energyCost: number; // 1 to 10
  action: EffortAction;
  actionReason: string;
  essential: boolean;
}

/** Typical energy by hour of the day (0-23, in the user's own time). Used until your own check-ins say otherwise. */
export function estimateEnergy(hour: number): number {
  if (hour >= 6 && hour < 12) return 85;
  if (hour >= 12 && hour < 15) return 65;
  if (hour >= 15 && hour < 19) return 45;
  if (hour >= 19 && hour < 23) return 30;
  return 15;
}

/** How heavy a task feels, 1 (effortless) to 10 (drains the day), from its wording and length. */
export function calculateEnergyCost(title: string, durationMinutes: number): number {
  const lower = title.toLowerCase();
  let baseCost = 4;

  if (/(architecture|design|debug|complex|security|deploy|exam|assignment|proposal|report|write|essay|project)/.test(lower)) baseCost = 8;
  else if (/(study|learn|test|refactor|implement|revise|research|plan)/.test(lower)) baseCost = 6;
  else if (/(doc|update|setup|configure|format)/.test(lower)) baseCost = 3;
  else if (/(check|reply|clean|review|organi[sz]e|shopping|buy|call|pay|send|book|print)/.test(lower)) baseCost = 1;

  if (durationMinutes >= 90) baseCost += 2;
  else if (durationMinutes >= 60) baseCost += 1;
  else if (durationMinutes <= 15) baseCost = Math.max(1, baseCost - 1);

  return Math.min(10, Math.max(1, baseCost));
}

/** The heaviest task (1-10) that fits your energy right now. */
export function capacityFor(energy: number): number {
  return Math.max(2, Math.round(energy / 10));
}

/** Urgent, or due by the end of today (overdue included). */
export function isEssential(t: Pick<RawEffortTask, "priority" | "dueDate">, endOfDayMs: number): boolean {
  if (t.priority === "URGENT") return true;
  if (!t.dueDate) return false;
  const due = new Date(t.dueDate).getTime();
  return Number.isFinite(due) && due < endOfDayMs;
}

export function evaluateTasks(
  raw: RawEffortTask[],
  currentEnergy: number,
  isLazyMode: boolean,
  endOfDayMs: number = Date.now() + 86400000
): EvaluatedEffortTask[] {
  const low = isLazyMode || currentEnergy <= 30;

  return raw.map((t) => {
    const duration = t.estimatedMinutes || 30;
    const energyCost = calculateEnergyCost(t.title, duration);
    const lower = t.title.toLowerCase();
    const essential = isEssential(t, endOfDayMs);

    let action: EffortAction;
    let actionReason: string;

    if (essential && energyCost > capacityFor(currentEnergy)) {
      action = "OPTIMIZE";
      actionReason = "Has to move today but is heavy for your energy. Do just a 15-minute sprint, nothing more.";
    } else if (t.isAcademic && low && duration >= 40) {
      action = "OPTIMIZE";
      actionReason = "Coursework you can't drop. Break it into one 20-minute sprint rather than skipping it.";
    } else if (!essential && low && t.priority !== "HIGH" && duration >= 30) {
      action = "SKIP";
      actionReason = "Nothing forces this today and your energy is low. Defer it and let it cost you nothing.";
    } else if (/(format|clean|schedule|sync|deploy)/.test(lower)) {
      action = "AUTOMATE";
      actionReason = "Repetitive work. Batch it with similar jobs or let a script or routine handle it.";
    } else if (energyCost <= 3 || duration <= 20) {
      action = "OPTIMIZE";
      actionReason = "Light enough to finish in one short sprint or to batch with other quick jobs.";
    } else {
      action = "JUST_DO_IT";
      actionReason = "Worth doing properly. Do it when your energy is up, or split it into a first step.";
    }

    return {
      id: t.id,
      title: t.title,
      projectName: t.projectName,
      estimatedMinutes: duration,
      priority: t.priority,
      dueDate: t.dueDate ?? null,
      energyCost,
      action,
      actionReason,
      essential,
    };
  });
}

/** Up to four quick, low-energy tasks that can be knocked out together. Essentials first, then by priority. */
export function pickLowEnergyBatch(tasks: EvaluatedEffortTask[]) {
  const batch = tasks
    .filter((t) => t.energyCost <= 3 && t.estimatedMinutes <= 30)
    .sort(
      (a, b) =>
        Number(b.essential) - Number(a.essential) || priorityRank(a.priority) - priorityRank(b.priority)
    )
    .slice(0, 4);
  return {
    tasks: batch,
    totalMinutes: batch.reduce((acc, t) => acc + t.estimatedMinutes, 0),
    count: batch.length,
  };
}

export interface NextStep {
  task: EvaluatedEffortTask;
  /** FULL: do the whole task. SPRINT: it is too heavy for your energy, do only a 15-minute first step. */
  mode: "FULL" | "SPRINT";
  why: string;
}

/**
 * The single thing to do right now. Fits your energy: an essential task that fits comes first, then an
 * essential one too heavy for now (as a 15-minute sprint), then the best fitting optional task.
 */
export function pickNextStep(
  tasks: EvaluatedEffortTask[],
  energy: number,
  excludeIds: string[] = []
): NextStep | null {
  const cap = capacityFor(energy);
  const pool = tasks.filter((t) => !excludeIds.includes(t.id));
  const byImportance = (a: EvaluatedEffortTask, b: EvaluatedEffortTask) => {
    const dueA = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
    const dueB = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
    return priorityRank(a.priority) - priorityRank(b.priority) || dueA - dueB || b.energyCost - a.energyCost;
  };

  const essentials = pool.filter((t) => t.essential).sort(byImportance);
  const fits = essentials.find((t) => t.energyCost <= cap);
  if (fits) {
    return { task: fits, mode: "FULL", why: "It has to be done today and it fits the energy you have." };
  }
  if (essentials.length > 0) {
    const lightest = [...essentials].sort((a, b) => a.energyCost - b.energyCost)[0];
    return {
      task: lightest,
      mode: "SPRINT",
      why: "It can't wait, but it's heavy for now. Give it 15 minutes and stop.",
    };
  }

  const optional = pool.filter((t) => t.energyCost <= cap).sort(byImportance);
  if (optional.length > 0) {
    return { task: optional[0], mode: "FULL", why: "Nothing is urgent. This is the best use of the energy you have." };
  }
  if (pool.length > 0) {
    const lightest = [...pool].sort((a, b) => a.energyCost - b.energyCost)[0];
    return { task: lightest, mode: "SPRINT", why: "Everything left is heavy. Take the lightest one as a 15-minute sprint, or rest." };
  }
  return null;
}
