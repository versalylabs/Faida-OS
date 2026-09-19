"use client";

import { useState, useEffect } from "react";
import {
  Sparkles,
  ArrowRight,
  Trash2,
  Loader2,
  Calendar,
  CheckSquare,
  BookOpen,
  Wallet,
  ShoppingCart,
  Clock,
  Tag,
} from "lucide-react";
import { formatKES, formatDate } from "@/lib/utils";

interface EntityItem {
  id: string;
  type: string;
  title: string;
  content?: string | null;
  priority?: string | null;
  status?: string | null;
  metadata?: string | null;
  createdAt: string;
  task?: { priority: string; estimatedMinutes: number; dueDate?: string | null } | null;
  reminder?: { dueAt: string; escalationState: string } | null;
  note?: { category?: string | null; tags?: string | null } | null;
}

export default function CapturePage() {
  const [input, setInput] = useState("");
  const [isCapturing, setIsCapturing] = useState(false);
  const [entities, setEntities] = useState<EntityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);

  const fetchEntities = async () => {
    try {
      const res = await fetch("/api/entities/recent?limit=25");
      const data = await res.json();
      if (data.success) {
        setEntities(data.entities);
      }
    } catch (err) {
      console.error("Failed to load entities:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEntities();
  }, []);

  const handleCapture = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isCapturing) return;

    setIsCapturing(true);
    setFeedback(null);

    try {
      const res = await fetch("/api/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: input.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setFeedback(`Captured as ${data.parsed.type}: "${data.parsed.title}"`);
        setInput("");
        await fetchEntities();
        setTimeout(() => setFeedback(null), 4000);
      } else {
        setFeedback("Failed: " + data.error);
      }
    } catch (err) {
      setFeedback("Network error occurred.");
    } finally {
      setIsCapturing(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/entities/recent?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setEntities(entities.filter((e) => e.id !== id));
      }
    } catch (err) {
      console.error("Failed to delete entity:", err);
    }
  };

  const quickExamples = [
    "Remind me to renew domain next Friday at 9am",
    "Meeting with James tomorrow at 3pm",
    "Buy toothpaste and HDMI cable",
    "Idea: restaurant inventory forecasting system",
    "PostgreSQL uses MVCC to handle concurrent transactions",
    "Spent KES 2,500 on groceries and fruit",
    "Finish reservation validation for Melio priority high",
  ];

  const getEntityIcon = (type: string) => {
    switch (type) {
      case "TASK":
        return <CheckSquare className="h-4 w-4 text-blue-400" />;
      case "REMINDER":
        return <Clock className="h-4 w-4 text-amber-400" />;
      case "EVENT":
        return <Calendar className="h-4 w-4 text-purple-400" />;
      case "SHOPPING":
        return <ShoppingCart className="h-4 w-4 text-emerald-400" />;
      case "FINANCE":
        return <Wallet className="h-4 w-4 text-green-400" />;
      case "NOTE":
      case "KNOWLEDGE":
        return <BookOpen className="h-4 w-4 text-cyan-400" />;
      default:
        return <Sparkles className="h-4 w-4 text-slate-400" />;
    }
  };

  const getEntityBadgeStyle = (type: string) => {
    switch (type) {
      case "TASK":
        return "bg-blue-500/10 text-blue-400 border-blue-500/20";
      case "REMINDER":
        return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      case "EVENT":
        return "bg-purple-500/10 text-purple-400 border-purple-500/20";
      case "SHOPPING":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case "FINANCE":
        return "bg-green-500/10 text-green-400 border-green-500/20";
      case "NOTE":
      case "KNOWLEDGE":
        return "bg-cyan-500/10 text-cyan-400 border-cyan-500/20";
      default:
        return "bg-slate-800 text-slate-300 border-slate-700";
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs text-blue-400 font-mono tracking-wider uppercase mb-1">
          <Sparkles className="h-3.5 w-3.5" />
          Universal Capture Engine
        </div>
        <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-white">
          Capture First. Organize Automatically.
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Type tasks, ideas, reminders, meetings, shopping, or KES expenses. Faida figures out where they belong.
        </p>
      </div>

      {/* Main Capture Bar */}
      <form onSubmit={handleCapture} className="space-y-3">
        <div className="relative flex items-center">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder='e.g., "Remind me to renew domain next Friday" or "Spent KES 1,800 on lunch"'
            className="w-full bg-slate-900/90 border-2 border-slate-700 focus:border-blue-500 rounded-2xl py-4 pl-5 pr-32 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none shadow-2xl transition-all"
            disabled={isCapturing}
            autoFocus
          />
          <button
            type="submit"
            disabled={!input.trim() || isCapturing}
            className="absolute right-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-blue-500/20 cursor-pointer transition-all"
          >
            {isCapturing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <>
                <span>Capture</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </>
            )}
          </button>
        </div>

        {feedback && (
          <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300 animate-in fade-in flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-blue-400 shrink-0" />
            <span>{feedback}</span>
          </div>
        )}
      </form>

      {/* Quick Test Chips */}
      <div className="space-y-2">
        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
          Quick Capture Templates (Click to Test)
        </div>
        <div className="flex flex-wrap gap-2">
          {quickExamples.map((ex, idx) => (
            <button
              key={idx}
              onClick={() => setInput(ex)}
              className="text-xs px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 transition-all text-left cursor-pointer"
            >
              {ex}
            </button>
          ))}
        </div>
      </div>

      {/* Real-time Universal Stream */}
      <div className="rounded-2xl bg-slate-900/40 border border-slate-800 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Live Universal Stream ({entities.length} items recorded)
          </h2>
          <span className="text-[11px] font-mono text-slate-500">Auto-synchronized</span>
        </div>

        {isLoading ? (
          <div className="py-8 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
            <span>Loading captured stream...</span>
          </div>
        ) : entities.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500">
            No items captured yet. Type in the box above to test universal capture!
          </div>
        ) : (
          <div className="space-y-3">
            {entities.map((item) => {
              let parsedMeta: any = {};
              try {
                if (item.metadata) parsedMeta = JSON.parse(item.metadata);
              } catch (e) {}

              return (
                <div
                  key={item.id}
                  className="p-4 rounded-xl bg-slate-800/40 border border-slate-800/80 hover:border-slate-700 flex items-start justify-between gap-4 transition-all"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 mt-0.5">
                      {getEntityIcon(item.type)}
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs font-semibold text-slate-100">{item.title}</div>
                      {item.content && item.content !== item.title && (
                        <p className="text-[11px] text-slate-400 leading-relaxed max-w-xl">
                          {item.content}
                        </p>
                      )}
                      <div className="flex items-center gap-2 pt-1 text-[10px] text-slate-500 font-mono">
                        <span>{formatDate(item.createdAt)}</span>
                        {item.task?.priority && (
                          <>
                            <span>•</span>
                            <span className="text-amber-400">P: {item.task.priority}</span>
                          </>
                        )}
                        {parsedMeta.amount && (
                          <>
                            <span>•</span>
                            <span className="text-emerald-400">{formatKES(parsedMeta.amount)}</span>
                          </>
                        )}
                        {parsedMeta.projectHint && (
                          <>
                            <span>•</span>
                            <span className="text-blue-400">Project: {parsedMeta.projectHint}</span>
                          </>
                        )}
                        {parsedMeta.engine && (
                          <>
                            <span>•</span>
                            <span className="text-slate-400">Router: {parsedMeta.engine}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded border ${getEntityBadgeStyle(
                        item.type
                      )}`}
                    >
                      {item.type}
                    </span>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                      title="Delete entity"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
