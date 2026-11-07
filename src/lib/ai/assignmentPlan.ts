import { prisma } from "@/lib/db";
import { chat, isLlmConfigured } from "@/lib/ai/llm";
import { shortDayLabel } from "@/lib/dates";
import { zonedDateKey, zonedTime } from "@/lib/tz";
import { classifyWork, isQuizLike, type WorkKind } from "@/lib/planRules";

/**
 * Turns a big piece of coursework into a short, dated checklist.
 *
 * It is only offered where it helps: reports, projects, presentations and programming work. Quizzes,
 * CATs and exams are not "broken down" (the CATs tab has a study plan for those). With a free AI engine
 * connected the steps are written for the actual assignment; otherwise a sensible template for that kind
 * of work is used. Either way the steps are spread over the days left before the deadline.
 */

export { isQuizLike, classifyWork, type WorkKind };

export interface PlanStep {
  title: string;
  minutes: number;
  by: string; // YYYY-MM-DD
}

const TEMPLATES: Record<WorkKind, { total: number; steps: [string, number][] }> = {
  report: {
    total: 240,
    steps: [
      ["Read the brief and marking criteria", 1],
      ["Gather sources and make notes", 3],
      ["Outline the structure", 1],
      ["Write the first draft", 5],
      ["Edit, add references and proofread", 2],
      ["Submit and check the upload went through", 1],
    ],
  },
  coding: {
    total: 300,
    steps: [
      ["Read the requirements and any examples", 1],
      ["Set up the project and plan the approach", 2],
      ["Build the core part", 6],
      ["Test with edge cases and fix problems", 3],
      ["Write the short report or README", 2],
      ["Zip, submit and check the upload went through", 1],
    ],
  },
  presentation: {
    total: 180,
    steps: [
      ["Read the brief, timing and criteria", 1],
      ["Outline the key points", 2],
      ["Build the slides", 4],
      ["Rehearse out loud and time it", 2],
      ["Final check and submit", 1],
    ],
  },
  project: {
    total: 360,
    steps: [
      ["Review the requirements and any feedback", 1],
      ["Research and note the key sources", 4],
      ["Draft the main sections", 6],
      ["Refine the draft", 3],
      ["Check formatting and references", 1],
      ["Submit and check the upload went through", 1],
    ],
  },
  generic: {
    total: 180,
    steps: [
      ["Read the requirements", 1],
      ["Do the main work", 5],
      ["Review it against the criteria", 2],
      ["Submit and check the upload went through", 1],
    ],
  },
};

/** The steps for this kind of work, with minutes that add up to about `totalMinutes`. */
export function templateSteps(kind: WorkKind, totalMinutes: number): { title: string; minutes: number }[] {
  const t = TEMPLATES[kind];
  const weightSum = t.steps.reduce((n, [, w]) => n + w, 0);
  const total = Math.max(t.total, totalMinutes || 0);
  return t.steps.map(([title, w]) => ({ title, minutes: Math.max(10, Math.round(((total * w) / weightSum) / 5) * 5) }));
}

/**
 * Gives each step a "do it by" day, working back from the deadline: the last step lands the day before it
 * is due (or today when there is little time) and earlier steps are spaced out, at most 3 days apart.
 */
export function scheduleSteps<T extends { title: string; minutes: number }>(steps: T[], now: Date, due: Date | null): (T & { by: string })[] {
  const today = zonedDateKey(now);
  const dayMs = 86400000;
  const todayN = Date.parse(`${today}T12:00:00Z`);
  let lastN = todayN;
  if (due) {
    const dueN = Date.parse(`${zonedDateKey(due)}T12:00:00Z`);
    lastN = dueN - todayN >= 2 * dayMs ? dueN - dayMs : Math.max(todayN, dueN);
  } else {
    lastN = todayN + 7 * dayMs; // no deadline: a week
  }
  const available = Math.max(1, Math.round((lastN - todayN) / dayMs) + 1);
  const span = Math.min(available, steps.length * 3);
  const start = available - span;
  return steps.map((s, i) => {
    const offset = steps.length === 1 ? available - 1 : start + Math.round((i * (span - 1)) / (steps.length - 1));
    return { ...s, by: new Date(todayN + offset * dayMs).toISOString().slice(0, 10) };
  });
}

