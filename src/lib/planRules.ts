/** Rules shared by the planner and the University page (no server code, so the browser can use them too). */

export type WorkKind = "coding" | "report" | "presentation" | "project" | "generic";

export const isQuizLike = (title: string) =>
  /\b(quizzes|quiz|cats?|exams?|examination|mid[\s-]?terms?)\b|\bfinal\s+(exam|examination|test|assessment)\b|\b(class|unit|written|online|topic)\s+test\b|\btest\s*\d+\b|\btest$/i.test(title.trim());

export function classifyWork(title: string, description?: string | null): WorkKind {
  const t = `${title} ${description || ""}`.toLowerCase();
  if (/present|slides|pitch|demo|viva|defen[cs]e/.test(t)) return "presentation";
  if (/project|capstone|fyp|thesis|dissertation|proposal|research/.test(t)) return "project";
  if (/code|coding|program|implement|software|app\b|database|website|api\b|algorithm|\blab\b|python|java|sql|prototype/.test(t)) return "coding";
  if (/report|essay|paper|analysis|review|case study|write|article|summary|reflection/.test(t)) return "report";
  return "generic";
}

/** Should this assignment offer a step plan? Not quizzes/CATs, not finished work, not past deadlines. */
export function canPlan(a: { title: string; status: string; dueDate?: string | null; subtasks: unknown[] }, now: number = Date.now()): boolean {
  if (a.status === "DONE" || a.subtasks.length > 0 || isQuizLike(a.title)) return false;
  if (a.dueDate && new Date(a.dueDate).getTime() < now - 86400000) return false;
  return true;
}
