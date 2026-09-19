"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Keyboard, X, Sparkles, Navigation, Zap, Cpu } from "lucide-react";

interface ShortcutGroup {
  title: string;
  shortcuts: { keys: string[]; description: string }[];
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: "Global Actions",
    shortcuts: [
      { keys: ["Ctrl", "K"], description: "Universal Quick Capture (AI auto-route)" },
      { keys: ["?"], description: "Open Keyboard Shortcuts reference" },
      { keys: ["Esc"], description: "Close modals, drawers, or focus" },
    ],
  },
  {
    title: "Quick Navigation (Press G, then Key)",
    shortcuts: [
      { keys: ["G", "H"], description: "Go to Command Center (Home)" },
      { keys: ["G", "P"], description: "Go to Daily Planner" },
      { keys: ["G", "T"], description: "Go to Tasks & Todos" },
      { keys: ["G", "F"], description: "Go to Personal Finance (KES)" },
      { keys: ["G", "L"], description: "Go to Lazy Mode (Effort Engine)" },
      { keys: ["G", "D"], description: "Go to Developer Hub" },
      { keys: ["G", "X"], description: "Go to Smart File Organizer" },
      { keys: ["G", "K"], description: "Go to Knowledge Base" },
      { keys: ["G", "S"], description: "Go to Smart Shopping" },
      { keys: ["G", "A"], description: "Go to Analytics & Journal" },
    ],
  },
  {
    title: "Faida Autonomous AI Assistant",
    shortcuts: [
      { keys: ["Ask Faida AI"], description: "Floating button bottom-right" },
      { keys: ["Prompt"], description: "\"Good morning\" for daily mission briefing" },
      { keys: ["Prompt"], description: "\"Spent KES [amount] on [item]\" logs expense" },
      { keys: ["Prompt"], description: "\"Break down goal: [title]\" creates sub-tasks" },
      { keys: ["Prompt"], description: "\"I have 20m & low energy\" pulls quick wins" },
    ],
  },
];

export function ShortcutsModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Modal Header */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center gap-2 sm:gap-2.5">
            <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
              <Keyboard className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-xs sm:text-sm font-bold text-slate-100">
                Faida OS Keyboard Shortcuts
              </h2>
              <p className="text-[10px] sm:text-[11px] text-slate-400">
                Navigate and capture at the speed of thought
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-3.5 sm:p-6 overflow-y-auto space-y-4 sm:space-y-6 text-xs">
          {SHORTCUT_GROUPS.map((group, idx) => (
            <div key={idx} className="space-y-2">
              <h3 className="text-[10px] sm:text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
                {group.title}
              </h3>
              <div className="rounded-xl border border-slate-800 divide-y divide-slate-800/60 bg-slate-950/40">
                {group.shortcuts.map((s, sIdx) => (
                  <div
                    key={sIdx}
                    className="px-3 sm:px-3.5 py-2 sm:py-2.5 flex items-center justify-between gap-2 text-slate-300"
                  >
                    <span className="text-slate-300 font-medium text-[11px] sm:text-xs truncate">{s.description}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      {s.keys.map((k, kIdx) => (
                        <kbd
                          key={kIdx}
                          className="px-1.5 sm:px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-[9px] sm:text-[10px] font-mono font-semibold text-slate-200 shadow-sm"
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Modal Footer */}
        <div className="px-4 sm:px-6 py-2.5 sm:py-3 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-[10px] sm:text-[11px] text-slate-400">
          <span className="truncate mr-2">Tip: Press <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-slate-300">?</kbd> anywhere</span>
          <button
            onClick={onClose}
            className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium cursor-pointer shrink-0"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}

export function GlobalShortcutsHandler() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [gPressed, setGPressed] = useState(false);

  useEffect(() => {
    let timer: NodeJS.Timeout;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger when user is typing in form controls
      const activeTag = document.activeElement?.tagName?.toLowerCase();
      if (
        activeTag === "input" ||
        activeTag === "textarea" ||
        document.activeElement?.getAttribute("contenteditable") === "true"
      ) {
        return;
      }

      // '?' key toggles shortcut dialog
      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        e.preventDefault();
        setIsOpen((prev) => !prev);
        return;
      }

      // 'Esc' closes dialog
      if (e.key === "Escape") {
        setIsOpen(false);
        setGPressed(false);
        return;
      }

      // 'g' key sequence handler (like Gmail/GitHub)
      if (e.key.toLowerCase() === "g" && !e.ctrlKey && !e.metaKey && !gPressed) {
        setGPressed(true);
        clearTimeout(timer);
        timer = setTimeout(() => setGPressed(false), 1500);
        return;
      }

      if (gPressed) {
        setGPressed(false);
        clearTimeout(timer);
        const k = e.key.toLowerCase();
        switch (k) {
          case "h":
            router.push("/");
            break;
          case "p":
            router.push("/planner");
            break;
          case "t":
            router.push("/tasks");
            break;
          case "f":
            router.push("/finance");
            break;
          case "l":
            router.push("/lazy");
            break;
          case "d":
            router.push("/developer");
            break;
          case "x":
            router.push("/files");
            break;
          case "k":
            router.push("/knowledge");
            break;
          case "s":
            router.push("/shopping");
            break;
          case "a":
            router.push("/analytics");
            break;
        }
      }
    };

    const handleToggleCustom = () => {
      setIsOpen((prev) => !prev);
    };

    window.addEventListener("toggle-shortcuts" as any, handleToggleCustom);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("toggle-shortcuts" as any, handleToggleCustom);
      window.removeEventListener("keydown", handleKeyDown);
      clearTimeout(timer);
    };
  }, [gPressed, router]);

  return (
    <>
      <ShortcutsModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
