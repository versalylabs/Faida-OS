"use client";

import { useEffect } from "react";
import { syncPendingMutations, isOnline, getActiveOfflineUser, warmOfflineCache, offlineFetch } from "@/lib/offlineSync";

export function ServiceWorkerRegister() {
  useEffect(() => {
    const supported = typeof window !== "undefined" && "serviceWorker" in navigator;
    const production = process.env.NODE_ENV === "production";

    // 1. Register the service worker (production only: in development its cache would serve stale code).
    if (supported && !production) {
      navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()));
      if (typeof caches !== "undefined") caches.keys().then((names) => names.forEach((n) => caches.delete(n)));
    } else if (supported) {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        console.warn("[ServiceWorker] Registration failed:", err);
      });
    }

    // 2. Once signed in and online, save every page and the data behind it for offline use.
    let prepareTimer: ReturnType<typeof setTimeout> | undefined;
    const prepareOffline = () => {
      if (!isOnline() || !getActiveOfflineUser()) return;
      clearTimeout(prepareTimer);
      // Wait a moment so this never competes with the page the user just opened.
      prepareTimer = setTimeout(async () => {
        if (supported && production) {
          try {
            const reg = await navigator.serviceWorker.ready;
            reg.active?.postMessage({ type: "PRECACHE_PAGES" });
          } catch {}
        }
        // Quietly refresh the LMS if it has been more than 8 hours (the server decides). It runs
        // alongside the offline warm-up, and the saved LMS summary is refreshed once it finishes.
        try {
          const last = Number(localStorage.getItem("faida_lms_auto_at") || 0);
          if (Date.now() - last > 30 * 60 * 1000) {
            localStorage.setItem("faida_lms_auto_at", String(Date.now()));
            fetch("/api/lms/sync", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ auto: true }),
            })
              .then((r) => r.json())
              .then((j) => {
                if (j?.success && j.summary && !j.summary.skipped) {
                  offlineFetch("/api/lms", { cache: "no-store", cacheKey: "lms", quiet: true }).catch(() => {});
                  window.dispatchEvent(new CustomEvent("faida-lms-synced"));
                }
              })
              .catch(() => {});
          }
        } catch {}
        warmOfflineCache();
      }, 4000);
    };

    // 3. Handle connection status transitions
    const handleOnline = () => {
      window.dispatchEvent(new CustomEvent("faida-online-status-changed", { detail: { online: true } }));
      syncPendingMutations().finally(prepareOffline);
    };

    const handleOffline = () => {
      window.dispatchEvent(new CustomEvent("faida-online-status-changed", { detail: { online: false } }));
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("faida-user-ready", prepareOffline);

    // 4. Periodic sync attempt if online and there are pending items
    const interval = setInterval(() => {
      if (isOnline()) {
        syncPendingMutations();
      }
    }, 30000);

    // Initial checks on mount
    if (isOnline()) {
      syncPendingMutations();
      prepareOffline();
    }

    return () => {
      clearTimeout(prepareTimer);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("faida-user-ready", prepareOffline);
      clearInterval(interval);
    };
  }, []);

  return null;
}
