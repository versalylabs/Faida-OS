"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarClock, Check, CheckSquare, Loader2, Lock, Receipt, Smartphone } from "lucide-react";
import { formatKES } from "@/lib/utils";
import { offlineFetch } from "@/lib/offlineSync";

/** What /api/today returns: shared by the Today page and the Command Center's "Right now" card. */
export interface TodayBlock {
  id: string;
  taskId: string | null;
  title: string;
  startMin: number;
  endMin: number;
  why: string | null;
  part: { index: number; total: number } | null;
}

export interface TodayData {
  now: { minutes: number; hour: number };
  plan: { locked: boolean; budgetMinutes: number; current: TodayBlock | null; next: TodayBlock | null; blocksLeft: number; blocksDone: number; dayOver: boolean };
  timed: { key: string; title: string; subtitle: string | null; source: string; start: string; end: string | null; href: string | null; join: string | null }[];
  tasks: { id: string; title: string; priority: string; dueDate: string; overdue: boolean }[];
  tasksTotal: number;
  overdue: number;
  money: { toCheck: number; toCheckOut: number; spentToday: number; bills: { id: string; name: string; amount: number | null; days: number }[] };
  meals: { mealType: string; title: string; isCompleted: boolean }[];
}

/** Loads /api/today (cached for offline use) and refreshes it every minute while the page is visible. */
export function useToday() {
  const [data, setData] = useState<TodayData | null>(null);
  const load = useCallback(async () => {
    try {
      const res = await offlineFetch("/api/today", { cache: "no-store", cacheKey: "today" });
      const json = await res.json();
      if (json.success) setData(json);
    } catch {
      // offline with nothing cached
    }
  }, []);
  useEffect(() => {
    load();
    const t = setInterval(() => document.visibilityState === "visible" && load(), 60000);
    return () => clearInterval(t);
  }, [load]);
  return { data, reload: load };
}

