/** Small, dependency-free helpers for turning LMS data into clean values. Pure functions. */

export interface ParsedCourseName {
  term: string | null;
  code: string;
  name: string;
  lecturer: string | null;
  stream: string | null;
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/(^|[\s'-])([a-z])/g, (_, a: string, b: string) => a + b.toUpperCase());
}

/**
 * KCAU names units like
 *   "TRIM3 26:CPP 4103:ARTIFICIAL INTELLIGENCE PROGRAMMING:FT:FANON ANANDA TUMAINI:TC 2-3-2/VTC 2-3-2:Stream B"
 * i.e. term : code : title : mode : lecturer : delivery : stream. Other sites differ, so anything
 * that does not fit falls back to the short name rather than guessing.
 */
export function parseCourseName(fullname: string, shortname?: string): ParsedCourseName {
  const parts = fullname.split(":").map((p) => p.trim());
  const looksStructured = parts.length >= 4 && /^[A-Za-z]{2,5}\s?\d{3,4}[A-Za-z]?$/.test(parts[1] || "");
  if (looksStructured) {
    const stream = parts.find((p) => /^stream\s+\w+/i.test(p)) || null;
    return {
      term: parts[0] || null,
      code: parts[1].toUpperCase(),
      name: titleCase(parts[2] || parts[1]),
      lecturer: parts[4] ? titleCase(parts[4]) : null,
      stream,
    };
  }
  const base = (shortname || fullname).trim();
  return { term: null, code: base.slice(0, 20).toUpperCase(), name: fullname.trim().slice(0, 120), lecturer: null, stream: null };
}

/** Units that are not real teaching units (induction, orientation, etc.). */
export function isNoiseCourse(fullname: string): boolean {
  return /getting started|orientation|induction|welcome to|sandbox|\(faculty\)|\(staff\)/i.test(fullname);
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'" };

/** HTML (as LMS messages arrive) to plain text; never kept as markup. */
export function htmlToText(html: string | null | undefined, max = 2000): string {
  if (!html) return "";
  const text = html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h\d)>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&(#?\w+);/g, (m, e: string) => ENTITIES[e] ?? m)
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim();
  return text.length > max ? text.slice(0, max - 1) + "…" : text;
}

/** Classify an LMS quiz title: CATs and exams get their own tab; the rest are ordinary coursework. */
export function quizKind(title: string): "CAT" | "EXAM" | "QUIZ" {
  if (/\bexam(ination)?\b|\bfinal\b|\bmid[\s-]?term\b/i.test(title)) return "EXAM";
  if (/\bcat\b|\bcats\b|continuous assessment/i.test(title)) return "CAT";
  return "QUIZ";
}

/** Moodle timestamps are seconds since the epoch; 0 means "not set". */
export function fromUnix(value: unknown): Date | null {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? new Date(n * 1000) : null;
}

/** Moodle sends numbers as strings like "17.00000". */
export function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : parseFloat(String(value));
  return Number.isFinite(n) ? n : null;
}
