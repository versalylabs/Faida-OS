import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * Small request-validation toolkit for API routes.
 *
 * Every helper returns the cleaned value, or `undefined` when the input is present but
 * invalid. "Absent" values (undefined/null/"") are reported as `null` by the optional
 * variants, so callers can tell "not provided" from "invalid":
 *
 *   const title = str(body.title, { max: 200, required: true });
 *   if (title === undefined) return badRequest("Title is required (max 200 characters)");
 */

export class ValidationError extends Error {
  status = 400;
}

/** Parse a JSON body, returning null (not throwing) on malformed or non-object input. */
export async function readJson(req: Request): Promise<Record<string, any> | null> {
  try {
    const body = await req.json();
    return body && typeof body === "object" && !Array.isArray(body) ? body : null;
  } catch {
    return null;
  }
}

export function badRequest(message: string, headers?: HeadersInit) {
  return NextResponse.json({ success: false, error: message }, { status: 400, headers });
}

export function notFound(message: string, headers?: HeadersInit) {
  return NextResponse.json({ success: false, error: message }, { status: 404, headers });
}

/** Generic 500 that never leaks internal error text (Prisma messages expose schema/queries). */
export function serverError(message: string, error: unknown, headers?: HeadersInit) {
  console.error(message, error);
  return NextResponse.json({ success: false, error: message }, { status: 500, headers });
}

type StrOpts = { max?: number; min?: number; required?: boolean };

/**
 * Trimmed string. Returns:
 *  - the string when valid
 *  - null when absent/blank and not required
 *  - undefined when invalid (wrong type, too long/short, or blank but required)
 */
export function str(value: unknown, opts: StrOpts & { required: true }): string | undefined;
export function str(value: unknown, opts?: StrOpts): string | null | undefined;
export function str(value: unknown, opts: StrOpts = {}): string | null | undefined {
  const { max = 500, min = 0, required = false } = opts;
  if (value === undefined || value === null) return required ? undefined : null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return required ? undefined : null;
  if (trimmed.length > max || trimmed.length < min) return undefined;
  return trimmed;
}

type NumOpts = { min?: number; max?: number; int?: boolean; required?: boolean };

/** Finite number (accepts numeric strings). null = absent, undefined = invalid. */
export function num(value: unknown, opts: NumOpts & { required: true }): number | undefined;
export function num(value: unknown, opts?: NumOpts): number | null | undefined;
export function num(value: unknown, opts: NumOpts = {}): number | null | undefined {
  const { min = -1e12, max = 1e12, int = false, required = false } = opts;
  if (value === undefined || value === null || value === "") return required ? undefined : null;
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value.trim()) : NaN;
  if (!Number.isFinite(n) || n < min || n > max) return undefined;
  if (int && !Number.isInteger(n)) return undefined;
  return n;
}

/** Value must be one of `allowed` (case-insensitive match returns the canonical entry). */
export function oneOf<T extends string>(value: unknown, allowed: readonly T[], opts: { required: true }): T | undefined;
export function oneOf<T extends string>(value: unknown, allowed: readonly T[], opts?: { required?: boolean }): T | null | undefined;
export function oneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
  opts: { required?: boolean } = {}
): T | null | undefined {
  if (value === undefined || value === null || value === "") return opts.required ? undefined : null;
  if (typeof value !== "string") return undefined;
  const hit = allowed.find((a) => a.toLowerCase() === value.trim().toLowerCase());
  return hit ?? undefined;
}

/** Valid date (ISO string / timestamp / Date). null = absent, undefined = invalid. */
export function date(value: unknown, opts: { required: true }): Date | undefined;
export function date(value: unknown, opts?: { required?: boolean }): Date | null | undefined;
export function date(value: unknown, opts: { required?: boolean } = {}): Date | null | undefined {
  if (value === undefined || value === null || value === "") return opts.required ? undefined : null;
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return undefined;
  // Keep within a range Postgres and JS both handle comfortably.
  const year = d.getUTCFullYear();
  if (year < 1900 || year > 2200) return undefined;
  return d;
}

export function bool(value: unknown): boolean | null | undefined {
  if (value === undefined || value === null) return null;
  return typeof value === "boolean" ? value : undefined;
}

