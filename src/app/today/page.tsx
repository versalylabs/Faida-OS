"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  CalendarDays,
  Check,
  CheckSquare,
  GraduationCap,
  Loader2,
  Lock,
  Receipt,
  Smartphone,
  Sparkles,
  UtensilsCrossed,
  Video,
  Wallet,
} from "lucide-react";
import { formatKES } from "@/lib/utils";
import { offlineFetch } from "@/lib/offlineSync";

interface Block {
  id: string;
  taskId: string | null;
  title: string;
  startMin: number;
  endMin: number;
  why: string | null;
  part: { index: number; total: number } | null;
}

interface TodayData {
  now: { minutes: number; hour: number };
  plan: { locked: boolean; budgetMinutes: number; current: Block | null; next: Block | null; blocksLeft: number; blocksDone: number; dayOver: boolean };
  timed: { key: string; title: string; subtitle: string | null; source: string; start: string; end: string | null; href: string | null; join: string | null }[];
  tasks: { id: string; title: string; priority: string; dueDate: string; overdue: boolean }[];
  tasksTotal: number;
  overdue: number;
  money: { toCheck: number; toCheckOut: number; spentToday: number; bills: { id: string; name: string; amount: number | null; days: number }[] };
  meals: { mealType: string; title: string; isCompleted: boolean }[];
}

