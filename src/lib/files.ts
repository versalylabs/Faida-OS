import path from "path";
import { prisma } from "@/lib/db";

// Vercel serverless request bodies are capped at ~4.5MB, so keep a safe margin.
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

export const FILE_CATEGORIES = [
  "PROJECT_ASSET",
  "RECEIPT_INVOICE",
  "LEARNING_RESOURCE",
  "CODE_SNIPPET",
  "PERSONAL_DOC",
] as const;

export const FILE_TYPES = [
  "IMAGE",
  "PDF",
  "CODE",
  "SPREADSHEET",
  "ARCHIVE",
  "MEDIA",
  "DOCUMENT",
] as const;

export function inferFileType(filename: string, mimeType?: string): string {
  const ext = path.extname(filename).toLowerCase();
  if ([".png", ".jpg", ".jpeg", ".webp", ".svg", ".gif", ".ico"].includes(ext) || mimeType?.startsWith("image/")) {
    return "IMAGE";
  }
  if (ext === ".pdf" || mimeType === "application/pdf") return "PDF";
  if ([".ts", ".tsx", ".js", ".jsx", ".py", ".json", ".sql", ".html", ".css", ".rs", ".go", ".sh", ".yaml", ".yml"].includes(ext)) {
    return "CODE";
  }
  if ([".xlsx", ".xls", ".csv"].includes(ext)) return "SPREADSHEET";
  if ([".zip", ".tar", ".gz", ".7z", ".rar"].includes(ext)) return "ARCHIVE";
  if ([".mp4", ".mov", ".avi", ".mkv", ".mp3", ".wav", ".m4a"].includes(ext) || mimeType?.startsWith("video/") || mimeType?.startsWith("audio/")) {
    return "MEDIA";
  }
  return "DOCUMENT";
}

/** MIME types that are safe to render inline. Everything else is forced to download. */
const INLINE_SAFE = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/plain",
]);

export function isInlineSafe(mimeType: string): boolean {
  return INLINE_SAFE.has(mimeType);
}

/** Returns the project id only if it belongs to the user; null if absent; undefined if invalid. */
export async function resolveOwnedProjectId(
  userId: string,
  projectId: unknown
): Promise<string | null | undefined> {
  if (projectId === undefined || projectId === null || projectId === "") return null;
  if (typeof projectId !== "string" || projectId.length > 100) return undefined;
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
    select: { id: true },
  });
  return project ? project.id : undefined;
}

export function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

export function normalizeEnum<T extends readonly string[]>(
  value: unknown,
  allowed: T,
  fallback: T[number]
): T[number] {
  const upper = typeof value === "string" ? value.toUpperCase() : "";
  return (allowed as readonly string[]).includes(upper) ? (upper as T[number]) : fallback;
}
