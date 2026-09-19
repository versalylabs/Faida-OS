"use client";

import { Settings, Shield, Cpu, Database, Save } from "lucide-react";
import { useState } from "react";

export default function SettingsPage() {
  const [geminiKey, setGeminiKey] = useState("");
  const [isSaved, setIsSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <div className="flex items-center gap-2 text-xs text-blue-400 font-mono tracking-wider uppercase mb-1">
          <Settings className="h-3.5 w-3.5" />
          Configuration
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white">System Settings</h1>
        <p className="text-xs text-slate-400">Configure AI models, database paths, and secrets.</p>
      </div>

      <div className="space-y-4">
        {/* AI Provider Config */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
          <div className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-blue-400" />
            <h2 className="text-sm font-semibold text-slate-100">AI Engine Gateway</h2>
          </div>
          <p className="text-xs text-slate-400">
            Faida uses an autonomous hybrid router. If an API key is present, it uses Gemini Flash for natural language routing. Otherwise, it uses high-accuracy local regex heuristics.
          </p>
          <form onSubmit={handleSave} className="space-y-3">
            <div>
              <label className="text-xs text-slate-300 font-medium block mb-1">
                Google Gemini API Key
              </label>
              <input
                type="password"
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-lg shadow-blue-500/20"
            >
              <Save className="h-3.5 w-3.5" />
              <span>{isSaved ? "Saved!" : "Save Configuration"}</span>
            </button>
          </form>
        </div>

        {/* Database & Storage */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-emerald-400" />
            <h2 className="text-sm font-semibold text-slate-100">Database Storage</h2>
          </div>
          <div className="text-xs text-slate-400 flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
            <span>SQLite Data Engine:</span>
            <span className="font-mono text-emerald-400">prisma/faida.db (Local & Portable)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
