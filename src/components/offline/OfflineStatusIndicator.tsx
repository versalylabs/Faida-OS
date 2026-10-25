"use client";

import { useState, useEffect } from "react";
import {
  WifiOff,
  Wifi,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  X,
  Layers,
  Clock,
  Trash2,
} from "lucide-react";
import {
  isOnline,
  getQueuedMutations,
  syncPendingMutations,
  clearQueuedMutations,
  QueuedMutation,
} from "@/lib/offlineSync";

export function OfflineStatusIndicator() {
  const [online, setOnline] = useState<boolean>(true);
  const [queuedMutations, setQueuedMutations] = useState<QueuedMutation[]>([]);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [showSyncedSuccess, setShowSyncedSuccess] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  useEffect(() => {
    setOnline(isOnline());
    setQueuedMutations(getQueuedMutations());

    const handleStatusChange = (e: any) => {
      setOnline(e.detail?.online ?? isOnline());
    };

    const handleQueueChange = (e: any) => {
      setQueuedMutations(e.detail?.queue || getQueuedMutations());
    };

    const handleSyncStart = () => {
      setIsSyncing(true);
      setShowSyncedSuccess(false);
    };

    const handleSyncDone = (e: any) => {
      setIsSyncing(false);
      setQueuedMutations(getQueuedMutations());
      if (e.detail?.synced > 0) {
        setShowSyncedSuccess(true);
        setTimeout(() => setShowSyncedSuccess(false), 3500);
      }
    };

    window.addEventListener("faida-online-status-changed", handleStatusChange);
    window.addEventListener("faida-offline-queue-changed", handleQueueChange);
    window.addEventListener("faida-sync-started", handleSyncStart);
    window.addEventListener("faida-sync-completed", handleSyncDone);

    return () => {
      window.removeEventListener("faida-online-status-changed", handleStatusChange);
      window.removeEventListener("faida-offline-queue-changed", handleQueueChange);
      window.removeEventListener("faida-sync-started", handleSyncStart);
      window.removeEventListener("faida-sync-completed", handleSyncDone);
    };
  }, []);

  const handleManualSync = async () => {
    setIsSyncing(true);
    await syncPendingMutations();
    setIsSyncing(false);
  };

  const handleClear = () => {
    if (confirm("Are you sure you want to clear the pending offline actions queue?")) {
      clearQueuedMutations();
      setQueuedMutations([]);
    }
  };

  // If online, not syncing, no queue, and no recent sync, render nothing in the header
  if (online && queuedMutations.length === 0 && !isSyncing && !showSyncedSuccess) {
    return null;
  }

  return (
    <>
      {/* HEADER PILL */}
      <div className="flex items-center">
        {isSyncing ? (
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-[11px] font-mono font-medium animate-pulse cursor-pointer"
            title="Syncing pending changes with cloud"
          >
            <RefreshCw className="h-3 w-3 animate-spin" />
            <span>Syncing ({queuedMutations.length})...</span>
          </button>
        ) : showSyncedSuccess ? (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-mono font-medium animate-in fade-in">
            <CheckCircle2 className="h-3 w-3" />
            <span>Changes Synced</span>
          </div>
        ) : !online ? (
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[11px] font-mono font-semibold hover:bg-amber-500/20 transition-all cursor-pointer"
            title="Click to view offline queue & sync options"
          >
            <WifiOff className="h-3 w-3" />
            <span>Offline</span>
            {queuedMutations.length > 0 && (
              <span className="bg-amber-500 text-slate-950 font-bold px-1.5 py-0.2 rounded-full text-[9px]">
                {queuedMutations.length}
              </span>
            )}
          </button>
        ) : queuedMutations.length > 0 ? (
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300 text-[11px] font-mono font-medium hover:border-slate-600 transition-all cursor-pointer"
          >
            <Layers className="h-3 w-3 text-blue-400" />
            <span>{queuedMutations.length} queued</span>
          </button>
        ) : null}
      </div>

      {/* OFFLINE DETAILS MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-5 sm:p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                {!online ? (
                  <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
                    <WifiOff className="h-4 w-4" />
                  </div>
                ) : (
                  <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                    <Wifi className="h-4 w-4" />
                  </div>
                )}
                <div>
                  <h3 className="text-sm font-bold text-white">
                    {!online ? "Offline Mode Active" : "Online & Connected"}
                  </h3>
                  <span className="text-[10px] text-slate-400">
                    {!online
                      ? "Actions are saved locally and will sync when online"
                      : "Cloud connection healthy"}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Description */}
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-300 space-y-1.5">
              <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                Offline Capability Enabled
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                You can mark tasks done, check off shopping items, track meals, and create notes while offline.
                All updates update optimistically in your UI and queue for automatic synchronization.
              </p>
            </div>

            {/* Pending actions list */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-300">
                  Pending Offline Queue ({queuedMutations.length})
                </span>
                {queuedMutations.length > 0 && (
                  <button
                    onClick={handleClear}
                    className="text-[10px] text-rose-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="h-3 w-3" />
                    <span>Clear queue</span>
                  </button>
                )}
              </div>

              {queuedMutations.length === 0 ? (
                <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800/80 text-center text-xs text-slate-500">
                  No pending offline actions. Everything is synchronized!
                </div>
              ) : (
                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 text-xs">
                  {queuedMutations.map((m) => (
                    <div
                      key={m.id}
                      className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between text-[11px]"
                    >
                      <div className="min-w-0 pr-2">
                        <span className="font-semibold text-slate-200 block truncate">
                          {m.description || `${m.method} ${m.url}`}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {new Date(m.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 font-mono text-[9px] text-amber-400 uppercase shrink-0">
                        Pending
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              <span className="text-[10px] text-slate-400 font-mono">
                Auto-syncs on reconnection
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 rounded-xl text-slate-400 hover:text-slate-200 text-xs"
                >
                  Close
                </button>
                <button
                  onClick={handleManualSync}
                  disabled={!online || isSyncing || queuedMutations.length === 0}
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 shadow-lg shadow-emerald-600/20 cursor-pointer"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? "animate-spin" : ""}`} />
                  <span>{isSyncing ? "Syncing..." : "Sync Now"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
