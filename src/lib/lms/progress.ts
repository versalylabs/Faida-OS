/**
 * Pure maths for the University page: how far along each unit is, and what needs attention.
 * No database or network access here, so it can be tested on its own.
 */

export type ItemState = "TODO" | "SUBMITTED" | "GRADED";

export interface ProgressItem {
  id: string;
  courseId: string | null;
  kind: string; // ASSIGNMENT | QUIZ | ZOOM | RESOURCE
  title: string;
  url: string | null;
  dueAt: Date | null;
  state: string;
  gradeEarned: number | null;
  gradeMax: number | null;
  dismissed: boolean;
}

export interface UnitInfo {
  id: string;
  code: string;
  name: string;
  lecturer?: string | null;
  color?: string | null;
  sourceUrl?: string | null;
  lmsCompletion?: number | null;
}

export interface UnitProgress {
  courseId: string;
  code: string;
  name: string;
  lecturer: string | null;
  color: string | null;
  url: string | null;
  total: number; // graded + submitted + still to do
  done: number; // submitted or graded
  graded: number;
  missed: number; // deadline passed, nothing submitted
  upcoming: number; // still to do, deadline not yet reached (or none)
  percent: number; // done / total, 0-100
  marksEarned: number;
  marksMax: number;
  marksPercent: number | null; // marks so far as a share of marks available for graded work
  lmsCompletion: number | null; // the LMS's own completion tick percentage, when the unit uses it
  next: { title: string; dueAt: string; url: string | null } | null;
  status: "ALL_DONE" | "BEHIND" | "ON_TRACK" | "NO_WORK";
}

const TRACKED = new Set(["ASSIGNMENT", "QUIZ"]);

export function isTracked(item: Pick<ProgressItem, "kind" | "dismissed">): boolean {
  return TRACKED.has(item.kind) && !item.dismissed;
}

export function isMissed(item: ProgressItem, now: Date, maxAgeDays = 90): boolean {
  if (!isTracked(item) || item.state !== "TODO" || !item.dueAt) return false;
  const age = now.getTime() - item.dueAt.getTime();
  return age > 0 && age <= maxAgeDays * 86400000;
}

export function computeUnitProgress(units: UnitInfo[], items: ProgressItem[], now: Date): UnitProgress[] {
  return units.map((u) => {
    const mine = items.filter((i) => i.courseId === u.id && isTracked(i));
    const done = mine.filter((i) => i.state === "SUBMITTED" || i.state === "GRADED");
    const graded = mine.filter((i) => i.state === "GRADED" && i.gradeEarned !== null && !!i.gradeMax);
    const missed = mine.filter((i) => isMissed(i, now, 3650));
    const upcoming = mine.filter((i) => i.state === "TODO" && !missed.includes(i));

    const marksEarned = graded.reduce((n, i) => n + (i.gradeEarned || 0), 0);
    const marksMax = graded.reduce((n, i) => n + (i.gradeMax || 0), 0);

    const next =
      upcoming
        .filter((i) => i.dueAt && i.dueAt.getTime() >= now.getTime())
        .sort((a, b) => a.dueAt!.getTime() - b.dueAt!.getTime())[0] || null;

    const total = mine.length;
    const percent = total === 0 ? 0 : Math.round((done.length / total) * 100);

    let status: UnitProgress["status"] = "ON_TRACK";
    if (total === 0) status = "NO_WORK";
    else if (missed.length > 0) status = "BEHIND";
    else if (done.length === total) status = "ALL_DONE";

    return {
      courseId: u.id,
      code: u.code,
      name: u.name,
      lecturer: u.lecturer ?? null,
      color: u.color ?? null,
      url: u.sourceUrl ?? null,
      total,
      done: done.length,
      graded: graded.length,
      missed: missed.length,
      upcoming: upcoming.length,
      percent,
      marksEarned: Math.round(marksEarned * 10) / 10,
      marksMax: Math.round(marksMax * 10) / 10,
      marksPercent: marksMax > 0 ? Math.round((marksEarned / marksMax) * 100) : null,
      lmsCompletion: typeof u.lmsCompletion === "number" ? u.lmsCompletion : null,
      next: next ? { title: next.title, dueAt: next.dueAt!.toISOString(), url: next.url } : null,
      status,
    };
  });
}

export interface AttentionItem {
  id: string;
  courseId: string | null;
  title: string;
  url: string | null;
  dueAt: string;
  kind: string;
  hoursLate?: number;
  bucket: "today" | "tomorrow";
}

/**
 * Work the student should act on now.
 *  - missed: deadline passed (within the last 90 days) with nothing submitted
 *  - dueSoon: due before the end of tomorrow, where "tomorrow" is the student's calendar day
 */
export function computeAttention(
  items: ProgressItem[],
  now: Date,
  endOfToday: Date
): { missed: AttentionItem[]; dueSoon: AttentionItem[] } {
  const endOfTomorrow = new Date(endOfToday.getTime() + 86400000);

  const missed = items
    .filter((i) => isMissed(i, now))
    .sort((a, b) => b.dueAt!.getTime() - a.dueAt!.getTime())
    .map((i) => ({
      id: i.id,
      courseId: i.courseId,
      title: i.title,
      url: i.url,
      dueAt: i.dueAt!.toISOString(),
      kind: i.kind,
      hoursLate: Math.round((now.getTime() - i.dueAt!.getTime()) / 3600000),
      bucket: "today" as const,
    }));

  const dueSoon = items
    .filter(
      (i) =>
        isTracked(i) &&
        i.state === "TODO" &&
        i.dueAt &&
        i.dueAt.getTime() >= now.getTime() &&
        i.dueAt.getTime() < endOfTomorrow.getTime()
    )
    .sort((a, b) => a.dueAt!.getTime() - b.dueAt!.getTime())
    .map((i) => ({
      id: i.id,
      courseId: i.courseId,
      title: i.title,
      url: i.url,
      dueAt: i.dueAt!.toISOString(),
      kind: i.kind,
      bucket: (i.dueAt!.getTime() < endOfToday.getTime() ? "today" : "tomorrow") as "today" | "tomorrow",
    }));

  return { missed, dueSoon };
}
