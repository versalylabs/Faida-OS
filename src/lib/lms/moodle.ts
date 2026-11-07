import { assertPublicHttpsUrl } from "@/lib/safeFetch";
import { ValidationError } from "@/lib/validate";

/** Raised when the LMS refuses the key (wrong, revoked or expired). */
export class MoodleTokenError extends Error {}
/** Raised for any other LMS error answer (a feature switched off, no permission, ...). */
export class MoodleError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

const REQUEST_TIMEOUT_MS = 15_000;
const MAX_RESPONSE_BYTES = 8 * 1024 * 1024;

/** Only for automated tests against a local fake LMS; never honoured in production. */
function localTestAllowed(url: URL): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.LMS_TEST_ALLOW_LOCAL === "1" &&
    (url.hostname === "127.0.0.1" || url.hostname === "localhost")
  );
}

/** Validates the address the student typed and returns the LMS root, e.g. https://virtualcampus.kcau.ac.ke */
export async function normalizeBaseUrl(raw: unknown): Promise<string> {
  if (typeof raw !== "string" || !raw.trim()) throw new ValidationError("LMS address is required");
  let candidate = raw.trim();
  if (!/^https?:\/\//i.test(candidate)) candidate = `https://${candidate}`;

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new ValidationError("LMS address is not a valid web address");
  }

  if (!localTestAllowed(parsed)) {
    // Blocks private/internal hosts and anything that is not https.
    parsed = await assertPublicHttpsUrl(parsed.origin, "LMS address");
  }

  // Keep a sub-folder install (https://school.edu/moodle) but drop pages and service paths.
  const path = parsed.pathname
    .replace(/\/(webservice|login|my|course|user|mod|calendar)(\/.*)?$/i, "")
    .replace(/\/+$/, "");
  return `${parsed.origin}${path}`;
}

function flatten(prefix: string, value: unknown, out: URLSearchParams): void {
  if (value === undefined || value === null) return;
  if (Array.isArray(value)) {
    value.forEach((v, i) => flatten(`${prefix}[${i}]`, v, out));
  } else if (typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) flatten(`${prefix}[${k}]`, v, out);
  } else {
    out.append(prefix, typeof value === "boolean" ? (value ? "1" : "0") : String(value));
  }
}

export interface MoodleClient {
  base: string;
  call<T = any>(fn: string, params?: Record<string, unknown>): Promise<T>;
}

/**
 * A small client for Moodle's web-service API. The key is sent in the request body (not the
 * address, so it never lands in logs), redirects are refused, and time and size are capped.
 */
export function createMoodleClient(base: string, token: string, deadlineAt: number = Date.now() + 50_000): MoodleClient {
  const endpoint = `${base}/webservice/rest/server.php`;

  async function once(fn: string, params: Record<string, unknown>): Promise<any> {
    const remaining = deadlineAt - Date.now();
    if (remaining < 1500) throw new MoodleError("timeout", "Ran out of time while talking to the LMS");

    const body = new URLSearchParams({ wstoken: token, wsfunction: fn, moodlewsrestformat: "json" });
    for (const [k, v] of Object.entries(params)) flatten(k, v, body);

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "FaidaOS/1.0" },
      body,
      redirect: "manual",
      signal: AbortSignal.timeout(Math.min(REQUEST_TIMEOUT_MS, remaining)),
    });
    if (res.status >= 300 && res.status < 400) throw new MoodleError("redirect", "The LMS address redirects elsewhere");
    if (!res.ok) throw new MoodleError(`http_${res.status}`, `The LMS answered with status ${res.status}`);

    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_RESPONSE_BYTES) throw new MoodleError("too_large", "The LMS response was too large");

    let data: any;
    try {
      data = JSON.parse(new TextDecoder().decode(buf));
    } catch {
      throw new MoodleError("bad_json", "The LMS did not answer with data (is web access switched on?)");
    }
    if (data && typeof data === "object" && !Array.isArray(data) && (data.exception || data.errorcode)) {
      if (data.errorcode === "invalidtoken" || data.errorcode === "expiredtoken") {
        throw new MoodleTokenError("The LMS rejected the access key");
      }
      throw new MoodleError(String(data.errorcode || data.exception), String(data.message || "LMS error"));
    }
    return data;
  }

  return {
    base,
    async call(fn, params = {}) {
      try {
        return await once(fn, params);
      } catch (err) {
        // One retry for network hiccups; never for answers the LMS gave on purpose.
        if (err instanceof MoodleTokenError || err instanceof MoodleError) throw err;
        await new Promise((r) => setTimeout(r, 400));
        return await once(fn, params).catch((e) => {
          if (e instanceof MoodleTokenError || e instanceof MoodleError) throw e;
          throw new MoodleError("network", "Could not reach the LMS");
        });
      }
    },
  };
}

/** Runs `fn` over `items` with at most `limit` in flight, keeping results in order. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}