function extractJson(text: string): any | null {
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

async function aiSteps(opts: { title: string; description: string | null; course: string | null; daysLeft: number | null; minutes: number }) {
  if (!isLlmConfigured()) return null;
  try {
    const reply = await chat([
      {
        role: "system",
        content:
          'You plan university coursework for one student. Answer with JSON only, no prose: {"steps":[{"title":"...","minutes":45}]}. ' +
          "4 to 7 steps, each starting with a verb and specific to this assignment, minutes between 10 and 120, in the order they should be done, " +
          "ending with submitting it. Do not include study breaks.",
      },
      {
        role: "user",
        content: `Assignment: ${opts.title}\nUnit: ${opts.course || "n/a"}\nBrief: ${(opts.description || "none given").slice(0, 500)}\nDays left: ${opts.daysLeft ?? "no deadline"}\nAbout ${opts.minutes} minutes of work in total.`,
      },
    ]);
    const json = extractJson(reply.message.content || "");
    const list = Array.isArray(json?.steps) ? json.steps : null;
    if (!list || list.length < 3 || list.length > 8) return null;
    const steps = list.map((s: any) => ({ title: typeof s?.title === "string" ? s.title.trim().replace(/\s+/g, " ").slice(0, 120) : "", minutes: Math.round(Number(s?.minutes)) }));
    if (steps.some((s: any) => s.title.length < 4 || !Number.isFinite(s.minutes) || s.minutes < 10 || s.minutes > 180)) return null;
    return steps as { title: string; minutes: number }[];
  } catch {
    return null; // fall back to the template
  }
}

const dayText = (key: string) => shortDayLabel(zonedTime(key, "12:00").toISOString());

export interface PlanResult {
  ok: boolean;
  error?: string;
  steps?: PlanStep[];
  totalMinutes?: number;
  usedAi?: boolean;
}

/** Builds and saves the plan for one assignment. `replace` swaps out unfinished steps of an earlier plan. */
export async function createPlan(userId: string, taskId: string, opts: { replace?: boolean; now?: Date } = {}): Promise<PlanResult> {
  const now = opts.now ?? new Date();
  const task = await prisma.task.findFirst({
    where: { id: taskId, userId, isAcademic: true },
    include: { course: { select: { code: true, name: true } }, subtasks: true },
  });
  if (!task) return { ok: false, error: "I could not find that assignment." };
  if (task.status === "DONE") return { ok: false, error: "That assignment is already done." };
  if (isQuizLike(task.title)) return { ok: false, error: "Quizzes and CATs do not need a step plan. Use the study plan on the CATs & Exams tab." };
  if (task.dueDate && task.dueDate.getTime() < now.getTime() - 86400000) return { ok: false, error: "The deadline has passed, so a step plan would not help." };
  if (task.subtasks.length > 0 && !opts.replace) return { ok: false, error: "This assignment already has a plan." };

  const kind = classifyWork(task.title, task.description);
  const dayN = task.dueDate ? Math.ceil((task.dueDate.getTime() - now.getTime()) / 86400000) : null;
  const baseMinutes = Math.max(TEMPLATES[kind].total, task.estimatedMinutes && task.estimatedMinutes > 120 ? task.estimatedMinutes : 0);

  const ai = await aiSteps({ title: task.title, description: task.description, course: task.course ? `${task.course.code} ${task.course.name}` : null, daysLeft: dayN, minutes: baseMinutes });
  const base = ai ?? templateSteps(kind, baseMinutes);
  const steps = scheduleSteps(base, now, task.dueDate);
  const totalMinutes = steps.reduce((n, s) => n + s.minutes, 0);

  if (opts.replace && task.subtasks.length > 0) {
    await prisma.subtask.deleteMany({ where: { taskId: task.id, isDone: false } });
  }
  for (const s of steps) {
    await prisma.subtask.create({ data: { taskId: task.id, title: `${s.title} · ${s.minutes} min · by ${dayText(s.by)}` } });
  }
  await prisma.task.update({ where: { id: task.id }, data: { estimatedMinutes: totalMinutes } });

  return { ok: true, steps, totalMinutes, usedAi: Boolean(ai) };
}