const clock = (min: number) => `${String(Math.floor(min / 60) % 24).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

function greeting(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

const priorityDot: Record<string, string> = { URGENT: "bg-rose-400", HIGH: "bg-amber-400", MEDIUM: "bg-sky-400", LOW: "bg-slate-500" };

/** Today: what to do now, what's next, what's due, and what needs a look. One screen, one request. */
export default function TodayPage() {
  const [data, setData] = useState<TodayData | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await offlineFetch("/api/today", { cache: "no-store", cacheKey: "today" });
      const json = await res.json();
      if (json.success) setData(json);
    } catch {
      // offline with nothing cached: the loading state stays
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(() => document.visibilityState === "visible" && load(), 60000);
    return () => clearInterval(t);
  }, [load]);

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
      await load();
    } catch {
      flash("You seem to be offline. Try again when you're back.");
    } finally {
      setBusy(null);
    }
  };

  const lockPlan = async () => {
    if (!data) return;
    setBusy("lock");
    try {
      const res = await fetch("/api/planner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "lock", hours: data.plan.budgetMinutes / 60 }),
      });
      const json = await res.json();
      flash(json.success ? "Locked in. You'll get a reminder as each block starts." : "That did not save. Try again.");
      await load();
    } finally {
      setBusy(null);
    }
  };

  if (!data) {
    return (
      <div className="py-24 text-center text-sm text-slate-300 flex items-center justify-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin text-sky-300" /> Getting your day…
      </div>
    );
  }

  const { plan, money } = data;
  const focus = plan.current ?? plan.next;
  const isNow = Boolean(plan.current);
  const dueBills = money.bills.filter((b) => b.days <= 3);

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-xs text-sky-300">{new Date().toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" })}</div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">{greeting(data.now.hour)}</h1>
        </div>
        <Link
          href="/capture"
          className="press flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-sky-400/15 border border-sky-300/40 text-sky-50 text-xs font-semibold shrink-0"
        >
          <Sparkles className="h-3.5 w-3.5" /> Capture
        </Link>
      </div>

      {message && <div className="p-3 rounded-2xl bg-emerald-400/10 border border-emerald-300/30 text-sm text-emerald-100">{message}</div>}

      {/* Now / next */}
      <section className="p-5 rounded-3xl bg-gradient-to-br from-sky-500/15 to-indigo-500/10 border border-sky-300/30 space-y-3">
        {focus ? (
          <>
            <div className="flex items-center gap-2 text-xs text-sky-200">
              <CalendarClock className="h-3.5 w-3.5" />
              {isNow ? `Now · until ${clock(focus.endMin)}` : `Up next · ${clock(focus.startMin)}`}
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
              <Link href="/planner" className="text-xs text-sky-200 underline underline-offset-2 ml-auto">
                {plan.blocksLeft} block{plan.blocksLeft === 1 ? "" : "s"} left{plan.blocksDone ? ` · ${plan.blocksDone} done` : ""}
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
      </section>

      {/* Needs a look: money */}
      {(money.toCheck > 0 || dueBills.length > 0 || money.spentToday > 0) && (
        <section className="grid gap-2 sm:grid-cols-3">
          {money.toCheck > 0 && (
            <Link href="/finance#review" className="press p-3.5 rounded-2xl bg-slate-900/60 border border-amber-300/30 flex items-center gap-3">
              <Smartphone className="h-4 w-4 text-amber-300 shrink-0" />
              <div className="min-w-0">
                <div className="text-sm text-white">{money.toCheck} M-Pesa to check</div>
                <div className="text-xs text-slate-400">{formatKES(money.toCheckOut)} out</div>
              </div>
            </Link>
          )}
          {dueBills.map((b) => (
            <Link key={b.id} href="/finance#bills" className={`press p-3.5 rounded-2xl bg-slate-900/60 border flex items-center gap-3 ${b.days < 0 ? "border-rose-300/40" : "border-white/10"}`}>
              <Receipt className={`h-4 w-4 shrink-0 ${b.days < 0 ? "text-rose-300" : "text-sky-300"}`} />
              <div className="min-w-0">
                <div className="text-sm text-white truncate">{b.name}</div>
                <div className={`text-xs ${b.days < 0 ? "text-rose-200" : "text-slate-400"}`}>
                  {b.days < 0 ? `Overdue ${-b.days}d` : b.days === 0 ? "Due today" : `Due in ${b.days}d`}
                  {b.amount ? ` · ${formatKES(b.amount)}` : ""}
                </div>
              </div>
            </Link>
          ))}
          {money.spentToday > 0 && (
            <Link href="/finance" className="press p-3.5 rounded-2xl bg-slate-900/60 border border-white/10 flex items-center gap-3">
              <Wallet className="h-4 w-4 text-slate-300 shrink-0" />
              <div>
                <div className="text-sm text-white">{formatKES(money.spentToday)}</div>
                <div className="text-xs text-slate-400">spent today</div>
              </div>
            </Link>
          )}
        </section>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {/* Coming up */}
        <section className="p-4 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-2.5">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-violet-300" /> Coming up today
          </h2>
          {data.timed.length === 0 ? (
            <p className="text-xs text-slate-400">No classes, meetings or reminders left today.</p>
          ) : (
            <ul className="space-y-2">
              {data.timed.map((t) => (
                <li key={t.key} className="flex items-center gap-2.5">
                  <span className="text-xs tabular-nums text-slate-300 w-11 shrink-0">{time(t.start)}</span>
                  {t.source === "CLASS" || t.source === "ZOOM" || t.source === "CAT" ? (
                    <GraduationCap className="h-3.5 w-3.5 text-sky-300 shrink-0" />
                  ) : (
                    <CalendarDays className="h-3.5 w-3.5 text-violet-300 shrink-0" />
                  )}
                  <span className="text-sm text-slate-100 truncate flex-1">{t.title}</span>
                  {t.join && (
                    <a
                      href={t.join}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="press flex items-center gap-1 px-2.5 py-1 rounded-full bg-sky-500/20 border border-sky-300/40 text-[11px] text-sky-50 shrink-0"
                    >
                      <Video className="h-3 w-3" /> Join
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Due */}
        <section className="p-4 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-2.5">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <CheckSquare className="h-4 w-4 text-emerald-300" /> Due today{data.overdue ? ` · ${data.overdue} overdue` : ""}
          </h2>
          {data.tasks.length === 0 ? (
            <p className="text-xs text-slate-400">Nothing due today. Nice.</p>
          ) : (
            <ul className="space-y-1.5">
              {data.tasks.map((t) => (
                <li key={t.id} className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full shrink-0 ${priorityDot[t.priority] || "bg-slate-500"}`} />
                  <span className={`text-sm truncate flex-1 ${t.overdue ? "text-rose-100" : "text-slate-100"}`}>{t.title}</span>
                  <button
                    onClick={() => taskAction(t.id, "COMPLETE", `Done: ${t.title}`)}
                    disabled={busy !== null}
                    title="Done"
                    className="press glass-orb h-7 w-7 text-emerald-200 cursor-pointer shrink-0"
                  >
                    {busy === t.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  </button>
                  <button
                    onClick={() => taskAction(t.id, "DEFER", `Moved to tomorrow: ${t.title}`)}
                    disabled={busy !== null}
                    title="Move to tomorrow"
                    className="press glass-orb h-7 w-7 text-slate-300 cursor-pointer shrink-0"
                  >
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
              {data.tasksTotal > data.tasks.length && (
                <li>
                  <Link href="/tasks" className="text-xs text-sky-300 underline underline-offset-2">
                    {data.tasksTotal - data.tasks.length} more in Tasks
                  </Link>
                </li>
              )}
            </ul>
          )}
        </section>
      </div>

      {/* Meals */}
      {data.meals.length > 0 && (
        <Link href="/menu" className="press block p-4 rounded-3xl bg-slate-900/60 border border-slate-800">
          <div className="text-sm font-semibold text-white flex items-center gap-2 mb-1.5">
            <UtensilsCrossed className="h-4 w-4 text-amber-300" /> Today&apos;s meals
          </div>
          <div className="text-sm text-slate-200 flex flex-wrap gap-x-4 gap-y-1">
            {data.meals.map((m) => (
              <span key={m.mealType} className={m.isCompleted ? "line-through text-slate-500" : ""}>
                <span className="text-xs text-slate-400">{m.mealType.charAt(0) + m.mealType.slice(1).toLowerCase()}: </span>
                {m.title}
              </span>
            ))}
          </div>
        </Link>
      )}
    </div>
  );
}
