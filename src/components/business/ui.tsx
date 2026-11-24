"use client";

import { X } from "lucide-react";
import type { ReactNode } from "react";

import { Portal } from "@/components/ui/Portal";
/** Small building blocks shared by every business page, in the same slate/blue look as the rest of Faida OS. */

export const inputCls =
  "w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500";
export const labelCls = "text-slate-300 block mb-1 text-xs font-medium";
export const primaryBtn =
  "px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold cursor-pointer disabled:opacity-50 transition-colors";
export const ghostBtn = "px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-slate-200 cursor-pointer transition-colors";
export const dangerBtn =
  "px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold cursor-pointer disabled:opacity-50 transition-colors";

export function Card({
  title,
  icon,
  action,
  children,
  className = "",
}: {
  title?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`p-5 sm:p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4 ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          {title && (
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2 min-w-0">
              {icon}
              <span className="truncate">{title}</span>
            </h2>
          )}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Skeleton({ className = "h-6 w-24" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-slate-800/80 ${className}`} />;
}

export function Stat({
  label,
  value,
  sub,
  icon,
  loading,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: ReactNode;
  loading?: boolean;
  tone?: "default" | "good" | "bad";
}) {
  const color = tone === "good" ? "text-emerald-300" : tone === "bad" ? "text-rose-300" : "text-white";
  return (
    <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2 min-w-0">
      <div className="flex items-center justify-between gap-2 text-slate-400 text-xs">
        <span className="font-medium truncate">{label}</span>
        {icon}
      </div>
      {loading ? (
        <Skeleton className="h-7 w-28" />
      ) : (
        <div className={`text-xl sm:text-2xl font-bold font-mono break-words ${color}`}>{value}</div>
      )}
      {loading ? <Skeleton className="h-3 w-20" /> : sub ? <div className="text-[11px] text-slate-400">{sub}</div> : null}
    </div>
  );
}

export function Badge({ children, tone = "slate" }: { children: ReactNode; tone?: "slate" | "green" | "amber" | "rose" | "blue" | "purple" }) {
  const map: Record<string, string> = {
    slate: "bg-slate-800/80 text-slate-300 border-slate-700",
    green: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    amber: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    rose: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    blue: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    purple: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  };
  return <span className={`inline-flex items-center text-[10px] font-mono px-2 py-0.5 rounded-full border whitespace-nowrap ${map[tone]}`}>{children}</span>;
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="py-8 text-center text-xs text-slate-500 rounded-xl bg-slate-950/40 border border-slate-800/80 px-4">{children}</div>;
}

export function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <Portal><div className="fixed inset-0 modal-overlay z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className={`w-full ${wide ? "max-w-2xl" : "max-w-lg"} rounded-2xl bg-slate-900 border border-slate-700 p-5 sm:p-6 space-y-4 shadow-2xl`}>
        <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3">
          <h3 className="text-sm font-bold text-white min-w-0 break-words">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer shrink-0" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div></Portal>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      {children}
      {hint && <p className="text-[10px] text-slate-500 mt-1">{hint}</p>}
    </div>
  );
}

/** A confirm step for destructive actions, in the same rose styling used elsewhere. */
export function ConfirmDelete({
  title,
  body,
  busy,
  onCancel,
  onConfirm,
}: {
  title: string;
  body: ReactNode;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal title={title} onClose={onCancel}>
      <p className="text-xs text-slate-300 leading-relaxed">{body}</p>
      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onCancel} className={ghostBtn}>
          Cancel
        </button>
        <button onClick={onConfirm} disabled={busy} className={dangerBtn}>
          {busy ? "Deleting..." : "Delete"}
        </button>
      </div>
    </Modal>
  );
}

export function ProgressBar({ percent, color = "#3b82f6" }: { percent: number; color?: string }) {
  const p = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${p}%`, backgroundColor: color }} />
    </div>
  );
}

export function dayLabel(value?: string | null): string {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Nairobi" });
}

/** Whole days until a date, in Nairobi calendar days (negative = already past). */
export function daysFromToday(value?: string | null): number | null {
  if (!value) return null;
  const key = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Africa/Nairobi" });
  return Math.round((Date.parse(key(new Date(value))) - Date.parse(key(new Date()))) / 86_400_000);
}
