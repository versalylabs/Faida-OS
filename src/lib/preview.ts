/**
 * Which stored files the browser can show on screen instead of downloading. Safe to import in the browser
 * and on the server. Anything that could run code (HTML, scripts) is never shown as itself: text-like files
 * are served as plain text, and types a browser cannot display (Word, Excel, zip) simply have no preview.
 */

const INLINE_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/avif",
  "image/bmp",
  "image/svg+xml",
  "application/pdf",
  "audio/mpeg",
  "audio/mp4",
  "audio/wav",
  "audio/x-wav",
  "audio/ogg",
  "audio/webm",
  "video/mp4",
  "video/webm",
  "video/ogg",
  "video/quicktime",
]);

const BY_EXTENSION: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  bmp: "image/bmp",
  svg: "image/svg+xml",
  pdf: "application/pdf",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  wav: "audio/wav",
  ogg: "audio/ogg",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  // shown as plain text
  txt: "text/plain",
  md: "text/plain",
  csv: "text/plain",
  tsv: "text/plain",
  json: "text/plain",
  log: "text/plain",
  xml: "text/plain",
  yaml: "text/plain",
  yml: "text/plain",
  sql: "text/plain",
  ts: "text/plain",
  tsx: "text/plain",
  js: "text/plain",
  jsx: "text/plain",
  py: "text/plain",
  css: "text/plain",
  html: "text/plain",
  sh: "text/plain",
  rs: "text/plain",
  go: "text/plain",
  env: "text/plain",
};

/** The content type to show a file with, or null when it can only be downloaded. */
export function previewType(name: string, storedMime?: string | null): string | null {
  const mime = (storedMime || "").toLowerCase().split(";")[0].trim();
  if (mime.startsWith("text/")) return "text/plain"; // never serve html or scripts as themselves
  if (INLINE_MIME.has(mime)) return mime;
  const ext = name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";
  return BY_EXTENSION[ext] ?? null;
}
