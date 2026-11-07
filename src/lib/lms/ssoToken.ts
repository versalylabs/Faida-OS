/**
 * Pulls the LMS access key out of whatever the student pastes or the browser hands back.
 *
 * Moodle's mobile sign-in redirects to  <scheme>://token=<base64>  where the base64 holds
 * "siteid:::token" (sometimes with ":::privatetoken" after it). People may paste the whole address, the
 * part after "token=", the decoded text, or the bare key, so all of those are accepted. Pure: no network.
 */

// Moodle keys are 32 letters and digits; anything much longer is the base64 wrapper, not a bare key.
const RAW_KEY = /^[A-Za-z0-9]{20,64}$/;
const BARE_KEY = /^[A-Za-z0-9]{20,40}$/;

function tryBase64(text: string): string | null {
  const clean = text.replace(/\s+/g, "");
  if (clean.length < 24 || !/^[A-Za-z0-9+/_-]+={0,2}$/.test(clean)) return null;
  try {
    const std = clean.replace(/-/g, "+").replace(/_/g, "/");
    const padded = std + "=".repeat((4 - (std.length % 4)) % 4);
    const decoded = typeof atob === "function" ? atob(padded) : Buffer.from(padded, "base64").toString("binary");
    return /^[\x20-\x7e]+$/.test(decoded) ? decoded : null;
  } catch {
    return null;
  }
}

/** Returns the access key, or null when nothing in the text looks like one. */
export function extractMoodleToken(input: unknown): string | null {
  if (typeof input !== "string") return null;
  let text = input.trim();
  if (!text) return null;
  // A whole address that was copied percent-encoded (web%2Bfaida%3A%2F%2Ftoken%3D...)
  if (/%[0-9a-f]{2}/i.test(text)) {
    try {
      text = decodeURIComponent(text).trim();
    } catch {
      /* keep the text as it is */
    }
  }

  // Whole address, e.g. web+faida://token=ABC or moodlemobile://token=ABC&siteurl=...
  const marker = text.match(/token=([^&\s"'<>]+)/i);
  if (marker) text = marker[1];
  try {
    if (/%[0-9a-f]{2}/i.test(text)) text = decodeURIComponent(text);
  } catch {
    /* keep the text as it is */
  }
  text = text.trim();

  // Already the decoded "siteid:::token(:::privatetoken)" form
  if (text.includes(":::")) {
    const parts = text.split(":::").map((p) => p.trim());
    return parts[1] && RAW_KEY.test(parts[1]) ? parts[1] : null;
  }

  // A bare key
  if (BARE_KEY.test(text)) return text;

  // The base64 form
  const decoded = tryBase64(text);
  if (decoded && decoded.includes(":::")) {
    const parts = decoded.split(":::");
    return parts[1] && RAW_KEY.test(parts[1]) ? parts[1] : null;
  }
  return null;
}
