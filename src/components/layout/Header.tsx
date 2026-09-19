"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Bell, Search, Command, Keyboard, Menu, LogOut, User as UserIcon } from "lucide-react";
import { QuickCaptureModal } from "@/components/capture/QuickCaptureModal";

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
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      }
    } catch (e) {}
  };

  const handleSignOut = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
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
    const interval = setInterval(updateTime, 1000);

    fetchAttention();
    fetchCurrentUser();
    const attentionInterval = setInterval(fetchAttention, 15000);

    return () => {
      clearInterval(interval);
      clearInterval(attentionInterval);
    };
  }, []);

  return (
    <>
      <header className="h-16 border-b border-slate-800/80 bg-slate-950/40 backdrop-blur-md px-3 sm:px-4 md:px-6 flex items-center justify-between sticky top-0 z-40 w-full">
        {/* Mobile Menu Hamburger + Search Trigger */}
        <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0 max-w-xl">
          <button
            onClick={() => window.dispatchEvent(new CustomEvent("toggle-mobile-sidebar"))}
            className="md:hidden p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer shrink-0"
            title="Open Navigation"
          >
            <Menu className="h-4 w-4" />
          </button>

          <button
            onClick={() => setIsCaptureModalOpen(true)}
            className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-400 hover:text-slate-200 hover:border-slate-700 transition-all w-full max-w-md group cursor-pointer text-left min-w-0"
          >
            <Search className="h-3.5 w-3.5 text-slate-400 group-hover:text-blue-400 transition-colors shrink-0" />
            <span className="flex-1 text-left truncate">
              <span className="hidden sm:inline">Quick capture or ask Faida anything...</span>
              <span className="sm:hidden">Capture or ask Faida...</span>
            </span>
            <div className="hidden sm:flex items-center gap-1 text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-400 border border-slate-700 shrink-0">
              <Command className="h-2.5 w-2.5" /> K
            </div>
          </button>
        </div>

        {/* Right status & notifications & user */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 ml-2 shrink-0">
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
            className="hidden md:flex items-center gap-1 text-slate-400 hover:text-slate-200 p-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors cursor-pointer"
            title="Keyboard Shortcuts (?)"
          >
            <Keyboard className="h-3.5 w-3.5" />
            <span className="text-[10px] font-mono text-slate-500">?</span>
          </button>

          {/* Live Clock */}
          <div className="hidden lg:block text-xs font-mono font-medium text-slate-300 px-2.5 py-1 rounded bg-slate-900 border border-slate-800">
            {time || "00:00"}
          </div>

          {/* User Profile Chip & Sign Out */}
          {user && (
            <div className="flex items-center gap-1.5 pl-1.5 sm:pl-2 border-l border-slate-800">
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-900/90 border border-slate-800 text-xs">
                <div className="h-5 w-5 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-[10px] shrink-0">
                  {user.name ? user.name.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
                </div>
                <span className="text-slate-300 text-[11px] font-medium max-w-[90px] sm:max-w-[130px] truncate hidden xs:inline" title={user.email}>
                  {user.name || user.email.split("@")[0]}
                </span>
              </div>

              <button
                onClick={handleSignOut}
                className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-red-500/40 text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
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
