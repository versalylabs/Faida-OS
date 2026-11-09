import { formatDate } from "@/lib/utils";

/** Calendar date (YYYY-MM-DD) of a stored due date; due dates are saved as plain dates. */
export function dueDay(value?: string | null): string {
  return value ? new Date(value).toISOString().slice(0, 10) : "";
}

export function todayDay(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Whole days from today until the due day (negative = overdue). */
export function daysUntil(day: string): number {
  return Math.round((Date.parse(day) - Date.parse(todayDay())) / 86_400_000);
}

export function dueLabel(day: string): string {
  const n = daysUntil(day);
  if (n < 0) return `Overdue ${-n}d`;
  if (n === 0) return "Due today";
  if (n === 1) return "Due tomorrow";
  return `Due ${formatDate(day)}`;
}
