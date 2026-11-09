"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight, CalendarClock, GraduationCap, Sparkles, Wallet, Wrench, Briefcase, CheckSquare, Bell, Video } from "lucide-react";
import type { Briefing, BriefGroup, BriefItem, BriefTone } from "@/lib/briefing";
import { lateLabel, whenLabel } from "@/lib/dates";

const TONE: Record<BriefTone, { chip: string; label: string; bar: string }> = {
  danger: { chip: "bg-rose-500/10 border-rose-500/30 text-rose-200", label: "text-rose-300", bar: "bg-rose-400" },
  warn: { chip: "bg-amber-500/10 border-amber-500/30 text-amber-200", label: "text-amber-300", bar: "bg-amber-400" },
  info: { chip: "bg-blue-500/10 border-blue-500/25 text-blue-200", label: "text-blue-300", bar: "bg-blue-400" },
  good: { chip: "bg-emerald-500/10 border-emerald-500/25 text-emerald-200", label: "text-emerald-300", bar: "bg-emerald-400" },
};

const ICON: Record<string, typeof Bell> = {
  TASK: CheckSquare,
  ACADEMIC: GraduationCap,
  CLASS: Video,
  MAINTENANCE: Wrench,
  BUSINESS: Briefcase,
  REMINDER: Bell,
  EVENT: CalendarClock,
};

function Row({ item, late }: { item: BriefItem; late: boolean }) {
  const Icon = ICON[item.category] || Bell;
  const when = item.when ? (late ? lateLabel(item.when) : whenLabel(item.when, item.allDay)) : "";
  const body = (
    <div className="flex items-start gap-2.5 min-w-0 px-2.5 py-2 rounded-lg hover:bg-white/5 transition-colors">
      <Icon className="h-3.5 w-3.5 mt-0.5 shrink-0 text-slate-300" />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-slate-100 font-medium break-words">{item.title}</p>
        <p className="text-[11px] text-slate-400 break-words">
          {item.meta ? `${item.meta} · ` : ""}
          <span className={late ? "text-rose-300" : ""}>{when}</span>
        </p>
      </div>
    </div>
  );
  if (item.href) return <Link href={item.href}>{body}</Link>;
  if (item.url)
    return (
      <a href={item.url} target="_blank" rel="noreferrer">
        {body}
      </a>
    );
  return body;
}

function Group({ g }: { g: BriefGroup }) {
  const tone = TONE[g.tone];
  return (
    <div className="rounded-xl bg-slate-950/50 border border-slate-800/80 p-2.5">
      <div className="flex items-center gap-2 px-2.5 pb-1.5">
        <span className={`h-1.5 w-1.5 rounded-full ${tone.bar}`} />
        <h3 className={`text-[11px] font-bold uppercase tracking-wider ${tone.label}`}>{g.label}</h3>
        <span className="text-[11px] text-slate-400">{g.total}</span>
      </div>
      <div>
        {g.items.map((i) => (
          <Row key={i.key} item={i} late={g.key === "overdue"} />
        ))}
        {g.total > g.items.length && (
          <Link href="/calendar" className="block px-2.5 py-1 text-[11px] text-blue-300 hover:underline">
            +{g.total - g.items.length} more in the calendar
          </Link>
        )}
      </div>
    </div>
  );
}

