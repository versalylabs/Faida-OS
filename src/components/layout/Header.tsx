"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Bell, Search, Command, Keyboard, Menu, LogOut, User as UserIcon } from "lucide-react";
import { QuickCaptureModal } from "@/components/capture/QuickCaptureModal";
import { FaidaLogo, FaidaLogoIcon } from "@/components/brand/FaidaLogo";
import { OfflineStatusIndicator } from "@/components/offline/OfflineStatusIndicator";
import { clearOfflineData, getQueuedMutations, setActiveOfflineUser, syncPendingMutations } from "@/lib/offlineSync";

export function Header() {
  const router = useRouter();
  const [time, setTime] = useState<string>("");
  const [isCaptureModalOpen, setIsCaptureModalOpen] = useState(false);
  const [user, setUser] = useState<{ id: string; email: string; name?: string } | null>(null);
  const [attention, setAttention] = useState({
    urgentCount: 0,
    dueTodayCount: 0,
    informationalCount: 0,
  });

  const fetchAttention = async () => {
    try {
      const res = await fetch("/api/attention");
      const data = await res.json();
      if (data.success) {
        setAttention({
          urgentCount: data.urgentCount,
          dueTodayCount: data.dueTodayCount,
          informationalCount: data.informationalCount,
        });
      }
    } catch (e) {}
  };

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (res.status === 401) {
        // Cookie is present but the session is expired/revoked: clear it so the
        // middleware stops bouncing between /login and the dashboard.
        await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
        // Drop cached data now; pending changes stay queued for this account's next sign-in.
        await clearOfflineData();
        router.replace("/login");
        router.refresh();
        return;
      }
      if (res.ok) {
        const data = await res.json();
        if (data.user?.id) setActiveOfflineUser(data.user.id);
        setUser(data.user);
      }
    } catch (e) {}
  };

  const handleSignOut = async () => {
    try {
      // Try to push unsynced offline changes first; warn before discarding any that remain.
      await syncPendingMutations();
      const pending = getQueuedMutations().length;
      if (
        pending > 0 &&
        !confirm(`You have ${pending} unsynced offline change${pending === 1 ? "" : "s"} that will be lost if you sign out. Sign out anyway?`)
      ) {
        return;
      }
      await fetch("/api/auth/logout", { method: "POST" });
      await clearOfflineData({ includeQueue: true });
      router.push("/login");
      router.refresh();
    } catch (e) {
      console.error("Sign out failed", e);
    }
  };

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 15000); // the clock only shows minutes

    fetchAttention();
    fetchCurrentUser();
    // Refresh the badges once a minute, and only while the tab is visible
    const attentionInterval = setInterval(() => {
      if (document.visibilityState === "visible") fetchAttention();
    }, 60000);
    const onVisible = () => {
      if (document.visibilityState === "visible") fetchAttention();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(interval);
      clearInterval(attentionInterval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return (
    <>
      <header className="glass-bar h-14 rounded-2xl mx-3 md:mx-0 md:mr-3 mt-3 px-3 sm:px-4 flex items-center justify-between sticky top-3 z-40">
        {/* Mobile Menu Hamburger + Search Trigger */}
        <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0 max-w-xl">
          <button
            onClick={() => window.dispatchEvent(new CustomEvent("toggle-mobile-sidebar"))}
            className="md:hidden glass-orb h-9 w-9 text-slate-200 cursor-pointer shrink-0"
            title="Open Navigation"
          >
            <Menu className="h-4 w-4" />
          </button>

          {/* Header Logo Icon & Brand */}
          <div className="flex items-center shrink-0">
            <FaidaLogo size="xs" showText={false} className="sm:hidden" />
            <FaidaLogo size="sm" showText={true} className="hidden sm:flex md:hidden" />
            <div className="hidden md:flex items-center pr-1">
              <FaidaLogoIcon size={28} className="hover:scale-105 transition-transform" />
            </div>
          </div>

          <button
            onClick={() => setIsCaptureModalOpen(true)}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-full bg-slate-950/60 border border-white/10 text-xs text-slate-400 hover:text-slate-100 hover:border-white/25 transition-all w-full max-w-md group cursor-pointer text-left min-w-0"
          >
            <Search className="h-3.5 w-3.5 text-slate-400 group-hover:text-[#6ee7d0] transition-colors shrink-0" />
            <span className="flex-1 text-left truncate">
              <span className="hidden sm:inline">Quick capture or ask Faida anything...</span>
              <span className="sm:hidden">Capture or ask Faida...</span>
            </span>
            <div className="hidden sm:flex items-center gap-1 text-[10px] bg-white/10 px-1.5 py-0.5 rounded-md text-slate-300 border border-white/15 shrink-0">
              <Command className="h-2.5 w-2.5" /> K
            </div>
          </button>
        </div>

        {/* Right status & notifications & user */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 ml-2 shrink-0">
          {/* Offline Mode & Sync Indicator */}
          <OfflineStatusIndicator />

          {/* Unified Attention Indicators from DB */}
          <div className="flex items-center gap-1 sm:gap-2 text-xs font-mono">
            {attention.urgentCount > 0 && (
              <div className="flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-full border text-[10px] sm:text-[11px] bg-red-500/10 border-red-500/30 text-red-400 font-semibold animate-pulse">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                <span>{attention.urgentCount}</span>
                <span className="hidden sm:inline">urgent</span>
              </div>
            )}

            {attention.dueTodayCount > 0 && (
              <div className="flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-full border text-[10px] sm:text-[11px] bg-amber-500/10 border-amber-500/30 text-amber-400 font-semibold">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                <span>{attention.dueTodayCount}</span>
                <span className="hidden sm:inline">due</span>
              </div>
            )}
          </div>

          {/* Keyboard Shortcuts Trigger (Desktop only) */}
          <button
            onClick={() => window.dispatchEvent(new CustomEvent("toggle-shortcuts"))}
            className="hidden md:flex glass-orb h-8 w-8 text-slate-300 hover:text-white cursor-pointer"
            title="Keyboard Shortcuts (?)"
          >
            <Keyboard className="h-3.5 w-3.5" />
            
          </button>

          {/* Live Clock */}
          <div className="hidden lg:block text-xs font-semibold tabular-nums text-slate-200 px-3 py-1.5 rounded-full bg-white/[0.08] border border-white/10">
            {time || "00:00"}
          </div>

          {/* User Profile Chip & Sign Out */}
          {user && (
            <div className="flex items-center gap-1.5 pl-1.5 sm:pl-2 border-l border-white/10">
              <div className="flex items-center gap-1.5 pl-1 pr-3 py-1 rounded-full bg-white/[0.08] border border-white/10 text-xs">
                <div className="h-6 w-6 rounded-full bg-gradient-to-br from-[#7d8dfc] to-[#6ee7d0] flex items-center justify-center text-slate-950 font-bold text-[11px] shrink-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]">
                  {user.name ? user.name.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
                </div>
                <span className="text-slate-300 text-[11px] font-medium max-w-[90px] sm:max-w-[130px] truncate hidden xs:inline" title={user.email}>
                  {user.name || user.email.split("@")[0]}
                </span>
              </div>

              <button
                onClick={handleSignOut}
                className="glass-orb h-8 w-8 text-slate-300 hover:text-red-300 cursor-pointer"
                title={`Sign out (${user.email})`}
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Global Quick Capture Modal */}
      <QuickCaptureModal
        isOpen={isCaptureModalOpen}
        onClose={() => setIsCaptureModalOpen(false)}
        onCaptured={fetchAttention}
      />
    </>
  );
}
