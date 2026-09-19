"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  X,
  Send,
  Loader2,
  Bot,
  User,
  Zap,
  CheckCircle2,
  PlusCircle,
  Banknote,
  ShoppingCart,
  Layers,
  SunMedium,
  ExternalLink,
  Flame,
} from "lucide-react";

interface ActionExecuted {
  type: string;
  title: string;
  badge?: string;
  details?: string;
  link?: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  actionExecuted?: ActionExecuted;
}

export function FaidaAIChatDrawer() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "init",
      role: "assistant",
      content:
        "Hello! I am Faida, your autonomous OS Copilot. I don't just chat — I can execute actions across your second brain:\n\n• Break down big goals into project tasks\n• Log KES expenses & update budgets\n• Dispatch quick wins tailored to your energy\n• Add items to your shopping list\n• Deliver your daily morning briefing",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) scrollToBottom();
  }, [messages, isOpen]);

  const handleSend = async (messageText?: string) => {
    const textToSend = messageText || input;
    if (!textToSend.trim() || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: textToSend.trim(),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!messageText) setInput("");
    setIsLoading(true);

    try {
      const history = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: textToSend.trim(),
          history,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: data.reply,
            actionExecuted: data.actionExecuted,
          },
        ]);
        // If an OS action was executed, refresh page data smoothly
        if (data.actionExecuted) {
          router.refresh();
        }
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: "Sorry, I had trouble processing that request right now.",
          },
        ]);
      }
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "Network error connecting to Faida AI engine.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const quickPrompts = [
    { label: "🌅 Morning Briefing", text: "Good morning! Give me my daily briefing." },
    { label: "🧩 Break Down Goal", text: "Break down goal: Deploy Melio production release" },
    { label: "💸 Log KES 1,800 Lunch", text: "I spent KES 1,800 on lunch at Java House" },
    { label: "⚡ Low Energy (20m)", text: "I have 20 minutes and low energy, what can I do?" },
    { label: "🛒 Add Groceries", text: "Add milk and whole grain bread to shopping list" },
  ];

  const renderActionCard = (action: ActionExecuted) => {
    let icon = <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
    let badgeColor = "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";

    if (action.type === "FINANCE_LOGGED") {
      icon = <Banknote className="h-4 w-4 text-amber-400" />;
      badgeColor = "bg-amber-500/15 text-amber-400 border-amber-500/30";
    } else if (action.type === "SHOPPING_ADDED") {
      icon = <ShoppingCart className="h-4 w-4 text-sky-400" />;
      badgeColor = "bg-sky-500/15 text-sky-400 border-sky-500/30";
    } else if (action.type === "GOAL_DECOMPOSED" || action.type === "TASK_CREATED") {
      icon = <Layers className="h-4 w-4 text-blue-400" />;
      badgeColor = "bg-blue-500/15 text-blue-400 border-blue-500/30";
    } else if (action.type === "ENERGY_DISPATCH") {
      icon = <Zap className="h-4 w-4 text-yellow-400" />;
      badgeColor = "bg-yellow-500/15 text-yellow-400 border-yellow-500/30";
    } else if (action.type === "BRIEFING_DELIVERED") {
      icon = <SunMedium className="h-4 w-4 text-orange-400" />;
      badgeColor = "bg-orange-500/15 text-orange-400 border-orange-500/30";
    }

    return (
      <div className="mt-2.5 p-2.5 rounded-xl bg-slate-950/80 border border-slate-700/70 text-left shadow-sm">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
            {icon}
            <span>{action.title}</span>
          </div>
          {action.badge && (
            <span
              className={`text-[9px] font-mono px-1.5 py-0.5 rounded border uppercase tracking-wider ${badgeColor}`}
            >
              {action.badge}
            </span>
          )}
        </div>
        {action.details && (
          <p className="text-[11px] text-slate-400 leading-snug mb-2 font-mono">
            {action.details}
          </p>
        )}
        {action.link && (
          <Link
            href={action.link}
            onClick={() => setIsOpen(false)}
            className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-400 hover:text-blue-300 hover:underline"
          >
            <span>Open in workspace</span>
            <ExternalLink className="h-2.5 w-2.5" />
          </Link>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Floating Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-full bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold text-xs shadow-2xl shadow-blue-500/40 hover:scale-105 transition-all cursor-pointer border border-blue-400/30"
      >
        <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-200 animate-pulse" />
        <span className="text-[11px] sm:text-xs">Ask Faida AI</span>
        <span className="h-2 w-2 rounded-full bg-emerald-400" />
      </button>

      {/* Slide-out Drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="fixed inset-0" onClick={() => setIsOpen(false)} />

          <div className="relative w-full max-w-full sm:max-w-md bg-slate-900 border-l border-slate-700/80 h-full flex flex-col shadow-2xl z-10 animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="h-14 sm:h-16 px-4 sm:px-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/70 shrink-0">
              <div className="flex items-center gap-2 sm:gap-2.5">
                <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <Bot className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-100 flex items-center gap-1.5 sm:gap-2">
                    Faida AI Copilot
                    <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-blue-500/15 text-blue-400 border border-blue-500/30">
                      Live Context
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 truncate max-w-[200px] sm:max-w-none">
                    Connected to tasks, KES budget &amp; second brain
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Messages Feed */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 text-xs">
              {messages.map((m) => {
                const isUser = m.role === "user";
                return (
                  <div
                    key={m.id}
                    className={`flex items-start gap-2.5 ${isUser ? "flex-row-reverse" : ""}`}
                  >
                    <div
                      className={`h-6 w-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5 text-[11px] ${
                        isUser
                          ? "bg-blue-600 text-white"
                          : "bg-slate-800 text-blue-400 border border-slate-700"
                      }`}
                    >
                      {isUser ? <User className="h-3 w-3" /> : <Bot className="h-3 w-3" />}
                    </div>
                    <div
                      className={`p-3 rounded-2xl max-w-[85%] leading-relaxed ${
                        isUser
                          ? "bg-blue-600 text-white rounded-tr-none"
                          : "bg-slate-800/70 border border-slate-700/80 text-slate-200 rounded-tl-none whitespace-pre-line"
                      }`}
                    >
                      <div>{m.content}</div>
                      {m.actionExecuted && renderActionCard(m.actionExecuted)}
                    </div>
                  </div>
                );
              })}
              {isLoading && (
                <div className="flex items-center gap-2 text-slate-400 p-2 text-xs">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-400" />
                  <span>Faida is thinking &amp; executing...</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Agentic Prompt Chips */}
            <div className="p-2.5 border-t border-slate-800/80 bg-slate-950/50">
              <div className="text-[10px] uppercase font-semibold text-slate-500 tracking-wider mb-1.5 px-1">
                Suggested Actions
              </div>
              <div className="flex gap-1.5 overflow-x-auto pb-1 text-[11px]">
                {quickPrompts.map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSend(q.text)}
                    className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-blue-500/40 text-slate-300 hover:text-blue-300 whitespace-nowrap cursor-pointer transition-colors"
                  >
                    {q.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Input Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="p-3 border-t border-slate-800 bg-slate-950/70"
            >
              <div className="relative flex items-center">
                <input
                  type="text"
                  placeholder="Tell Faida to log an expense, break down a goal, plan..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 focus:border-blue-500 rounded-xl py-2.5 pl-3 pr-10 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none"
                  disabled={isLoading}
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className="absolute right-1.5 p-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white cursor-pointer transition-colors"
                >
                  <Send className="h-3 w-3" />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
