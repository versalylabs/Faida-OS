"use client";

import { useState, useEffect, useRef } from "react";
import { Sparkles, ArrowRight, X, Check, Loader2, Command } from "lucide-react";

interface QuickCaptureModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  onCaptured?: () => void;
}

export function QuickCaptureModal({ isOpen: controlledIsOpen, onClose, onCaptured }: QuickCaptureModalProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [text, setText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isModalOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalOpen;

  const handleClose = () => {
    if (onClose) onClose();
    setInternalOpen(false);
    setText("");
    setFeedback(null);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle modal on Ctrl+K or Cmd+K
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setInternalOpen((prev) => !prev);
        setFeedback(null);
      }
      // Close on Escape
      if (e.key === "Escape" && isModalOpen) {
        handleClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isModalOpen]);

  useEffect(() => {
    if (isModalOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isModalOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setFeedback(null);

    try {
      const res = await fetch("/api/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: text.trim() }),
      });

      const data = await res.json();
      if (data.success) {
        setFeedback(`Saved as ${data.parsed.type}: "${data.parsed.title}"`);
        setText("");
        if (onCaptured) onCaptured();
        setTimeout(() => {
          handleClose();
        }, 1200);
      } else {
        setFeedback("Error: " + (data.error || "Failed to capture"));
      }
    } catch (err: any) {
      setFeedback("Network error");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 sm:pt-20 px-3 sm:px-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="fixed inset-0"
        onClick={handleClose}
      />
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden z-10">
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between px-3.5 sm:px-4 py-2.5 sm:py-3 border-b border-slate-800 bg-slate-950/50 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-blue-400" />
            <span className="font-semibold text-slate-200">Universal Capture</span>
            <span className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1.5 py-0.2 rounded font-mono">
              AI
            </span>
          </div>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-slate-800 rounded-md text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="p-3.5 sm:p-4">
          <div className="relative flex items-center">
            <input
              ref={inputRef}
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Dump anything: task, note, KES expense..."
              className="w-full bg-slate-950 border border-slate-700 focus:border-blue-500 rounded-xl py-3 sm:py-3.5 pl-3.5 sm:pl-4 pr-24 sm:pr-28 text-xs sm:text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
              disabled={isSubmitting}
            />
            <button
              type="submit"
              disabled={!text.trim() || isSubmitting}
              className="absolute right-1.5 sm:right-2 px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1 sm:gap-1.5 shadow-md shadow-blue-500/20 cursor-pointer transition-all"
            >
              {isSubmitting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <>
                  <span>Capture</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </>
              )}
            </button>
          </div>

          {/* Feedback indicator */}
          {feedback && (
            <div className="mt-3 p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300 flex items-center gap-2 animate-in fade-in">
              <Check className="h-3.5 w-3.5 text-blue-400 shrink-0" />
              <span className="truncate">{feedback}</span>
            </div>
          )}

          {/* Helper Tips */}
          <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-[10px] sm:text-[11px] text-slate-500">
            <span className="truncate">
              Examples: <strong className="text-slate-400">&quot;Spent KES 2,500 on groceries&quot;</strong>
            </span>
            <span className="hidden sm:flex items-center gap-1 font-mono shrink-0">
              <kbd className="px-1 py-0.5 rounded bg-slate-800 border border-slate-700 text-[9px]">ESC</kbd> to close
            </span>
          </div>
        </form>
      </div>
    </div>
  );
}