/** The Faida Intelligence Briefing: what needs attention now, from the same data as the Calendar. */
export function BriefingCard({ briefing, loading }: { briefing: Briefing | null; loading: boolean }) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-950/40 via-slate-900 to-slate-950 border border-blue-500/20 p-4 sm:p-6 shadow-xl">
      {/* The icon sits in the header row, so the content below uses the full width and both side margins match. */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-300 shrink-0 shadow-inner">
            <Sparkles className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
            <h2 className="text-sm font-semibold text-blue-200">Faida Intelligence Briefing</h2>
            <span className="text-[10px] bg-blue-500/20 border border-blue-500/30 text-blue-200 px-2 py-0.5 rounded-full font-mono">
              {briefing ? `Live · ${briefing.dateLabel}` : "Live"}
            </span>
          </div>
        </div>

          {!briefing ? (
            <p className="text-xs text-slate-300">{loading ? "Reading your tasks, calendar, university and business…" : "Briefing unavailable right now."}</p>
          ) : (
            <>
              <p className="text-sm text-slate-100 leading-relaxed max-w-3xl">{briefing.headline}</p>

              {briefing.stats.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {briefing.stats.map((s) => (
                    <Link
                      key={s.key}
                      href={s.href}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] whitespace-nowrap ${TONE[s.tone].chip}`}
                    >
                      <strong className="font-bold">{s.value}</strong> {s.label}
                    </Link>
                  ))}
                </div>
              )}

              {briefing.groups.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  {briefing.groups.map((g) => (
                    <Group key={g.key} g={g} />
                  ))}
                </div>
              )}

              {(briefing.other.projectFocus ?? []).length > 0 && (
                <div className="rounded-xl bg-slate-950/50 border border-slate-800/80 p-2.5">
                  <div className="flex items-center gap-2 px-2.5 pb-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                    <h3 className="text-[11px] font-bold uppercase tracking-wider text-blue-300">Projects: next move</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-2">
                    {briefing.other.projectFocus.map((p) => (
                      <Link key={p.id} href={`/projects/${p.id}`} className="block px-2.5 py-2 rounded-lg hover:bg-white/5 transition-colors min-w-0">
                        <p className="flex items-center gap-2 text-[11px] text-slate-400">
                          <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: p.color || "#3b82f6" }} />
                          <span className="truncate">{p.name}</span>
                        </p>
                        <p className="text-xs text-slate-100 font-medium break-words">
                          {p.action ?? "No open tasks. Add the next step."}
                          {p.overdue && <span className="text-rose-300 font-normal"> · overdue</span>}
                        </p>
                        {p.staleDays != null && (
                          <p className="text-[11px] text-amber-300">No progress in {p.staleDays} days</p>
                        )}
                        {p.milestone && (
                          <p className="text-[11px] text-slate-400 break-words">
                            Next milestone: {p.milestone}
                            {p.milestoneOverdue && <span className="text-rose-300"> · overdue</span>}
                          </p>
                        )}
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {(briefing.other.clientsNeedingAttention.length > 0 || (briefing.finance && briefing.finance.percentUsed >= 80)) && (
                <div className="flex flex-col gap-1.5">
                  {briefing.other.clientsNeedingAttention.length > 0 && (
                    <Link href="/business" className="flex items-start gap-2 text-xs text-amber-200 hover:underline">
                      <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-300" />
                      Client{briefing.other.clientsNeedingAttention.length === 1 ? "" : "s"} needing attention: {briefing.other.clientsNeedingAttention.join(", ")}
                    </Link>
                  )}
                  {briefing.finance && briefing.finance.percentUsed >= 80 && (
                    <Link href="/finance" className="flex items-start gap-2 text-xs text-amber-200 hover:underline">
                      <Wallet className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-300" />
                      {briefing.finance.percentUsed}% of this month&apos;s budget is used (KES {briefing.finance.spent.toLocaleString()} of KES{" "}
                      {briefing.finance.limit.toLocaleString()}).
                    </Link>
                  )}
                </div>
              )}

              {briefing.suggestion && (
                <p className="flex items-start gap-2 text-xs text-slate-100">
                  <ArrowRight className="h-3.5 w-3.5 mt-0.5 shrink-0 text-blue-300" />
                  <span>{briefing.suggestion}</span>
                </p>
              )}

              <p className="text-[11px] text-slate-400">
                {briefing.other.openTasks} open tasks · {briefing.other.activeProjects} active projects · {briefing.other.shoppingPending} items to buy
              </p>
            </>
          )}
      </div>
    </div>
  );
}