export function email(value: unknown): string | null | undefined {
  const s = str(value, { max: 254 });
  if (s === null || s === undefined) return s;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? s.toLowerCase() : undefined;
}

/** Models that carry a `userId` column and can be linked to from other records. */
type OwnedModel =
  | "project"
  | "task"
  | "business"
  | "businessClient"
  | "learningSubject"
  | "learningTopic"
  | "universityCourse"
  | "financeAccount"
  | "financeCategory"
  | "shoppingCategory"
  | "note"
  | "calendarEvent";

/**
 * Check that `id` refers to a record owned by `userId`.
 *   - absent value        -> null (nothing to link)
 *   - invalid or foreign  -> undefined (caller should answer 400/404)
 *   - owned               -> the id
 */
export async function ownedId(
  model: OwnedModel,
  userId: string,
  id: unknown
): Promise<string | null | undefined> {
  if (id === undefined || id === null || id === "") return null;
  if (typeof id !== "string" || id.length > 100) return undefined;
  // learningTopic has no userId; it is owned through its subject.
  const where =
    model === "learningTopic" ? { id, subject: { userId } } : { id, userId };
  const delegate = (prisma as any)[model];
  const found = await delegate.findFirst({ where, select: { id: true } });
  return found ? found.id : undefined;
}

/** Throws a 400-level ValidationError when `value` is undefined (i.e. present but invalid). */
export function must<T>(value: T | undefined, message: string): T {
  if (value === undefined) throw new ValidationError(message);
  return value;
}

/** Like readJson but throws ValidationError so route catch blocks answer 400. */
export async function readBody(req: Request): Promise<Record<string, any>> {
  const body = await readJson(req);
  if (!body) throw new ValidationError("Request body must be a JSON object");
  return body;
}

/** Finite number clamped into [min, max]; anything unusable becomes `fallback`. */
export function safeFloat(value: unknown, fallback = 0, min = -1e12, max = 1e12): number {
  const n = typeof value === "number" ? value : typeof value === "string" ? parseFloat(value) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** Integer clamped into [min, max] (default fits a Postgres 32-bit INT). */
export function safeInt(value: unknown, fallback = 0, min = -2_000_000_000, max = 2_000_000_000): number {
  return Math.trunc(safeFloat(value, fallback, min, max));
}

export const TASK_STATUSES = ["TODO", "IN_PROGRESS", "DONE", "BLOCKED", "BACKLOG", "CANCELLED", "ARCHIVED"] as const;
export const PRIORITIES = ["URGENT", "HIGH", "MEDIUM", "LOW"] as const;
export const RECURRENCES = ["DAILY", "WEEKDAYS", "WEEKLY", "MONTHLY", "YEARLY"] as const;

/** CSS hex colour like #3b82f6. null = absent, undefined = invalid. */
export function color(value: unknown): string | null | undefined {
  const s = str(value, { max: 9 });
  if (s === null || s === undefined) return s;
  return /^#[0-9a-fA-F]{3,8}$/.test(s) ? s : undefined;
}

/** A record id supplied by a client: non-empty string, sane length. undefined = invalid. */
export function idOf(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 && value.length <= 100 ? value : undefined;
}

/** Tags as a comma-separated string (accepts a string or a list of strings). */
export function tagsOf(value: unknown): string | null | undefined {
  if (value === undefined || value === null) return null;
  if (Array.isArray(value)) {
    if (value.length > 30) return undefined;
    const parts: string[] = [];
    for (const v of value) {
      const t = str(v, { max: 50 });
      if (t === undefined) return undefined;
      if (t) parts.push(t);
    }
    return parts.length ? parts.join(", ") : null;
  }
  return str(value, { max: 500 });
}

/** http(s) URL only (blocks javascript:, data: and similar). null = absent, undefined = invalid. */
export function httpUrl(value: unknown): string | null | undefined {
  const s = str(value, { max: 2000 });
  if (s === null || s === undefined) return s;
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:" ? s : undefined;
  } catch {
    return undefined;
  }
}

/** Clock time such as 09:00 or 9:30. null = absent, undefined = invalid. */
export function clockTime(value: unknown): string | null | undefined {
  const s = str(value, { max: 5 });
  if (s === null || s === undefined) return s;
  return /^([01]?\d|2[0-3]):[0-5]\d$/.test(s) ? s : undefined;
}
