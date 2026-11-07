// Faida OS - Offline Sync Engine & Cache Manager

export interface QueuedMutation {
  id: string;
  url: string;
  method: "POST" | "PATCH" | "PUT" | "DELETE";
  headers?: Record<string, string>;
  body?: any;
  description: string;
  timestamp: number;
  retryCount: number;
}

// All offline data is scoped to the signed-in user so that a shared browser never
// shows (or replays) one account's data under another.
const ACTIVE_USER_KEY = "faida_active_user";
const CACHE_PREFIX = "faida_cache:";
const QUEUE_PREFIX = "faida_queue:";
// Pre-scoping keys, purged on sight because their owner cannot be determined.
const LEGACY_PREFIXES = ["faida_cache_", "faida_offline_mutations"];

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function removeKeysWhere(predicate: (key: string) => boolean): void {
  const store = storage();
  if (!store) return;
  const doomed: string[] = [];
  for (let i = 0; i < store.length; i++) {
    const key = store.key(i);
    if (key && predicate(key)) doomed.push(key);
  }
  doomed.forEach((key) => store.removeItem(key));
}

export function getActiveOfflineUser(): string | null {
  return storage()?.getItem(ACTIVE_USER_KEY) ?? null;
}

function cacheKey(userId: string, key: string): string {
  return `${CACHE_PREFIX}${userId}:${key}`;
}

function queueKey(userId: string): string {
  return `${QUEUE_PREFIX}${userId}`;
}

/**
 * Record which account this browser session belongs to. Offline data belonging to any
 * other account (and any unscoped legacy data) is deleted.
 */
export function setActiveOfflineUser(userId: string): void {
  const store = storage();
  if (!store) return;
  const own = [`${CACHE_PREFIX}${userId}:`, queueKey(userId)];
  removeKeysWhere((key) => {
    if (LEGACY_PREFIXES.some((p) => key.startsWith(p))) return true;
    const scoped = key.startsWith(CACHE_PREFIX) || key.startsWith(QUEUE_PREFIX);
    return scoped && !own.some((o) => key.startsWith(o));
  });
  try {
    store.setItem(ACTIVE_USER_KEY, userId);
  } catch {}
  // Lets the app start saving pages and data for offline use as soon as it knows who is signed in.
  window.dispatchEvent(new CustomEvent("faida-user-ready", { detail: { userId } }));
}

/** Remove cached API data (and the service worker's page cache). Pending changes are kept unless asked. */
export async function clearOfflineData(options: { includeQueue?: boolean } = {}): Promise<void> {
  const { includeQueue = false } = options;
  removeKeysWhere((key) => {
    if (LEGACY_PREFIXES.some((p) => key.startsWith(p))) return true;
    if (key.startsWith(CACHE_PREFIX) || key.startsWith("faida_warm_at:")) return true;
    if (includeQueue && key.startsWith(QUEUE_PREFIX)) return true;
    return false;
  });
  if (includeQueue) {
    storage()?.removeItem(ACTIVE_USER_KEY);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("faida-offline-queue-changed", { detail: { count: 0, queue: [] } }));
    }
  }
  try {
    if (typeof caches !== "undefined") {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((n) => n.startsWith("faida-api") || n.startsWith("faida-pages"))
          .map((n) => caches.delete(n))
      );
    }
  } catch {}
}

/**
 * Returns true if the client browser is currently online
 */
export function isOnline(): boolean {
  if (typeof window === "undefined") return true;
  return window.navigator.onLine ?? true;
}

/**
 * Save data to local offline cache
 */
export function cacheOfflineData<T>(key: string, data: T): void {
  const userId = getActiveOfflineUser();
  if (!userId) return;
  const store = storage();
  if (!store) return;
  const serialized = JSON.stringify({ data, timestamp: Date.now() });
  try {
    store.setItem(cacheKey(userId, key), serialized);
  } catch {
    // Storage is full: drop the oldest saved responses (never the pending-change queue) and retry once.
    try {
      evictOldestCache(userId, key);
      store.setItem(cacheKey(userId, key), serialized);
    } catch (e) {
      console.warn("[OfflineCache] Failed to cache data for key:", key, e);
    }
  }
}

