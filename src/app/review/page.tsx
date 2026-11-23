"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, BarChart3, CalendarRange, CheckCircle2, GraduationCap, Loader2, PauseCircle, Receipt, RefreshCw, Target, Wallet } from "lucide-react";
import { formatKES } from "@/lib/utils";
import type { WeeklyReview } from "@/lib/weeklyReview";
import { cacheOfflineData, getCachedOfflineData } from "@/lib/offlineSync";

const when = (iso: string) => new Date(iso).toLocaleString([], { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const day = (iso: string) => new Date(iso).toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" });

function minutesLabel(total: number) {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h ? `${h}h${m ? ` ${m}m` : ""}` : `${m}m`;
}

function Card({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="p-4 sm:p-5 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-3">
      <h2 className="text-sm font-semibold text-white flex items-center gap-2">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
}

const Empty = ({ children }: { children: React.ReactNode }) => <p className="text-xs text-slate-400">{children}</p>;

/** The weekly review: what this week produced, where the money went, what stalled, KPIs, and next week. */
export default function ReviewPage() {
  const [review, setReview] = useState<WeeklyReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/review", { cache: "no-store" });
      const json = await res.json();
      if (json.success) {
        setReview(json.review);
        cacheOfflineData("weekly_review", json.review);
      } else setError(json.error || "Could not load the review.");
    } catch {
      setError("You seem to be offline. Showing the last review you opened, if any.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const cached = getCachedOfflineData<WeeklyReview>("weekly_review");
    if (cached) setReview(cached);
    load();
  }, []);

  const r = review;

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs text-sky-300 mb-1">
            <CalendarRange className="h-3.5 w-3.5" />
            {r ? `Week of ${r.week.label}` : "This week"}
          </div>
          <h1 className="text-2xl lg:text-3xl font-semibold tracking-tight text-white">Weekly review</h1>
          <p className="text-sm text-slate-300 mt-1">What this week produced, where the money went, and what next week asks of you.</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="press flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-slate-900/70 border border-white/15 text-slate-100 text-sm font-medium cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 text-sky-300 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {error && <div className="p-3 rounded-2xl bg-amber-400/10 border border-amber-300/30 text-sm text-amber-100">{error}</div>}

      {!r ? (
        <div className="py-16 text-center text-sm text-slate-300 flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-sky-300" /> Putting your week together…
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Finished", value: String(r.finished.tasks + r.finished.deliverables) },
              { label: "Focus done", value: minutesLabel(r.finished.focusMinutes) },
              { label: "Days planned", value: `${r.finished.plansLocked}` },
              { label: "Money net", value: `${r.money.net < 0 ? "−" : ""}${formatKES(Math.abs(r.money.net))}` },
            ].map((t) => (
              <div key={t.label} className="px-3 py-3 rounded-2xl bg-slate-900/60 border border-slate-800 text-center">
                <div className="text-lg font-semibold text-white tabular-nums">{t.value}</div>
                <div className="text-[11px] text-slate-300">{t.label}</div>
              </div>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card icon={<CheckCircle2 className="h-4 w-4 text-emerald-300" />} title={`Finished this week (${r.finished.tasks} tasks, ${r.finished.deliverables} client jobs)`}>
              {r.finished.recent.length === 0 ? (
                <Empty>Nothing marked done yet this week.</Empty>
              ) : (
                <ul className="space-y-1.5">
                  {r.finished.recent.map((f, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-slate-200">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                      <span className="truncate flex-1">{f.title}</span>
                      {f.kind === "DELIVERABLE" && <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-slate-300">Client</span>}
                      <span className="text-[11px] text-slate-400 shrink-0">{day(f.at)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card icon={<Wallet className="h-4 w-4 text-sky-300" />} title="Money this week">
              <div className="flex gap-6 text-sm">
                <div>
                  <div className="text-xs text-slate-400">In</div>
                  <div className="font-semibold text-emerald-200 tabular-nums">{formatKES(r.money.in)}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-400">Out</div>
                  <div className="font-semibold text-rose-200 tabular-nums">{formatKES(r.money.out)}</div>
                </div>
                {r.money.fees > 0 && (
                  <div>
                    <div className="text-xs text-slate-400">M-Pesa fees</div>
                    <div className="font-semibold text-slate-200 tabular-nums">{formatKES(r.money.fees)}</div>
                  </div>
                )}
              </div>
              {r.money.topSpending.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-xs text-slate-400">Where it went</div>
                  {r.money.topSpending.map((s) => (
                    <div key={s.category} className="flex items-center gap-2 text-sm">
                      <span className="flex-1 text-slate-200 truncate">{s.category}</span>
                      <div className="w-24 h-1.5 rounded-full bg-white/5 overflow-hidden">
                        <div className="h-full bg-rose-300/70" style={{ width: `${Math.max(6, Math.round((s.amount / Math.max(r.money.out, 1)) * 100))}%` }} />
                      </div>
                      <span className="tabular-nums text-slate-300 w-24 text-right">{formatKES(s.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
              {r.money.byBusiness.length > 0 && (
                <div className="text-xs text-slate-300 space-y-0.5">
                  {r.money.byBusiness.map((b) => (
                    <div key={b.name}>
                      {b.name}: in {formatKES(b.in)}, out {formatKES(b.out)}
                    </div>
                  ))}
                </div>
              )}
              {r.money.billsPaid.length > 0 && <div className="text-xs text-slate-300">Bills paid: {r.money.billsPaid.join(", ")}</div>}
              <Link href="/finance" className="text-xs text-sky-300 underline underline-offset-2">
                Open Finance
              </Link>
            </Card>

            <Card icon={<GraduationCap className="h-4 w-4 text-violet-300" />} title="Next week">
              {r.nextWeek.cats.length + r.nextWeek.assignments.length + r.nextWeek.deliverables.length + r.nextWeek.bills.length === 0 && r.nextWeek.tasksDue === 0 ? (
                <Empty>Nothing with a date next week yet.</Empty>
              ) : (
                <ul className="space-y-1.5 text-sm">
                  {r.nextWeek.cats.map((c, i) => (
                    <li key={`c${i}`} className="flex gap-2 text-slate-100">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-400/15 text-violet-100 shrink-0 h-fit">CAT</span>
                      <span className="flex-1">{c.course ? `${c.course}: ` : ""}{c.title}</span>
                      <span className="text-[11px] text-slate-400 shrink-0">{when(c.at)}</span>
                    </li>
                  ))}
                  {r.nextWeek.assignments.map((a, i) => (
                    <li key={`a${i}`} className="flex gap-2 text-slate-100">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-400/15 text-sky-100 shrink-0 h-fit">Due</span>
                      <span className="flex-1">{a.title}</span>
                      <span className="text-[11px] text-slate-400 shrink-0">{when(a.at)}</span>
                    </li>
                  ))}
                  {r.nextWeek.deliverables.map((d, i) => (
                    <li key={`d${i}`} className="flex gap-2 text-slate-100">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-400/15 text-amber-100 shrink-0 h-fit">Client</span>
                      <span className="flex-1">{d.title}</span>
                      <span className="text-[11px] text-slate-400 shrink-0">{day(d.at)}</span>
                    </li>
                  ))}
                  {r.nextWeek.bills.map((b, i) => (
                    <li key={`b${i}`} className="flex gap-2 text-slate-100">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 h-fit ${b.overdue ? "bg-rose-400/20 text-rose-100" : "bg-white/5 text-slate-200"}`}>{b.overdue ? "Overdue" : "Bill"}</span>
                      <span className="flex-1">
                        {b.name}
                        {b.amount ? ` · ${formatKES(b.amount)}` : ""}
                      </span>
                      <span className="text-[11px] text-slate-400 shrink-0">{day(b.at)}</span>
                    </li>
                  ))}
                  {r.nextWeek.tasksDue > 0 && (
                    <li className="text-xs text-slate-300">
                      Plus {r.nextWeek.tasksDue} task{r.nextWeek.tasksDue === 1 ? "" : "s"} due next week.{" "}
                      <Link href="/tasks" className="text-sky-300 underline underline-offset-2">
                        See tasks
                      </Link>
                    </li>
                  )}
                </ul>
              )}
              {r.overdueTasks > 0 && (
                <div className="flex items-center gap-2 text-xs text-rose-200">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {r.overdueTasks} overdue task{r.overdueTasks === 1 ? "" : "s"}: finish, move or drop {r.overdueTasks === 1 ? "it" : "them"} before Monday.
                </div>
              )}
            </Card>

            <Card icon={<Target className="h-4 w-4 text-amber-300" />} title="Business KPIs this month">
              {r.kpis.length === 0 ? (
                <Empty>No KPI targets set yet. Add them on each business page.</Empty>
              ) : (
                <div className="space-y-2">
                  {r.kpis.map((k, i) => {
                    const pct = Math.min(100, k.percent ?? 0);
                    const fmt = (v: number) => (k.unit === "CURRENCY" ? formatKES(v) : k.unit === "PERCENT" ? `${v}%` : String(v));
                    return (
                      <div key={i} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-200 truncate">
                            <span className="text-slate-400">{k.business} · </span>
                            {k.name}
                          </span>
                          <span className="tabular-nums text-slate-300 shrink-0">
                            {fmt(k.value)} / {fmt(k.target)}
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                          <div className={`h-full ${pct >= 100 ? "bg-emerald-400/80" : pct >= 50 ? "bg-sky-400/70" : "bg-amber-400/70"}`} style={{ width: `${Math.max(3, pct)}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            <Card icon={<PauseCircle className="h-4 w-4 text-rose-300" />} title="Stalled projects">
              {r.stalled.length === 0 ? (
                <Empty>Every active project moved in the last 7 days.</Empty>
              ) : (
                <ul className="space-y-1.5 text-sm">
                  {r.stalled.map((p) => (
                    <li key={p.id} className="flex items-center gap-2">
                      <Link href={`/projects/${p.id}`} className="flex-1 text-slate-100 underline-offset-2 hover:underline truncate">
                        {p.name}
                      </Link>
                      <span className="text-[11px] text-rose-200 shrink-0">{p.days} days still</span>
                    </li>
                  ))}
                  <li className="text-xs text-slate-400">Give each one a next step, pause it, or let it go.</li>
                </ul>
              )}
            </Card>

            <Card icon={<Receipt className="h-4 w-4 text-slate-300" />} title="Before Monday">
              <ul className="text-sm text-slate-200 space-y-1.5 list-disc pl-4">
                <li>Clear Finance → “To check” so the month’s numbers are right.</li>
                <li>Move or drop anything overdue; tomorrow’s plan starts cleaner.</li>
                <li>Pick next week’s one big thing and add it as a high-priority task.</li>
              </ul>
              <div className="flex gap-3 text-xs">
                <Link href="/planner" className="text-sky-300 underline underline-offset-2">
                  Planner
                </Link>
                <Link href="/tasks" className="text-sky-300 underline underline-offset-2">
                  Tasks
                </Link>
                <Link href="/analytics" className="text-sky-300 underline underline-offset-2 inline-flex items-center gap-1">
                  <BarChart3 className="h-3 w-3" /> Analytics
                </Link>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
