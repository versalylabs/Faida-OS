"use client";

import { useEffect } from "react";
import { syncPendingMutations, isOnline } from "@/lib/offlineSync";

export function ServiceWorkerRegister() {
  useEffect(() => {
    // 1. Register Service Worker
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          console.log("[ServiceWorker] Registered successfully with scope:", reg.scope);
        })
        .catch((err) => {
          console.warn("[ServiceWorker] Registration failed:", err);
        });
    }

    // 2. Handle connection status transitions
    const handleOnline = () => {
      console.log("[Connection] Back online. Synchronizing pending mutations...");
      window.dispatchEvent(new CustomEvent("faida-online-status-changed", { detail: { online: true } }));
      syncPendingMutations();
    };

    const handleOffline = () => {
      console.log("[Connection] Gone offline. Switching to offline cache & mutation queue.");
      window.dispatchEvent(new CustomEvent("faida-online-status-changed", { detail: { online: false } }));
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // 3. Periodic sync attempt if online and there are pending items
    const interval = setInterval(() => {
      if (isOnline()) {
        syncPendingMutations();
      }
    }, 30000);

    // Initial sync check on mount
    if (isOnline()) {
      syncPendingMutations();
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(interval);
    };
  }, []);

  return null;
}