const clock = (min: number) => `${String(Math.floor(min / 60) % 24).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/**
 * The block to do now (or next), with Done, Tomorrow and Lock today's plan. `compact` adds the
 * "needs a look" chips (M-Pesa to check, bills, due today) for the Command Center.
 */
export function RightNow({ data, reload, compact = false }: { data: TodayData; reload: () => Promise<void>; compact?: boolean }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const flash = (text: string) => {
    setMessage(text);
    setTimeout(() => setMessage(null), 4000);
  };

  const taskAction = async (taskId: string, action: "COMPLETE" | "DEFER", okText: string) => {
    setBusy(taskId);
    try {
      const res = await fetch("/api/effort", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, taskId, days: 1 }) });
      const json = await res.json();
      flash(json.success ? okText : "That did not save. Try again.");
      await reload();
    } catch {
      flash("You seem to be offline. Try again when you're back.");
    } finally {
      setBusy(null);
    }
  };

  const lockPlan = async () => {
    setBusy("lock");
    try {
      const res = await fetch("/api/planner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "lock", hours: data.plan.budgetMinutes / 60 }),
      });
      const json = await res.json();
      flash(json.success ? "Locked in. You'll get a reminder as each block starts." : "That did not save. Try again.");
      await reload();
    } catch {
      flash("You seem to be offline. Try again when you're back.");
    } finally {
      setBusy(null);
    }
  };

  const { plan, money } = data;
  const focus = plan.current ?? plan.next;
  const isNow = Boolean(plan.current);
  const dueBills = money.bills.filter((b) => b.days <= 3);
  const dueToday = data.tasksTotal;

  return (
    <section className="glass-hero p-5 sm:p-6 rounded-3xl space-y-3">
      {message && <div className="p-2.5 rounded-xl bg-emerald-400/10 border border-emerald-300/30 text-sm text-emerald-100">{message}</div>}

      <div className={compact ? "flex flex-col lg:flex-row lg:items-start gap-4" : ""}>
        <div className="flex-1 min-w-0 space-y-3">
          {focus ? (
            <>
              <div className="flex items-center gap-2 text-xs text-sky-200">
                <CalendarClock className="h-3.5 w-3.5" />
                {isNow ? `Right now · until ${clock(focus.endMin)}` : `Up next · ${clock(focus.startMin)}`}
                {focus.part && <span className="text-sky-300/80">· part {focus.part.index} of {focus.part.total}</span>}
              </div>
              <div className="text-xl font-semibold text-white break-words">{focus.title}</div>
              {focus.why && <div className="text-xs text-amber-200">{focus.why}</div>}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {focus.taskId && (
                  <>
                    <button
                      onClick={() => taskAction(focus.taskId!, "COMPLETE", `Done: ${focus.title}`)}
                      disabled={busy !== null}
                      className="press flex items-center gap-1.5 px-4 py-2 rounded-full bg-emerald-500/25 border border-emerald-300/50 text-emerald-50 text-sm font-medium cursor-pointer disabled:opacity-50"
                    >
                      {busy === focus.taskId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Done
                    </button>
                    <button
                      onClick={() => taskAction(focus.taskId!, "DEFER", `Moved to tomorrow: ${focus.title}`)}
                      disabled={busy !== null}
                      className="press px-4 py-2 rounded-full bg-slate-900/60 border border-white/15 text-slate-100 text-sm cursor-pointer disabled:opacity-50"
                    >
                      Tomorrow
                    </button>
                  </>
                )}
                {!plan.locked && (
                  <button
                    onClick={lockPlan}
                    disabled={busy !== null}
                    className="press flex items-center gap-1.5 px-4 py-2 rounded-full bg-slate-900/60 border border-sky-300/40 text-sky-50 text-sm cursor-pointer disabled:opacity-50"
                  >
                    {busy === "lock" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />} Lock today&apos;s plan
                  </button>
                )}
                <Link href="/planner" className="link-chip sm:ml-auto" title="Open the Daily Planner">
                  <CalendarClock />
                  {plan.blocksLeft} block{plan.blocksLeft === 1 ? "" : "s"} left{plan.blocksDone ? `, ${plan.blocksDone} done` : ""}
                </Link>
              </div>
            </>
          ) : (
            <div className="space-y-1">
              <div className="text-xs text-sky-200">{plan.dayOver ? "Evening" : "Nothing planned"}</div>
              <div className="text-lg font-semibold text-white">{plan.dayOver ? "The working day is done." : "No open work fits today."}</div>
              <p className="text-sm text-slate-300">{plan.dayOver ? "What's left will be first in tomorrow's plan." : "Capture something, or enjoy the space."}</p>
            </div>
          )}
        </div>

        {compact && (
          <div className="flex flex-wrap lg:flex-col gap-2 lg:w-64 shrink-0">
            <Link href="/tasks" className="press flex items-center gap-2 px-3 py-2 rounded-2xl bg-slate-900/60 border border-white/10 text-xs text-slate-100">
              <CheckSquare className="h-3.5 w-3.5 text-emerald-300" />
              {dueToday ? `${dueToday} due today` : "Nothing due today"}
            </Link>
            {data.overdue > 0 && (
              <Link
                href="/calendar?review=overdue"
                className="press flex items-center gap-2 px-3 py-2 rounded-2xl bg-slate-900/60 border border-rose-300/40 text-xs text-rose-50"
              >
                <CheckSquare className="h-3.5 w-3.5 text-rose-300" />
                {data.overdue} overdue · review
              </Link>
            )}
            {money.toCheck > 0 && (
              <Link href="/finance#review" className="press flex items-center gap-2 px-3 py-2 rounded-2xl bg-slate-900/60 border border-amber-300/30 text-xs text-slate-100">
                <Smartphone className="h-3.5 w-3.5 text-amber-300" />
                {money.toCheck} M-Pesa to check · {formatKES(money.toCheckOut)}
              </Link>
            )}
            {dueBills.map((b) => (
              <Link
                key={b.id}
                href="/finance#bills"
                className={`press flex items-center gap-2 px-3 py-2 rounded-2xl bg-slate-900/60 border text-xs text-slate-100 ${b.days < 0 ? "border-rose-300/40" : "border-white/10"}`}
              >
                <Receipt className={`h-3.5 w-3.5 ${b.days < 0 ? "text-rose-300" : "text-sky-300"}`} />
                <span className="truncate">
                  {b.name} · {b.days < 0 ? `overdue ${-b.days}d` : b.days === 0 ? "due today" : `due in ${b.days}d`}
                </span>
              </Link>
            ))}
            <Link href="/today" className="link-chip self-start">
              Open Today <ArrowRight />
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}

/** The Command Center's "Right now" card: loads its own data. */
export function RightNowCard() {
  const { data, reload } = useToday();
  if (!data) {
    return <div className="h-32 rounded-3xl bg-slate-900/40 border border-slate-800 animate-pulse" aria-label="Loading right now" />;
  }
  return <RightNow data={data} reload={reload} compact />;
}
