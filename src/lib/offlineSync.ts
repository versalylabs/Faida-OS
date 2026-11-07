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
}

/** Remove cached API data (and the service worker's page cache). Pending changes are kept unless asked. */
export async function clearOfflineData(options: { includeQueue?: boolean } = {}): Promise<void> {
  const { includeQueue = false } = options;
  removeKeysWhere((key) => {
    if (LEGACY_PREFIXES.some((p) => key.startsWith(p))) return true;
    if (key.startsWith(CACHE_PREFIX)) return true;
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
  try {
    const payload = {
      data,
      timestamp: Date.now(),
    };
    storage()?.setItem(cacheKey(userId, key), JSON.stringify(payload));
  } catch (e) {
    console.warn("[OfflineCache] Failed to cache data for key:", key, e);
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

/**
 * Smart offline-aware fetch wrapper
 * - For GET: caches successful responses (per user); falls back to that cache when offline
 *   or when the server/network is unavailable
 * - For POST/PATCH/DELETE: executes if online, or queues the mutation (per user) and
 *   returns a simulated success if offline
 */
export async function offlineFetch(
  url: string,
  options?: RequestInit & { description?: string; cacheKey?: string }
): Promise<any> {
  const method = (options?.method || "GET").toUpperCase();
  const cleanKey = options?.cacheKey || url.split("?")[0].replace(/^\/api\//, "");

  const fromCache = () => {
    const cached = getCachedOfflineData(cleanKey);
    if (!cached) return null;
    return {
      ok: true,
      status: 200,
      json: async () => ({ ...(cached as object), _isOfflineCached: true }),
    };
  };

  // 1. GET requests
  if (method === "GET") {
    if (isOnline()) {
      try {
        const res = await fetch(url, options);
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
      description: options?.description || `${method} to ${url}`,
    });
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