/** Remove roughly the oldest third of this user's saved responses to free space. */
function evictOldestCache(userId: string, keepKey: string): void {
  const store = storage();
  if (!store) return;
  const prefix = `${CACHE_PREFIX}${userId}:`;
  const entries: { key: string; at: number }[] = [];
  for (let i = 0; i < store.length; i++) {
    const k = store.key(i);
    if (!k || !k.startsWith(prefix) || k === cacheKey(userId, keepKey)) continue;
    let at = 0;
    try {
      at = JSON.parse(store.getItem(k) || "{}")?.timestamp || 0;
    } catch {}
    entries.push({ key: k, at });
  }
  entries.sort((a, b) => a.at - b.at);
  entries.slice(0, Math.max(1, Math.ceil(entries.length / 3))).forEach((e) => store.removeItem(e.key));
}

/** When a saved response was stored (ms since epoch), or null. */
export function getCachedAt(key: string): number | null {
  const userId = getActiveOfflineUser();
  if (!userId) return null;
  try {
    const raw = storage()?.getItem(cacheKey(userId, key));
    return raw ? JSON.parse(raw)?.timestamp ?? null : null;
  } catch {
    return null;
  }
}

/**
 * Retrieve cached offline data
 */
export function getCachedOfflineData<T>(key: string, fallback: T | null = null): T | null {
  const userId = getActiveOfflineUser();
  if (!userId) return fallback;
  try {
    const raw = storage()?.getItem(cacheKey(userId, key));
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed?.data ?? fallback;
  } catch (e) {
    console.warn("[OfflineCache] Failed to read cache for key:", key, e);
    return fallback;
  }
}

/**
 * Get all pending offline mutations
 */
export function getQueuedMutations(): QueuedMutation[] {
  const userId = getActiveOfflineUser();
  if (!userId) return [];
  try {
    const raw = storage()?.getItem(queueKey(userId));
    if (!raw) return [];
    return JSON.parse(raw) || [];
  } catch (e) {
    console.warn("[OfflineQueue] Failed to read queue:", e);
    return [];
  }
}

/**
 * Save mutations to localStorage and dispatch update event
 */
function saveQueue(queue: QueuedMutation[]): void {
  const userId = getActiveOfflineUser();
  if (typeof window === "undefined" || !userId) return;
  try {
    storage()?.setItem(queueKey(userId), JSON.stringify(queue));
    window.dispatchEvent(
      new CustomEvent("faida-offline-queue-changed", {
        detail: { count: queue.length, queue },
      })
    );
  } catch (e) {
    console.warn("[OfflineQueue] Failed to save queue:", e);
  }
}

/**
 * Enqueue a mutation to be replayed when reconnected
 */
