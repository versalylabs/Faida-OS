"use client";

import {
  AlertTriangle,
  Bell,
  BookOpen,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  GraduationCap,
  Loader2,
  Megaphone,
  PlugZap,
  RefreshCw,
  Sparkles,
  Video,
  EyeOff,
  CalendarClock,
} from "lucide-react";
import type { LmsController, LmsAttentionRow, LmsFeedRow } from "@/lib/useLms";
import type { UnitProgress } from "@/lib/lms/progress";

const TZ = "Africa/Nairobi";

function dayKey(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
}

/** "Today 5:00 PM", "Tomorrow 9:00 AM", "Mon 9 Nov, 11:59 PM" in the student's time zone. */
export function whenLabel(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "numeric", minute: "2-digit", hour12: true }).format(d);
  const key = dayKey(d);
  if (key === dayKey(now)) return `Today ${time}`;
  if (key === dayKey(new Date(now.getTime() + 86400000))) return `Tomorrow ${time}`;
  if (key === dayKey(new Date(now.getTime() - 86400000))) return `Yesterday ${time}`;
  const date = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, weekday: "short", day: "numeric", month: "short" }).format(d);
  return `${date}, ${time}`;
}

export function agoLabel(iso: string | null, now: Date = new Date()): string {
  if (!iso) return "never";
  const mins = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/* ------------------------------------------------------------------------------------------ */

export function LmsStatusCard({ lms, onConnect }: { lms: LmsController; onConnect: () => void }) {
  const { data, syncing, notice } = lms;

  if (!data?.connected) {
    return (
      <div className="rounded-xl bg-slate-900 border border-blue-500/30 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 shrink-0 w-fit">
          <PlugZap className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-bold text-slate-100">Connect your LMS</h2>
          <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
            Faida OS reads your units, assignments, CATs, marks and announcements, shows your progress in each unit and tells you
            what is due, missed or new. It only reads; it never submits or changes anything in your LMS.
          </p>
          {notice && <p className="text-xs text-amber-300 mt-2">{notice}</p>}
        </div>
        <button
          onClick={onConnect}
          className="press shrink-0 whitespace-nowrap px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold"
        >
          Connect LMS
        </button>
      </div>
    );
  }

  const c = data.connection!;
  const bad = c.status === "INVALID" || c.status === "ERROR";
  return (
    <div className={`rounded-xl bg-slate-900 border p-3.5 sm:p-4 ${bad ? "border-amber-500/40" : "border-slate-800"}`}>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className={`p-2 rounded-lg border shrink-0 ${bad ? "bg-amber-500/10 border-amber-500/30 text-amber-300" : "bg-emerald-500/10 border-emerald-500/25 text-emerald-300"}`}>
            {bad ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-100 truncate">
              {bad ? "LMS needs attention" : "LMS connected"} · {hostOf(c.baseUrl)}
              {c.studentName ? ` · ${c.studentName}` : ""}
            </p>
            <p className="text-[11px] text-slate-400">
              Last synced {agoLabel(c.lastSyncAt)}
              {data._isOfflineCached ? " · showing saved data" : ""} · refreshes itself about every 8 hours
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {c.status === "INVALID" && (
            <button onClick={onConnect} className="press whitespace-nowrap px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 text-xs font-semibold">
              Reconnect
            </button>
          )}
          <button
            onClick={() => {
              if (confirm("Disconnect your LMS? Your imported units and tasks stay, and the stored access key is erased.")) lms.disconnect();
            }}
            className="text-[11px] text-slate-400 hover:text-slate-200 underline-offset-2 hover:underline whitespace-nowrap px-1"
          >
            Disconnect
          </button>
          <button
            onClick={lms.sync}
            disabled={syncing}
            className="press flex items-center gap-1.5 whitespace-nowrap px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-semibold disabled:opacity-50"
          >
            {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            {syncing ? "Syncing…" : "Sync now"}
          </button>
        </div>
      </div>
      {(notice || c.lastError) && (
        <p className={`text-xs mt-2.5 break-words ${!notice && c.lastError ? "text-amber-300" : "text-slate-300"}`}>
          {notice || (bad ? c.lastError : `Some parts of your LMS could not be read this time: ${c.lastError}`)}
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------------------------------ */

function AttentionRow({ row, tone, lms }: { row: LmsAttentionRow; tone: "late" | "soon"; lms: LmsController }) {
  return (
    <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
      <div className="flex items-start gap-2.5 min-w-0 flex-1">
        <span className="mt-1 w-1.5 h-8 rounded-full shrink-0" style={{ backgroundColor: row.courseColor || "#64748b" }} />
        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-100 break-words">{row.title}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {row.courseCode ? `${row.courseCode} · ` : ""}
            {tone === "late" ? (
              <span className="text-rose-300">
                Was due {whenLabel(row.dueAt)}
                {row.hoursLate && row.hoursLate >= 24 ? ` (${Math.floor(row.hoursLate / 24)}d late)` : ""}
              </span>
            ) : (
              <span className={row.bucket === "today" ? "text-amber-300" : "text-slate-300"}>Due {whenLabel(row.dueAt)}</span>
            )}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0 pl-4 sm:pl-0">
        {row.url && (
          <a
            href={row.url}
            target="_blank"
            rel="noreferrer"
            className="press flex items-center gap-1 whitespace-nowrap px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-100 text-[11px] font-medium"
          >
            <ExternalLink className="h-3 w-3" /> Open
          </a>
        )}
        <button
          onClick={() => lms.dismiss(row.id)}
          title="Not needed: hide this and stop counting it"
          aria-label="Hide this item"
          className="press p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300"
        >
          <EyeOff className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

/** Missed work, work due today/tomorrow and live classes: what needs doing first. */
export function LmsAttentionCard({ lms }: { lms: LmsController }) {
  const data = lms.data;
  if (!data?.connected) return null;
  const missed = data.attention?.missed ?? [];
  const soon = data.attention?.dueSoon ?? [];
  const classes = data.classesSoon ?? [];
  if (missed.length === 0 && soon.length === 0 && classes.length === 0) {
    return (
      <div className="rounded-xl bg-slate-900 border border-slate-800 p-4 flex items-center gap-3">
        <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
        <p className="text-xs text-slate-200">
          Nothing is overdue and nothing is due today or tomorrow in your LMS. <span className="text-slate-400">Good place to be.</span>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {missed.length > 0 && (
        <div className="rounded-xl bg-slate-900 border border-rose-500/30 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-rose-400" />
            <h2 className="text-sm font-bold text-slate-100">Follow up: deadline passed, nothing submitted ({missed.length})</h2>
          </div>
          <p className="text-[11px] text-slate-400 -mt-1">
            If it is actually done or not required, hide it with the eye button and it stops counting. Otherwise ask your lecturer
            whether a late submission is still accepted.
          </p>
          <div className="space-y-2">
            {missed.slice(0, 8).map((m) => (
              <AttentionRow key={m.id} row={m} tone="late" lms={lms} />
            ))}
          </div>
        </div>
      )}

      {(soon.length > 0 || classes.length > 0) && (
        <div className="rounded-xl bg-slate-900 border border-amber-500/30 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-amber-300" />
            <h2 className="text-sm font-bold text-slate-100">Today &amp; tomorrow</h2>
          </div>
          <div className="space-y-2">
            {classes.map((c) => (
              <div key={c.id} className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-center gap-3">
                <Video className="h-4 w-4 text-blue-300 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-slate-100 break-words">{c.title}</p>
                  <p className="text-[11px] text-slate-400">
                    {c.courseCode ? `${c.courseCode} · ` : ""}Class {whenLabel(c.startsAt)}
                  </p>
                </div>
                {c.url && (
                  <a
                    href={c.url}
                    target="_blank"
                    rel="noreferrer"
                    className="press whitespace-nowrap px-2.5 py-1 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-semibold"
                  >
                    Join
                  </a>
                )}
              </div>
            ))}
            {soon.map((m) => (
              <AttentionRow key={m.id} row={m} tone="soon" lms={lms} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------------------------------ */

const FEED_ICON: Record<string, { Icon: typeof Bell; tone: string }> = {
  NEW_ITEM: { Icon: Sparkles, tone: "text-blue-300 bg-blue-500/10 border-blue-500/25" },
  SUBMITTED: { Icon: CheckCircle2, tone: "text-emerald-300 bg-emerald-500/10 border-emerald-500/25" },
  GRADED: { Icon: GraduationCap, tone: "text-emerald-300 bg-emerald-500/10 border-emerald-500/25" },
  DUE_CHANGED: { Icon: Clock, tone: "text-amber-300 bg-amber-500/10 border-amber-500/25" },
  ANNOUNCEMENT: { Icon: Megaphone, tone: "text-violet-300 bg-violet-500/10 border-violet-500/25" },
  NEW_MATERIAL: { Icon: FileText, tone: "text-cyan-300 bg-cyan-500/10 border-cyan-500/25" },
};

function FeedRow({ row }: { row: LmsFeedRow }) {
  const meta = FEED_ICON[row.type] || { Icon: Bell, tone: "text-slate-300 bg-slate-800 border-slate-700" };
  const Icon = meta.Icon;
  let detail = row.detail;
  if (detail && /^(Due|Now due) \d{4}-\d{2}-\d{2}T/.test(detail)) {
    const iso = detail.replace(/^(Due|Now due) /, "");
    detail = `${detail.startsWith("Now") ? "Now due" : "Due"} ${whenLabel(iso)}`;
  }
  const body = (
    <div className="flex items-start gap-3 min-w-0">
      <span className={`p-1.5 rounded-lg border shrink-0 ${meta.tone}`}>
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className={`text-xs break-words ${row.unread ? "font-semibold text-slate-100" : "text-slate-200"}`}>{row.title}</p>
        {detail && <p className="text-[11px] text-slate-400 mt-0.5 break-words line-clamp-2">{detail}</p>}
        <p className="text-[10px] text-slate-500 mt-0.5">{agoLabel(row.occurredAt)}</p>
      </div>
      {row.unread && <span className="w-2 h-2 rounded-full bg-blue-400 mt-1.5 shrink-0" aria-label="New" />}
    </div>
  );
  return row.url ? (
    <a href={row.url} target="_blank" rel="noreferrer" className="block p-2.5 rounded-lg hover:bg-slate-800/60 transition-colors">
      {body}
    </a>
  ) : (
    <div className="p-2.5">{body}</div>
  );
}

/** What changed in the LMS since you last looked. */
export function LmsFeedCard({ lms }: { lms: LmsController }) {
  const data = lms.data;
  if (!data?.connected) return null;
  const feed = data.feed ?? [];
  return (
    <div className="rounded-xl bg-slate-900 border border-slate-800 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-blue-400" />
          <h2 className="text-sm font-bold text-slate-100">LMS activity</h2>
          {(data.unreadCount ?? 0) > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-500 text-white">{data.unreadCount}</span>
          )}
        </div>
        {(data.unreadCount ?? 0) > 0 && (
          <button onClick={lms.markAllRead} className="text-[11px] text-blue-300 hover:underline whitespace-nowrap">
            Mark all read
          </button>
        )}
      </div>
      {feed.length === 0 ? (
        <p className="text-xs text-slate-400 py-6 text-center border border-dashed border-slate-800 rounded-lg">
          {data.connection?.firstSyncPending
            ? "Your LMS has been read. New submissions, marks, announcements and uploads will appear here after the next sync."
            : "No new activity yet. Submissions, marks, new assignments, deadline changes, announcements and uploads from your lecturers show up here."}
        </p>
      ) : (
        <div className="divide-y divide-slate-800/70 -mx-1">
          {feed.slice(0, 15).map((f) => (
            <FeedRow key={f.id} row={f} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------------------------------ */

function Ring({ percent, color }: { percent: number; color: string }) {
  const r = 24;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative w-[60px] h-[60px] shrink-0" role="img" aria-label={`${percent}% complete`}>
      <svg viewBox="0 0 60 60" className="w-full h-full -rotate-90">
        <circle cx="30" cy="30" r={r} fill="none" stroke="rgba(148,163,184,0.2)" strokeWidth="6" />
        <circle
          cx="30"
          cy="30"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (c * Math.min(100, percent)) / 100}
          style={{ transition: "stroke-dashoffset .6s ease" }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-slate-100">{percent}%</span>
    </div>
  );
}

const STATUS_CHIP: Record<UnitProgress["status"], { label: string; cls: string }> = {
  ALL_DONE: { label: "All done", cls: "bg-emerald-500/10 text-emerald-300 border-emerald-500/25" },
  ON_TRACK: { label: "On track", cls: "bg-blue-500/10 text-blue-300 border-blue-500/25" },
  BEHIND: { label: "Behind", cls: "bg-rose-500/10 text-rose-300 border-rose-500/25" },
  NO_WORK: { label: "No coursework yet", cls: "bg-slate-800 text-slate-300 border-slate-700" },
};

export function UnitCard({ u }: { u: UnitProgress }) {
  const chip = STATUS_CHIP[u.status];
  const color = u.status === "BEHIND" ? "#fb7185" : u.status === "ALL_DONE" ? "#34d399" : u.color || "#60a5fa";
  return (
    <div className="rounded-xl bg-slate-900 border border-slate-800 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <Ring percent={u.percent} color={color} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-bold text-slate-100 break-words">{u.code}</p>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${chip.cls}`}>{chip.label}</span>
          </div>
          <p className="text-xs text-slate-300 break-words">{u.name}</p>
          {u.lecturer && <p className="text-[11px] text-slate-400 mt-0.5 break-words">{u.lecturer}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <div className="rounded-lg bg-slate-950/60 border border-slate-800/80 px-2.5 py-1.5">
          <p className="text-slate-400">Completed</p>
          <p className="font-semibold text-slate-100">
            {u.done} of {u.total}
          </p>
        </div>
        <div className="rounded-lg bg-slate-950/60 border border-slate-800/80 px-2.5 py-1.5">
          <p className="text-slate-400">Marks so far</p>
          <p className="font-semibold text-slate-100">
            {u.marksPercent === null ? "Not marked yet" : `${u.marksEarned}/${u.marksMax} (${u.marksPercent}%)`}
          </p>
        </div>
        <div className="rounded-lg bg-slate-950/60 border border-slate-800/80 px-2.5 py-1.5">
          <p className="text-slate-400">Still to do</p>
          <p className="font-semibold text-slate-100">{u.upcoming}</p>
        </div>
        <div className={`rounded-lg border px-2.5 py-1.5 ${u.missed ? "bg-rose-500/10 border-rose-500/25" : "bg-slate-950/60 border-slate-800/80"}`}>
          <p className="text-slate-400">Missed</p>
          <p className={`font-semibold ${u.missed ? "text-rose-300" : "text-slate-100"}`}>{u.missed}</p>
        </div>
      </div>

      {u.next ? (
        <p className="text-[11px] text-slate-300 break-words">
          <span className="text-slate-400">Next: </span>
          {u.next.title} · {whenLabel(u.next.dueAt)}
        </p>
      ) : u.status !== "NO_WORK" ? (
        <p className="text-[11px] text-slate-400">Nothing coming up in this unit.</p>
      ) : null}

      <div className="flex items-center justify-between gap-2 pt-1">
        <span className="text-[10px] text-slate-500">
          {u.lmsCompletion !== null ? `LMS completion ticks: ${u.lmsCompletion}%` : "This unit has no completion ticks in the LMS"}
        </span>
        {u.url && (
          <a href={u.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[11px] text-blue-300 hover:underline whitespace-nowrap">
            Open unit <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    </div>
  );
}

/** Per-unit progress based on the assignments and CATs you have actually completed. */
export function LmsUnitsGrid({ lms, onConnect }: { lms: LmsController; onConnect: () => void }) {
  const data = lms.data;
  if (!data?.connected) {
    return (
      <div className="py-12 text-center border border-dashed border-slate-800 rounded-xl space-y-3">
        <BookOpen className="h-8 w-8 text-slate-600 mx-auto" />
        <p className="text-xs text-slate-300">Connect your LMS to see every unit you are taking and how far along each one is.</p>
        <button onClick={onConnect} className="press px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold">
          Connect LMS
        </button>
      </div>
    );
  }
  const units = data.units ?? [];
  if (units.length === 0) {
    return <p className="text-xs text-slate-400 py-10 text-center border border-dashed border-slate-800 rounded-xl">No current units found yet. Try Sync now.</p>;
  }
  const totals = units.reduce((n, u) => ({ done: n.done + u.done, total: n.total + u.total, missed: n.missed + u.missed }), { done: 0, total: 0, missed: 0 });
  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-300">
        <span className="font-semibold text-slate-100">{totals.done}</span> of <span className="font-semibold text-slate-100">{totals.total}</span>{" "}
        assignments and CATs completed across {units.length} units
        {totals.missed ? <span className="text-rose-300"> · {totals.missed} missed</span> : null}. Progress counts work you have submitted; it
        grows as you complete each item.
      </p>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,19rem),1fr))] gap-4">
        {units.map((u) => (
          <UnitCard key={u.courseId} u={u} />
        ))}
      </div>
    </div>
  );
}
