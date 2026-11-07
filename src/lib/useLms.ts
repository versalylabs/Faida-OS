"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getCachedOfflineData, isOnline, offlineFetch } from "@/lib/offlineSync";
import type { AttentionItem, UnitProgress } from "@/lib/lms/progress";

export type LmsAttentionRow = AttentionItem & { courseCode: string | null; courseColor: string | null };

export interface LmsFeedRow {
  id: string;
  type: "NEW_ITEM" | "SUBMITTED" | "GRADED" | "DUE_CHANGED" | "ANNOUNCEMENT" | "NEW_MATERIAL" | string;
  title: string;
  detail: string | null;
  url: string | null;
  occurredAt: string;
  unread: boolean;
  courseCode: string | null;
}

export interface LmsOverviewData {
  connected: boolean;
  connection?: {
    baseUrl: string;
    status: "ACTIVE" | "INVALID" | "ERROR" | string;
    lastError: string | null;
    lastSyncAt: string | null;
    studentName: string | null;
    firstSyncPending: boolean;
  };
  units?: UnitProgress[];
  attention?: { missed: LmsAttentionRow[]; dueSoon: LmsAttentionRow[] };
  classesSoon?: { id: string; courseId: string | null; title: string; url: string | null; startsAt: string; courseCode: string | null }[];
  feed?: LmsFeedRow[];
  unreadCount?: number;
  _isOfflineCached?: boolean;
  _cachedAt?: number | null;
}

const CACHE_KEY = "lms";

/** Loads the LMS overview (saved copy first, so it opens instantly and works offline). */
export function useLms(onChanged?: () => void) {
  const [data, setData] = useState<LmsOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const changed = useRef(onChanged);
  changed.current = onChanged;

  // `patient` is used right after the student did something (sync, hide, mark read): they expect to
  // see the result, so wait longer for the server instead of showing the older saved copy.
  const load = useCallback(async (patient = false) => {
    try {
      const res = await offlineFetch("/api/lms", { cache: "no-store", cacheKey: CACHE_KEY, ...(patient ? { waitMs: 25000 } : {}) });
      const json = await res.json();
      if (json?.success) setData(json);
    } catch {
      /* the saved copy (if any) stays on screen */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const saved = getCachedOfflineData<LmsOverviewData>(CACHE_KEY);
    if (saved) {
      setData(saved);
      setLoading(false);
    }
    load();
    // The quiet background check can finish while this page is open.
    const onSynced = () => load(true);
    window.addEventListener("faida-lms-synced", onSynced);
    return () => window.removeEventListener("faida-lms-synced", onSynced);
  }, [load]);

  const sync = useCallback(async () => {
    if (!isOnline()) {
      setNotice("You are offline. Sync needs a connection; your saved data is shown.");
      return;
    }
    setSyncing(true);
    setNotice(null);
    try {
      const res = await fetch("/api/lms/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const json = await res.json();
      if (json.success) {
        const s = json.summary || {};
        setNotice(
          s.skipped === "running"
            ? "A sync is already running."
            : s.firstSync
            ? `Connected: ${s.courses ?? 0} units and ${s.items ?? 0} items read. New activity will show here from now on.`
            : s.activities
            ? `Synced: ${s.activities} new update${s.activities === 1 ? "" : "s"}.`
            : "Synced: nothing new."
        );
        await load(true);
        changed.current?.();
      } else {
        setNotice(json.error || "Sync failed.");
        await load(true);
      }
    } catch {
      setNotice("Could not reach the server. Try again in a moment.");
    } finally {
      setSyncing(false);
    }
  }, [load]);

  const act = useCallback(
    async (body: Record<string, unknown>) => {
      if (!isOnline()) {
        setNotice("That needs a connection.");
        return;
      }
      await fetch("/api/lms", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      await load(true);
    },
    [load]
  );

  const disconnect = useCallback(async () => {
    if (!isOnline()) {
      setNotice("Disconnecting needs a connection.");
      return;
    }
    await fetch("/api/lms", { method: "DELETE" });
    await load(true);
  }, [load]);

  return {
    data,
    loading,
    syncing,
    notice,
    setNotice,
    reload: () => load(true),
    sync,
    markAllRead: () => act({ action: "markAllRead" }),
    dismiss: (itemId: string, dismissed = true) => act({ action: "dismiss", itemId, dismissed }),
    disconnect,
  };
}

export type LmsController = ReturnType<typeof useLms>;