export function enqueueMutation(
  mutation: Omit<QueuedMutation, "id" | "timestamp" | "retryCount">
): QueuedMutation {
  const queue = getQueuedMutations();
  const newMutation: QueuedMutation = {
    id: `mut_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    ...mutation,
    timestamp: Date.now(),
    retryCount: 0,
  };

  // Collapse repeats only where that is safe: a repeated update to the same record is
  // merged into one request, and a repeated identical DELETE is dropped. Creates (POST)
  // are never collapsed, so several offline creations are all kept.
  let filtered = queue;
  const recordId = newMutation.body && typeof newMutation.body === "object" ? newMutation.body.id : undefined;
  if ((newMutation.method === "PATCH" || newMutation.method === "PUT") && recordId !== undefined) {
    const earlier = queue.find(
      (item) =>
        item.url === newMutation.url &&
        item.method === newMutation.method &&
        item.body &&
        typeof item.body === "object" &&
        item.body.id === recordId
    );
    if (earlier) {
      newMutation.body = { ...earlier.body, ...newMutation.body };
      filtered = queue.filter((item) => item !== earlier);
    }
  } else if (newMutation.method === "DELETE") {
    filtered = queue.filter((item) => !(item.url === newMutation.url && item.method === "DELETE"));
  }
  filtered = [...filtered, newMutation];

  saveQueue(filtered);
  return newMutation;
}

/**
 * Remove a specific mutation from queue
 */
export function removeQueuedMutation(id: string): void {
  const queue = getQueuedMutations();
  const filtered = queue.filter((m) => m.id !== id);
  saveQueue(filtered);
}

/**
 * Clear all queued mutations
 */
export function clearQueuedMutations(): void {
  saveQueue([]);
}

/**
 * Replay all queued mutations against the server, in order.
 * - 2xx: done. 404 on an update/delete: the record is gone, so treat as done.
 * - 401: the session expired. Stop and keep everything queued for the next sign-in.
 * - Other 4xx (except 408/429): the server rejected it permanently, so drop it and report it.
 * - 5xx / network errors: retry later (dropped after 5 failed attempts).
 */
let isSyncing = false;
export async function syncPendingMutations(): Promise<{
  synced: number;
  failed: number;
  dropped: number;
  total: number;
}> {
  const empty = (total: number) => ({ synced: 0, failed: 0, dropped: 0, total });
  if (isSyncing || !isOnline()) {
    return empty(getQueuedMutations().length);
  }

  const queue = getQueuedMutations();
  if (queue.length === 0) return empty(0);

  isSyncing = true;
  let synced = 0;
  let failed = 0;
  let dropped = 0;
  let remaining: QueuedMutation[] = [];

  try {
    // The queue belongs to the account recorded in this browser; make sure that is still
    // the account holding the session before replaying anything.
    const me = await fetch("/api/auth/me", { cache: "no-store" }).catch(() => null);
    if (!me || !me.ok) return empty(queue.length); // offline-ish or signed out: keep queue
    const meData = await me.json().catch(() => null);
    if (!meData?.user?.id) return empty(queue.length);
    if (meData.user.id !== getActiveOfflineUser()) {
      setActiveOfflineUser(meData.user.id);
      return empty(0);
    }

    window.dispatchEvent(new CustomEvent("faida-sync-started", { detail: { count: queue.length } }));

    for (let i = 0; i < queue.length; i++) {
      const item = queue[i];
      try {
        const res = await fetch(item.url, {
          method: item.method,
          headers: {
            "Content-Type": "application/json",
            ...(item.headers || {}),
          },
          body: item.body ? JSON.stringify(item.body) : undefined,
        });

        if (res.ok || (res.status === 404 && item.method !== "POST")) {
          synced++;
        } else if (res.status === 401) {
          remaining = queue.slice(i); // keep this and everything after it
          break;
        } else if (res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429) {
          dropped++;
        } else {
          item.retryCount += 1;
          failed++;
          if (item.retryCount < 5) remaining.push(item);
          else dropped++;
        }
      } catch {
        // Network trouble: keep this item and the rest, in order.
        remaining = [...remaining, ...queue.slice(i)];
        failed += queue.length - i;
        break;
      }
    }

    saveQueue(remaining);
    window.dispatchEvent(
      new CustomEvent("faida-sync-completed", {
        detail: { synced, failed, dropped, remaining: remaining.length },
      })
    );
    return { synced, failed, dropped, total: queue.length };
  } finally {
    isSyncing = false;
  }
}

// How long a page waits for the server before showing its saved copy instead.
const SLOW_NETWORK_MS = 7000;
// Keys whose fresh data arrived after the saved copy was already shown.
const justRefreshed = new Set<string>();

/**
 * Smart offline-aware fetch wrapper
 * - For GET: caches successful responses (per user); falls back to that cache when offline
 *   or when the server/network is unavailable
 * - For POST/PATCH/DELETE: executes if online, or queues the mutation (per user) and
 *   returns a simulated success if offline
 */
export async function offlineFetch(
  url: string,
  options?: RequestInit & { description?: string; cacheKey?: string; quiet?: boolean }
): Promise<any> {
  const method = (options?.method || "GET").toUpperCase();
  const cleanKey = options?.cacheKey || defaultCacheKey(url);

  const fromCache = () => {
    const cached = getCachedOfflineData(cleanKey);
    if (!cached) return null;
    return {
      ok: true,
      status: 200,
      json: async () => ({ ...(cached as object), _isOfflineCached: true, _cachedAt: getCachedAt(cleanKey) }),
    };
  };

  // 1. GET requests
  if (method === "GET") {
    if (isOnline()) {
      // Data that arrived late on the previous attempt is served once, straight from the saved
      // copy, so the page that refreshes itself after a slow load does not wait a second time.
      if (!options?.quiet && justRefreshed.delete(cleanKey)) {
        const fresh = fromCache();
        if (fresh) return fresh;
      }

      // A saved copy exists: do not keep the user waiting on a weak connection. Give the
      // network a few seconds, show what was saved, and let the request finish in the background
      // (the page then refreshes itself, see AppShell). With nothing saved, simply wait.
      const controller = new AbortController();
      // quiet = background warm-up: just wait for the real answer, never touch the page.
      const hasSaved = !options?.quiet && getCachedOfflineData(cleanKey) !== null;
      const hardLimit = setTimeout(() => controller.abort(), 60000);
      const request = fetch(url, { ...options, signal: options?.signal ?? controller.signal });
      try {
        let res: Response;
        if (hasSaved) {
          const first = await Promise.race([
            request,
            new Promise<null>((resolve) => setTimeout(() => resolve(null), SLOW_NETWORK_MS)),
          ]);
          if (first === null) {
            request
              .then(async (late) => {
                clearTimeout(hardLimit);
                if (!late.ok) return;
                const data = await late.clone().json().catch(() => null);
                if (data && data.success !== false) {
                  cacheOfflineData(cleanKey, data);
                  justRefreshed.add(cleanKey);
                  window.dispatchEvent(new CustomEvent("faida-cache-updated", { detail: { key: cleanKey } }));
                }
              })
              .catch(() => clearTimeout(hardLimit));
            const saved = fromCache();
            if (saved) return saved;
            res = await request; // saved copy vanished meanwhile: wait for the real answer
          } else {
            res = first;
          }
        } else {
          res = await request;
        }
        clearTimeout(hardLimit);
        if (res.ok) {
          res
            .clone()
            .json()
            .then((data) => {
              if (data && data.success !== false) cacheOfflineData(cleanKey, data);
            })
            .catch(() => {});
          return res;
        }
        // Server errors fall back to cached data; 4xx (e.g. 401) are real answers.
        if (res.status < 500) return res;
        const cached = fromCache();
        return cached ?? res;
      } catch (e) {
        clearTimeout(hardLimit);
        console.warn(`[offlineFetch] Network failed for ${url}, falling back to cache`);
      }
    }

    return (
      fromCache() ?? {
        ok: false,
        status: 503,
        json: async () => ({
          success: false,
          error: "Offline mode: No cached data available for this request.",
          offline: true,
        }),
      }
    );
  }

  // 2. Mutations (POST, PATCH, PUT, DELETE)
  let body: any = options?.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      body = undefined; // not JSON (e.g. multipart); cannot be queued
    }
  }

  const queueIt = (message: string) => {
    if (!getActiveOfflineUser() || (options?.body && body === undefined)) {
      return {
        ok: false,
        status: 503,
        json: async () => ({ success: false, offline: true, error: "You are offline. This action cannot be saved for later." }),
      };
    }
    enqueueMutation({
      url,
      method: method as QueuedMutation["method"],
      body,
      description: options?.description || describeMutation(method, url),
    });
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("faida-offline-saved", { detail: { message } }));
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({ success: true, offline: true, offlineQueued: true, message }),
    };
  };

  if (!isOnline()) {
    return queueIt("Saved offline. Will sync automatically when reconnected.");
  }

  try {
    return await fetch(url, options);
  } catch (e) {
    console.warn(`[offlineFetch] Mutation failed online, queueing for background retry:`, url);
    return queueIt("Queued offline mutation.");
  }
}

/** Default storage key for a GET: the API path plus its query string, so /api/calendar?month=... differs per month. */
export function defaultCacheKey(url: string): string {
  const [path, qs] = url.split("?");
  const base = path.replace(/^\/api\//, "");
  return qs ? `${base}?${qs}` : base;
}

const NOUNS: Record<string, string> = {
  finance: "finance entry",
  business: "business item",
  deliverables: "deliverable",
  clients: "client",
  metrics: "business metric",
  calendar: "calendar item",
  learning: "learning item",
  topics: "learning topic",
  sessions: "study session",
  maintenance: "maintenance item",
  projects: "project",
  university: "university item",
  tasks: "task",
  capture: "capture",
  entities: "capture",
  menu: "meal",
  shopping: "shopping item",
  notes: "note",
  files: "file",
  effort: "energy check-in",
};

function describeMutation(method: string, url: string): string {
  const parts = url.split("?")[0].replace(/^\/api\//, "").split("/").filter(Boolean);
  const noun = [...parts].reverse().map((p) => NOUNS[p]).find(Boolean) || parts[0] || "item";
  const verb = method === "POST" ? "Add" : method === "DELETE" ? "Delete" : "Update";
  return `${verb} ${noun}`;
}

const WARM_PREFIX = "faida_warm_at:";
const WARM_EVERY_MS = 20 * 60 * 1000;
let warming = false;

/**
 * Quietly downloads the data every page needs and stores it on this device, so each page
 * opens with real content even when the connection later drops. Runs at most every 20
 * minutes, one request at a time, and only while online and signed in. Credentials in the
 * Developer vault are deliberately never saved here.
 */
export async function warmOfflineCache(force = false): Promise<void> {
  const userId = getActiveOfflineUser();
  const store = storage();
  if (warming || !userId || !store || !isOnline()) return;

  const last = Number(store.getItem(WARM_PREFIX + userId) || 0);
  if (!force && Date.now() - last < WARM_EVERY_MS) return;

  warming = true;
  try {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const targets: [string, string?][] = [
      ["/api/tasks", "tasks"],
      ["/api/projects", "projects"],
      ["/api/finance"],
      ["/api/business"],
      ["/api/university/dashboard"],
      ["/api/university/assignments"],
      ["/api/university/classes"],
      [`/api/calendar?month=${month}`],
      ["/api/learning"],
      ["/api/maintenance"],
      ["/api/analytics"],
      ["/api/journal"],
      ["/api/entities/recent?limit=25"],
      ["/api/attention"],
      ["/api/shopping", "shopping_items"],
      ["/api/shopping/categories", "shopping_categories"],
      ["/api/menu", "weekly_menu"],
      ["/api/menu/ideas", "meal_ideas"],
    ];

    let projectIds: string[] = [];
    for (const [url, key] of targets) {
      if (!isOnline()) return;
      try {
        const res = await offlineFetch(url, { cache: "no-store", cacheKey: key, quiet: true });
        if (url === "/api/projects" && res?.ok) {
          const data = await res.json();
          projectIds = (data?.projects || []).map((p: any) => p?.id).filter(Boolean).slice(0, 12);
        }
      } catch {}
    }
    for (const id of projectIds) {
      if (!isOnline()) return;
      try {
        await offlineFetch(`/api/projects/${id}`, { cache: "no-store", quiet: true });
      } catch {}
    }
    store.setItem(WARM_PREFIX + userId, String(Date.now()));
  } finally {
    warming = false;
  }
}
