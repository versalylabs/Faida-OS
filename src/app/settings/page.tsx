"use client";

import { Settings, Shield, Cpu, Database, Save, KeyRound, Loader2 } from "lucide-react";
import { useState } from "react";

export default function SettingsPage() {
  const [geminiKey, setGeminiKey] = useState("");
  const [isSaved, setIsSaved] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMessage("");
    setPasswordError("");
    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }

    setPasswordLoading(true);
    try {
      const response = await fetch("/api/auth/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to change password.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordMessage(result.message);
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : "Unable to change password.");
    } finally {
      setPasswordLoading(false);
    }
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
        <section className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4" aria-labelledby="password-heading">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-emerald-400" />
            <h2 id="password-heading" className="text-sm font-semibold text-slate-100">Change Password</h2>
          </div>
          <p className="text-xs text-slate-400">Choose a unique password with at least 12 characters. Changing it signs out your other sessions.</p>
          <form onSubmit={handlePasswordChange} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="text-xs text-slate-300 font-medium">
                Current password
                <input required type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500" />
              </label>
              <label className="text-xs text-slate-300 font-medium">
                New password
                <input required minLength={12} type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500" />
              </label>
              <label className="text-xs text-slate-300 font-medium">
                Confirm new password
                <input required minLength={12} type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500" />
              </label>
            </div>
            {passwordError && <p role="alert" className="text-xs text-rose-400">{passwordError}</p>}
            {passwordMessage && <p role="status" className="text-xs text-emerald-400">{passwordMessage}</p>}
            <button type="submit" disabled={passwordLoading} className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer">
              {passwordLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Shield className="h-3.5 w-3.5" />}
              <span>{passwordLoading ? "Changing…" : "Update Password"}</span>
            </button>
          </form>
        </section>

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

        {/* Backup */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-sky-300" />
            <h2 className="text-sm font-semibold text-slate-100">Back up your data</h2>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Download everything in your account (tasks, notes, finances, projects and more) as one file. Keep it somewhere private:
            it includes anything you stored in the Developer Hub.
          </p>
          <a
            href="/api/export"
            download
            className="press inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-600 text-white text-xs font-semibold"
          >
            Download my data
          </a>
        </div>

        {/* Database & Storage */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-emerald-400" />
            <h2 className="text-sm font-semibold text-slate-100">Database Storage</h2>
          </div>
          <div className="text-xs text-slate-400 flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
            <span>Data Engine:</span>
            <span className="font-mono text-emerald-400">PostgreSQL (Neon)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
