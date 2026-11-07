"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Cpu, Loader2 } from "lucide-react";

const NAMES: Record<string, string> = { groq: "Groq", cerebras: "Cerebras", openrouter: "OpenRouter" };

/** Shows which free AI engine Faida uses and how to switch one on. Keys live on the server, never in the browser. */
export function AiEngineStatus() {
  const [state, setState] = useState<{ ai: boolean; providers: string[] } | null>(null);

  useEffect(() => {
    fetch("/api/assistant", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => j?.success && setState({ ai: j.ai, providers: j.providers || [] }))
      .catch(() => {});
  }, []);

  return (
    <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
      <div className="flex items-center gap-2">
        <Cpu className="h-4 w-4 text-blue-400" />
        <h2 className="text-sm font-semibold text-slate-100">Faida AI engine</h2>
      </div>

      {!state ? (
        <p className="text-xs text-slate-300 flex items-center gap-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking…
        </p>
      ) : state.ai ? (
        <div className="space-y-2">
          <p className="text-xs text-emerald-200 flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5" /> Connected: {state.providers.map((p) => NAMES[p] || p).join(" → ")}
          </p>
          <p className="text-xs text-slate-300 leading-relaxed">
            Faida understands normal sentences and can look at your tasks, calendar, university, business and money, and make changes for you. If a free
            engine is busy it tries the next one, and falls back to basic commands if all are busy.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-amber-200">Basic mode: Faida only understands fixed commands (like “break down …” or “I spent …”).</p>
          <p className="text-xs text-slate-300 leading-relaxed">
            To switch the free AI on, create a free account at <span className="font-mono text-slate-100">console.groq.com</span>, make an API key, and add it in
            your Vercel project settings as <span className="font-mono text-slate-100">GROQ_API_KEY</span>, then redeploy. A second free key as{" "}
            <span className="font-mono text-slate-100">CEREBRAS_API_KEY</span> is used as backup.
          </p>
        </div>
      )}
      <p className="text-[11px] text-slate-400">Your messages and the facts Faida needs to answer are sent to the engine you connect; nothing else leaves your account.</p>
    </div>
  );
}
