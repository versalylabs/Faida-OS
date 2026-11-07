import { lookup } from "dns/promises";
import { isIP } from "net";
import { ValidationError } from "@/lib/validate";

/**
 * Guarded server-side fetching of user-supplied URLs (iCal feeds, Moodle sites).
 * Blocks requests to loopback, private, link-local (cloud metadata) and other internal
 * addresses, refuses redirects, and caps time and response size.
 */

function isPrivateIPv4(ip: string): boolean {
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
    (a === 169 && b === 254) || // link-local, cloud metadata
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224 // multicast / reserved
  );
}

function isPrivateIPv6(ip: string): boolean {
  const v = ip.toLowerCase();
  if (v === "::" || v === "::1") return true;
  if (v.startsWith("fe8") || v.startsWith("fe9") || v.startsWith("fea") || v.startsWith("feb")) return true; // link-local
  if (v.startsWith("fc") || v.startsWith("fd")) return true; // unique local
  const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIPv4(mapped[1]);
  return false;
}

export function isPrivateAddress(ip: string): boolean {
  const kind = isIP(ip);
  if (kind === 4) return isPrivateIPv4(ip);
  if (kind === 6) return isPrivateIPv6(ip);
  return true; // not an IP at all: treat as unsafe
}

/** Validates the URL shape and that every address it resolves to is public. Returns the parsed URL. */
export async function assertPublicHttpsUrl(raw: unknown, label = "URL"): Promise<URL> {
  if (typeof raw !== "string" || raw.length > 2000) throw new ValidationError(`${label} is invalid`);
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new ValidationError(`${label} is not a valid URL`);
  }
  if (url.protocol !== "https:") throw new ValidationError(`${label} must start with https://`);
  if (url.username || url.password) throw new ValidationError(`${label} must not contain credentials`);

  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new ValidationError(`${label} must point to a public website`);
  }

  if (isIP(host)) {
    if (isPrivateAddress(host)) throw new ValidationError(`${label} must point to a public website`);
    return url;
  }

  let addresses: { address: string }[];
  try {
    addresses = await lookup(host, { all: true });
  } catch {
    throw new ValidationError(`${label} could not be resolved`);
  }
  if (addresses.length === 0 || addresses.some((a) => isPrivateAddress(a.address))) {
    throw new ValidationError(`${label} must point to a public website`);
  }
  return url;
}

/** GET a public https URL as text: no redirects, 10s timeout, response size capped. */
export async function fetchPublicText(
  raw: unknown,
  opts: { label?: string; maxBytes?: number } = {}
): Promise<string> {
  const { label = "URL", maxBytes = 5 * 1024 * 1024 } = opts;
  const url = await assertPublicHttpsUrl(raw, label);

  const res = await fetch(url, {
    redirect: "manual",
    signal: AbortSignal.timeout(10_000),
    headers: { "User-Agent": "FaidaOS/1.0" },
  });
  if (res.status >= 300 && res.status < 400) {
    throw new ValidationError(`${label} redirects elsewhere, which is not allowed. Use the final address.`);
  }
  if (!res.ok) throw new ValidationError(`${label} responded with status ${res.status}`);

  const declared = Number(res.headers.get("content-length") || 0);
  if (declared > maxBytes) throw new ValidationError(`${label} response is too large`);

  const reader = res.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > maxBytes) {
      await reader.cancel();
      throw new ValidationError(`${label} response is too large`);
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}
