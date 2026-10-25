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

const CACHE_PREFIX = "faida_cache_";
const QUEUE_KEY = "faida_offline_mutations";

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
  if (typeof window === "undefined") return;
  try {
    const payload = {
      data,
      timestamp: Date.now(),
    };
    window.localStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(payload));
  } catch (e) {
    console.warn("[OfflineCache] Failed to cache data for key:", key, e);
  }
}

/**
 * Retrieve cached offline data
 */
export function getCachedOfflineData<T>(key: string, fallback: T | null = null): T | null {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(`${CACHE_PREFIX}${key}`);
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
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(QUEUE_KEY);
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
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
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

  // If identical mutation exists for the same url & id (e.g. repeated toggle of the same task), replace it
  const filtered = queue.filter(
    (item) => !(item.url === newMutation.url && item.method === newMutation.method)
  );
  filtered.push(newMutation);

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
 * Replay all queued mutations against the server
 */
let isSyncing = false;
export async function syncPendingMutations(): Promise<{
  synced: number;
  failed: number;
  total: number;
}> {
  if (isSyncing || !isOnline()) {
    return { synced: 0, failed: 0, total: getQueuedMutations().length };
  }

  const queue = getQueuedMutations();
  if (queue.length === 0) {
    return { synced: 0, failed: 0, total: 0 };
  }

  isSyncing = true;
  window.dispatchEvent(
    new CustomEvent("faida-sync-started", {
      detail: { count: queue.length },
    })
  );

  let synced = 0;
  let failed = 0;
  const remaining: QueuedMutation[] = [];

  for (const item of queue) {
    try {
      const res = await fetch(item.url, {
        method: item.method,
        headers: {
          "Content-Type": "application/json",
          ...(item.headers || {}),
        },
        body: item.body ? JSON.stringify(item.body) : undefined,
      });

      if (res.ok || res.status === 404) {
        // If success or resource no longer exists, consider synced
        synced++;
      } else {
        item.retryCount += 1;
        if (item.retryCount < 5) {
          remaining.push(item);
        }
        failed++;
      }
    } catch (e) {
      item.retryCount += 1;
      remaining.push(item);
      failed++;
    }
  }

  saveQueue(remaining);
  isSyncing = false;

  window.dispatchEvent(
    new CustomEvent("faida-sync-completed", {
      detail: { synced, failed, remaining: remaining.length },
    })
  );

  return { synced, failed, total: queue.length };
}

/**
 * Smart offline-aware fetch wrapper
 * - For GET: caches successful responses; returns cached response if offline or failed
 * - For POST/PATCH/DELETE: executes if online, or queues mutation and returns simulated success if offline
 */
export async function offlineFetch(
  url: string,
  options?: RequestInit & { description?: string; cacheKey?: string }
): Promise<any> {
  const method = (options?.method || "GET").toUpperCase();
  const cleanKey = options?.cacheKey || url.split("?")[0].replace(/^\/api\//, "");

  // 1. GET requests
  if (method === "GET") {
    if (isOnline()) {
      try {
        const res = await fetch(url, options);
        if (res.ok) {
          const clone = res.clone();
          clone
            .json()
            .then((data) => {
              if (data && data.success !== false) {
                cacheOfflineData(cleanKey, data);
              }
            })
            .catch(() => {});
        }
        return res;
      } catch (e) {
        console.warn(`[offlineFetch] Network failed for ${url}, falling back to cache`);
      }
    }

    // Offline or Network failed: try cache
    const cached = getCachedOfflineData(cleanKey);
    if (cached) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ ...cached, _isOfflineCached: true }),
      };
    }

    // Nothing in cache and offline, throw or return standard error
    return {
      ok: false,
      status: 503,
      json: async () => ({
        success: false,
        error: "Offline mode: No cached data available for this request.",
        offline: true,
      }),
    };
  }

  // 2. Mutations (POST, PATCH, PUT, DELETE)
  const body =
    options?.body && typeof options.body === "string"
      ? JSON.parse(options.body)
      : options?.body;

  if (!isOnline()) {
    enqueueMutation({
      url,
      method: method as any,
      body,
      description: options?.description || `${method} to ${url}`,
    });

    return {
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        offline: true,
        offlineQueued: true,
        message: "Saved offline. Will sync automatically when reconnected.",
      }),
    };
  }

  try {
    const res = await fetch(url, options);
    return res;
  } catch (e) {
    console.warn(`[offlineFetch] Mutation failed online, queueing for background retry:`, url);
    enqueueMutation({
      url,
      method: method as any,
      body,
      description: options?.description || `${method} to ${url}`,
    });

    return {
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        offline: true,
        offlineQueued: true,
        message: "Queued offline mutation.",
      }),
    };
  }
}
