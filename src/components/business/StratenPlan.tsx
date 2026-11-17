"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, ExternalLink, FolderGit2, Loader2, RefreshCw, Target } from "lucide-react";
import { offlineFetch } from "@/lib/offlineSync";
import { nairobiToday } from "@/lib/dueDay";
import { formatKES } from "@/lib/utils";
import {
  STRATEN_CAPACITY,
  STRATEN_CATALOG,
  STRATEN_COMPLIANCE,
  STRATEN_DIVISIONS,
  STRATEN_ECONOMICS,
  STRATEN_PHASES,
  STRATEN_PLAN_MARKER,
  STRATEN_PROFILE,
  STRATEN_PROJECT_DESCRIPTION,
  STRATEN_PROJECT_NAME,
  STRATEN_REVENUE_MILESTONES,
  STRATEN_RULES,
  STRATEN_SEGMENTS,
  STRATEN_VERSALY_LINK,
  phaseMilestone,
  type Phase,
} from "@/lib/playbooks";
import type { BusinessItem } from "@/components/business/types";
import { Badge, Card, ProgressBar, daysFromToday, primaryBtn } from "@/components/business/ui";

const todayKey = nairobiToday;
const dayDiff = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
const shortDate = (key: string) => new Date(`${key}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

function phaseState(p: Phase, today: string): "done" | "now" | "next" {
  if (today > p.end) return "done";
  if (today >= p.start) return "now";
  return "next";
}

function KpiRow({ label, actual, target, format, hint }: { label: string; actual: number; target: number; format?: (n: number) => string; hint?: string }) {
  const fmt = format ?? ((n: number) => String(n));
  const pct = target > 0 ? (actual / target) * 100 : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="text-slate-300">{label}</span>
        <span className="font-mono text-slate-200 shrink-0">
          {fmt(actual)} <span className="text-slate-500">/ {fmt(target)}</span>
        </span>
      </div>
      <ProgressBar percent={pct} color={pct >= 100 ? "#10b981" : "#f59e0b"} />
      {hint && <p className="text-[10px] text-slate-500">{hint}</p>}
    </div>
  );
}

interface TrackedProject {
  id: string;
  description: string;
}

const jsonOf = async (res: any) => (await res).json();

export function StratenPlan({ business }: { business: BusinessItem }) {
  const today = todayKey();
  const [project, setProject] = useState<TrackedProject | null>(null);
  const [checking, setChecking] = useState(true);
  const [checkFailed, setCheckFailed] = useState(false);
  const [creating, setCreating] = useState<{ done: number; total: number } | null>(null);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [synced, setSynced] = useState("");
  const [error, setError] = useState("");

  // Returns true once the project list has really been read, so a failed read is never mistaken for "no project yet"
  const loadProject = async (): Promise<boolean> => {
    try {
      const d = await jsonOf(offlineFetch("/api/projects", { cache: "no-store" }));
      if (!d?.success) return false;
      const found = (d.projects || []).find((p: any) => p.name === STRATEN_PROJECT_NAME);
      setProject(found ? { id: found.id, description: found.description || "" } : null);
      return true;
    } catch {
      return false;
    }
  };

  // Has the launch plan already been turned into a tracked project? Try a few times before giving up.
  useEffect(() => {
    let alive = true;
    (async () => {
      for (let attempt = 0; attempt < 3 && alive; attempt++) {
        if (await loadProject()) {
          if (alive) setChecking(false);
          return;
        }
        await new Promise((r) => setTimeout(r, 1500));
      }
      if (alive) {
        setCheckFailed(true);
        setChecking(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const needsSync = !!project && !project.description.includes(STRATEN_PLAN_MARKER);

  const createProject = async () => {
    setError("");
    const total = STRATEN_PHASES.reduce((n, p) => n + p.tasks.length, 0);
    setCreating({ done: 0, total });
    try {
      const res = await offlineFetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: STRATEN_PROJECT_NAME,
          description: STRATEN_PROJECT_DESCRIPTION,
          color: "#f59e0b",
          targetDate: STRATEN_PHASES[STRATEN_PHASES.length - 1].end,
          milestones: STRATEN_PHASES.map((p) => ({ title: p.name, dueDate: p.end })),
        }),
      });
      const data = await res.json();
      if (!data.success || !data.project?.id) throw new Error(data.error || "Could not create the project");
      const id = data.project.id as string;
      setProject({ id, description: STRATEN_PROJECT_DESCRIPTION });

      const full = await jsonOf(offlineFetch(`/api/projects/${id}`, { cache: "no-store" })).catch(() => null);
      const milestones: { id: string; title: string }[] = full?.project?.milestones || [];

      let done = 0;
      for (const phase of STRATEN_PHASES) {
        const milestoneId = phaseMilestone(phase, milestones)?.id;
        for (const task of phase.tasks) {
          await offlineFetch("/api/tasks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: task.title, projectId: id, milestoneId, dueDate: task.due ?? phase.end, priority: "MEDIUM", estimatedMinutes: 60, category: "Straten" }),
          });
          done++;
          setCreating({ done, total });
        }
      }
    } catch (e: any) {
      setError(e?.message || "Something went wrong while creating the project");
    } finally {
      setCreating(null);
    }
  };

  /** Brings a project made from the first plan up to the revised one (the server only adds, renames and links; it never deletes). */
  const syncProject = async () => {
    if (!project) return;
    setError("");
    setSynced("");
    setSyncing("Updating...");
    try {
      const res = await fetch("/api/business/straten-plan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId: project.id }) });
      const d = await res.json();
      if (!d.success) throw new Error(d.error || "The update failed");
      await loadProject();
      const n = (v: number, one: string, many: string) => `${v} ${v === 1 ? one : many}`;
      const bits = [
        d.addedTasks && n(d.addedTasks, "new task", "new tasks"),
        d.addedMilestones && n(d.addedMilestones, "new milestone", "new milestones"),
        d.renamed && n(d.renamed, "task renamed", "tasks renamed"),
        d.linked && n(d.linked, "task linked to its phase", "tasks linked to their phase"),
      ].filter(Boolean);
      setSynced(`Done: ${bits.length ? bits.join(", ") : "everything was already in place"}. Nothing was deleted.`);
    } catch (e: any) {
      setError(`${e?.message || "The update failed"}. Nothing was deleted; you can run it again.`);
    } finally {
      setSyncing(null);
    }
  };

  // ---- real numbers (nothing invented: no data means 0) ----
  const clients = business.clients;
  const paying = clients.filter((c) => c.status === "ACTIVE" || c.status === "COMPLETED").length;

  const current = STRATEN_PHASES.find((p) => !p.parallel && phaseState(p, today) === "now");
  const upcoming = STRATEN_PHASES.find((p) => phaseState(p, today) === "next");
  const planEnded = !current && !upcoming;

  const groups = Array.from(new Set(STRATEN_CATALOG.map((c) => c.group)));

  return (
    <div className="space-y-4">
      <Card title="First milestone" icon={<Target className="h-3.5 w-3.5 text-amber-400" />}>
        <p className="text-xs text-slate-300 leading-relaxed">{STRATEN_PROFILE.firstMilestone}</p>
        <KpiRow label={STRATEN_PROFILE.firstMilestoneEarly.label} actual={paying} target={STRATEN_PROFILE.firstMilestoneEarly.target} hint="From existing clients, referrals and warm contacts." />
        <KpiRow label={`Paying customers by ${STRATEN_PROFILE.firstMilestoneBy}`} actual={paying} target={STRATEN_PROFILE.firstMilestoneTarget} hint="Clients marked Active or Completed." />
      </Card>

      <Card
        title="Roadmap"
        action={
          checking ? (
            <span className="text-[11px] text-slate-500 flex items-center gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin" /> Checking your projects...
            </span>
          ) : checkFailed ? (
            <span className="text-[11px] text-slate-500">Could not check your projects. Reload to try again.</span>
          ) : project ? (
            <Link href={`/projects/${project.id}`} className="flex items-center gap-1.5 text-xs font-semibold text-blue-400 hover:text-blue-300">
              <FolderGit2 className="h-3.5 w-3.5" /> Open the tracking project <ExternalLink className="h-3 w-3" />
            </Link>
          ) : (
            <button onClick={createProject} disabled={!!creating} className={`${primaryBtn} flex items-center gap-1.5`}>
              {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FolderGit2 className="h-3.5 w-3.5" />}
              {creating ? `Creating ${creating.done}/${creating.total}...` : "Track this plan as a project"}
            </button>
          )
        }
      >
        <p className="text-[11px] text-slate-500">
          {project
            ? "These phases and tasks live in your Projects, with due dates, the roadmap view and stalled warnings."
            : "Creates one project with a milestone per phase (dated) and a task for every step, so the plan shows up in your planner and reminders."}
        </p>
        {needsSync && (
          <div className="p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-2">
            <p className="text-xs font-semibold text-amber-300">Your tracking project follows the first version of the plan</p>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              The revised plan adds a revenue sprint and a few compliance, capacity and review tasks. Updating adds only what is new, links your existing tasks to their phase and fixes one renamed task. It never deletes anything or changes your dates, and finished work stays as it is.
            </p>
            <button onClick={syncProject} disabled={!!syncing} className={`${primaryBtn} flex items-center gap-1.5`}>
              {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              {syncing ?? "Update my project to the revised plan"}
            </button>
          </div>
        )}
        {synced && <p className="text-xs text-emerald-400">{synced}</p>}
        {error && <p className="text-xs text-rose-400">{error}</p>}
        <div className="space-y-3">
          {STRATEN_PHASES.map((p) => {
            const state = phaseState(p, today);
            const left = daysFromToday(`${p.end}T12:00:00+03:00`);
            return (
              <details key={p.id} open={state === "now"} className="group rounded-xl bg-slate-950/50 border border-slate-800/80 open:border-slate-700">
                <summary className="list-none cursor-pointer p-3.5 flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-100">
                      {p.name}
                      {p.parallel && <span className="ml-2 align-middle"><Badge tone="blue">alongside phases 1 to 3</Badge></span>}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {shortDate(p.start)} to {shortDate(p.end)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {state === "now" && left !== null && <span className="text-[11px] text-amber-300 font-mono">{left <= 0 ? "ends today" : `${left}d left`}</span>}
                    <Badge tone={state === "done" ? "green" : state === "now" ? "amber" : "slate"}>{state === "done" ? "past" : state === "now" ? "in progress" : `starts in ${dayDiff(today, p.start)}d`}</Badge>
                  </div>
                </summary>
                <div className="px-3.5 pb-3.5 space-y-3">
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
                    {p.tasks.map((t) => (
                      <li key={t.title} className="flex items-start gap-2 text-xs text-slate-300">
                        {state === "done" ? <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0 text-slate-600" /> : <Circle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-slate-600" />}
                        <span className="break-words min-w-0">
                          {t.title}
                          {t.due && t.due !== p.end && <span className="text-slate-500"> ({shortDate(t.due)})</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-[11px] text-slate-400">
                    <span className="font-semibold text-slate-300">Done when: </span>
                    {p.completion}
                  </p>
                </div>
              </details>
            );
          })}
        </div>
        <p className="text-[11px] text-slate-500">
          {planEnded
            ? "The launch roadmap has finished. Time to write the next six-month plan."
            : current
            ? `You are in ${current.name.toLowerCase()}.`
            : upcoming
            ? `The plan starts on ${shortDate(upcoming.start)}.`
            : ""}{" "}
          The holiday period may slow prospects, and January is cash-tight for many buyers: lean on small kits paid in advance and follow-ups with December customers.
        </p>
      </Card>

      <Card title="Targets">
        <p className="text-xs text-slate-300 leading-relaxed">
          The plan's monthly targets (prospects researched, outreach, conversations, consultations, proposals, paying and recurring customers, contribution per founder hour, satisfaction, revenue) are tracked in the <strong className="text-white">KPIs</strong> tab, where you can update them as you go and change any target.
        </p>
      </Card>

      <Card title="Positioning">
        <div className="space-y-2 text-xs text-slate-300">
          <p>
            <span className="text-slate-500">Positioning: </span>
            {STRATEN_PROFILE.positioning}
          </p>
          <p>
            <span className="text-slate-500">Tagline: </span>
            {STRATEN_PROFILE.tagline}
          </p>
          <p>
            <span className="text-slate-500">Website headline: </span>
            {STRATEN_PROFILE.headline}
          </p>
          <p>
            <span className="text-slate-500">Sales message: </span>
            {STRATEN_PROFILE.salesMessage}
          </p>
          <p>
            <span className="text-slate-500">Core promise: </span>
            {STRATEN_PROFILE.corePromise}
          </p>
          <p className="text-slate-400">{STRATEN_PROFILE.note}</p>
        </div>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,15rem),1fr))] gap-3 pt-1">
          {STRATEN_DIVISIONS.map((d) => (
            <div key={d.name} className="p-3 rounded-xl bg-slate-950/50 border border-slate-800/80 space-y-1">
              <div className="text-xs font-semibold text-slate-100">{d.name}</div>
              <p className="text-[11px] text-slate-400 leading-relaxed">{d.text}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Who to sell to">
        <div className="space-y-2">
          {STRATEN_SEGMENTS.map((s) => (
            <div key={s.name} className="flex gap-3 p-3 rounded-xl bg-slate-950/50 border border-slate-800/80">
              <span className="h-6 w-6 shrink-0 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold flex items-center justify-center">{s.rank}</span>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-slate-100 flex flex-wrap items-center gap-2">
                  {s.name}
                  <Badge tone={s.launch ? "amber" : "slate"}>{s.launch ? "launch segment" : "inbound only"}</Badge>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">{s.text}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Price list (proposed test prices)">
        <p className="text-[11px] text-slate-500">Not verified market rates: test willingness to pay and record real production costs before treating any price as permanent. Prices are filled in automatically when you add a client.</p>
        <div className="space-y-3">
          {groups.map((g) => (
            <details key={g} className="rounded-xl bg-slate-950/50 border border-slate-800/80">
              <summary className="list-none cursor-pointer p-3 flex items-center justify-between text-xs font-semibold text-slate-200">
                {g}
                <span className="font-mono text-[11px] text-slate-500">{STRATEN_CATALOG.filter((c) => c.group === g).length}</span>
              </summary>
              <div className="px-3 pb-3 space-y-2">
                {STRATEN_CATALOG.filter((c) => c.group === g).map((c) => (
                  <div key={c.name} className="flex items-start justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <div className="text-slate-200">{c.name}</div>
                      <div className="text-[11px] text-slate-500 break-words">{c.scope}</div>
                    </div>
                    <span className="font-mono text-slate-300 shrink-0">
                      {formatKES(c.price)}
                      {c.startingFrom ? "+" : ""}
                      {c.billing === "MONTHLY" ? "/mo" : ""}
                    </span>
                  </div>
                ))}
              </div>
            </details>
          ))}
        </div>
      </Card>

      <Card title="Revenue milestones">
        <p className="text-[11px] text-slate-500">Planning milestones for monthly revenue, not forecasts. Never let a target justify unprofitable pricing or more work than you can deliver.</p>
        <div className="space-y-2">
          {STRATEN_REVENUE_MILESTONES.map((m) => (
            <div key={m.label} className="flex items-start justify-between gap-3 p-3 rounded-xl bg-slate-950/50 border border-slate-800/80 text-xs">
              <div className="min-w-0">
                <div className="text-slate-200 font-semibold">{m.label}</div>
                <div className="text-[11px] text-slate-500">{m.needs}</div>
              </div>
              <span className="font-mono text-slate-200 shrink-0">{formatKES(m.amount)}</span>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-slate-500">{STRATEN_ECONOMICS.firstNinetyDays.note} That adds up to {formatKES(STRATEN_ECONOMICS.firstNinetyDays.total)}.</p>
      </Card>

      <Card title="Your time and the numbers">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Weekly time for Straten</h3>
            <div className="space-y-1 text-xs text-slate-300">
              {STRATEN_CAPACITY.hours.map((h) => (
                <div key={h.activity} className="flex justify-between gap-3">
                  <span>{h.activity}</span>
                  <span className="font-mono text-slate-400 shrink-0">{h.hours}</span>
                </div>
              ))}
              <div className="flex justify-between gap-3 pt-1 border-t border-slate-800 font-semibold text-slate-200">
                <span>Total</span>
                <span className="font-mono shrink-0">{STRATEN_CAPACITY.total}</span>
              </div>
            </div>
            <ul className="space-y-1.5 text-xs text-slate-300 list-disc pl-4">
              {STRATEN_CAPACITY.rules.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
          <div className="space-y-2">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Profit and break-even</h3>
            <ul className="space-y-1.5 text-xs text-slate-300 list-disc pl-4">
              {STRATEN_ECONOMICS.lines.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        </div>
      </Card>

      <Card title="Working with VersalyLabs">
        <p className="text-xs text-slate-300 leading-relaxed">{STRATEN_VERSALY_LINK.summary}</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Run it at arm's length</h3>
            <ul className="space-y-1.5 text-xs text-slate-300 list-disc pl-4">
              {STRATEN_VERSALY_LINK.rules.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            <p className="text-[11px] text-slate-500 leading-relaxed">{STRATEN_VERSALY_LINK.referral}</p>
          </div>
          <div className="space-y-2">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">The restaurant bridge to Melio</h3>
            <ol className="space-y-1.5 text-xs text-slate-300 list-decimal pl-4">
              {STRATEN_VERSALY_LINK.bridge.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ol>
          </div>
        </div>
      </Card>

      <Card title="Tax and data protection (checked Nov 2026)">
        <ul className="space-y-1.5 text-xs text-slate-300 list-disc pl-4">
          {STRATEN_COMPLIANCE.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
        <p className="text-[11px] text-slate-500">This is not legal or tax advice. Confirm current requirements with a qualified Kenyan accountant or lawyer.</p>
      </Card>

      <Card title="How Straten operates">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Payment</h3>
            <ul className="space-y-1.5 text-xs text-slate-300 list-disc pl-4">
              {STRATEN_RULES.payment.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
          <div className="space-y-2">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Not included unless quoted</h3>
            <ul className="space-y-1.5 text-xs text-slate-300 list-disc pl-4">
              {STRATEN_RULES.exclusions.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
          <div className="space-y-2">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Delivery workflow</h3>
            <ol className="space-y-1 text-xs text-slate-300 list-decimal pl-4">
              {STRATEN_RULES.workflow.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ol>
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Prospect score (out of 100)</h3>
              <div className="space-y-1 text-xs text-slate-300">
                {STRATEN_RULES.qualification.map((q) => (
                  <div key={q.factor} className="flex justify-between gap-3">
                    <span>{q.factor}</span>
                    <span className="font-mono text-slate-400">{q.points}</span>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-slate-500">{STRATEN_RULES.qualificationBands}</p>
            </div>
            <div className="space-y-2">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Outreach rules</h3>
              <ul className="space-y-1.5 text-xs text-slate-300 list-disc pl-4">
                {STRATEN_RULES.outreach.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
