"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, FolderGit2, Loader2, Target } from "lucide-react";
import { VERSALY_STAGES, parseProductTag } from "@/lib/businessMath";
import {
  VERSALY_MILESTONES,
  VERSALY_MODEL,
  VERSALY_ONBOARDING,
  VERSALY_PHASES,
  VERSALY_PLAN_START,
  VERSALY_PROFILE,
  VERSALY_PROJECT_NAME,
  VERSALY_QUALIFICATION,
  VERSALY_TARGETS,
  planDate,
} from "@/lib/versalyPlaybook";
import { nairobiToday } from "@/lib/dueDay";
import type { BusinessItem } from "@/components/business/types";
import { createTrackedProject, fetchProjects } from "@/components/business/trackProject";
import { Badge, Card, ProgressBar, daysFromToday, primaryBtn } from "@/components/business/ui";

const shortDate = (key: string) => new Date(`${key}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const today = nairobiToday;

function Row({ label, actual, target, hint }: { label: string; actual: number; target: number; hint?: string }) {
  const pct = target > 0 ? (actual / target) * 100 : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="text-slate-300">{label}</span>
        <span className="font-mono text-slate-200 shrink-0">
          {actual} <span className="text-slate-500">/ {target}</span>
        </span>
      </div>
      <ProgressBar percent={pct} color={pct >= 100 ? "#10b981" : "#3b82f6"} />
      {hint && <p className="text-[10px] text-slate-500">{hint}</p>}
    </div>
  );
}

export function VersalyPlan({ business }: { business: BusinessItem }) {
  const t = today();
  const [projectId, setProjectId] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [creating, setCreating] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    fetchProjects()
      .then((list) => alive && setProjectId(list.find((p) => p.name === VERSALY_PROJECT_NAME)?.id ?? null))
      .catch(() => {})
      .finally(() => alive && setChecking(false));
    return () => {
      alive = false;
    };
  }, []);

  const track = async () => {
    setError("");
    const early = VERSALY_PHASES.filter((p) => p.fromMonth < 6);
    const total = early.reduce((n, p) => n + p.activities.length, 0);
    setCreating({ done: 0, total });
    try {
      const id = await createTrackedProject(
        {
          name: VERSALY_PROJECT_NAME,
          description: "VersalyLabs business plan: company foundations, customer discovery, paid pilots, first recurring revenue, retention and the next funding round.",
          color: "#3b82f6",
          targetDate: planDate(12),
          milestones: VERSALY_MILESTONES.map((m) => ({ title: m.title, dueDate: planDate(m.atMonth) })),
          tasks: early.flatMap((p) => p.activities.map((title) => ({ title, dueDate: planDate(p.toMonth), category: "VersalyLabs" }))),
        },
        (done, tot) => setCreating({ done, total: tot })
      );
      setProjectId(id);
    } catch (e: any) {
      setError(e?.message || "Something went wrong while creating the project");
    } finally {
      setCreating(null);
    }
  };

  // ---- live validation numbers from the sales pipeline (a stage reached counts, even if the prospect moved on) ----
  const order = VERSALY_STAGES.filter((s) => s.kind !== "closed").map((s) => s.key);
  const reached = (stage: string) => business.clients.filter((c) => order.indexOf(c.status) >= order.indexOf(stage)).length;
  const interviews = reached("DISCOVERY");
  const contacted = reached("CONTACTED");
  const demos = reached("DEMO");
  const qualified = reached("QUALIFIED");
  const pilots = reached("PILOT");
  const paying = business.clients.filter((c) => c.status === "ACTIVE").length;
  const productInterviews = (product: string) =>
    business.clients.filter((c) => parseProductTag(c.scope).product === product && order.indexOf(c.status) >= order.indexOf("DISCOVERY")).length;

  return (
    <div className="space-y-4">
      <Card title="Where VersalyLabs is" icon={<Target className="h-3.5 w-3.5 text-blue-400" />}>
        <p className="text-xs text-slate-300 leading-relaxed">{VERSALY_PROFILE.oneLiner}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-xs">
          {[
            ["Stage", VERSALY_PROFILE.stage],
            ["Based in", VERSALY_PROFILE.hq],
            ["Founders", VERSALY_PROFILE.founders.join(" and ")],
            ["Ownership", VERSALY_PROFILE.ownership],
            ["Valuation", VERSALY_PROFILE.valuation],
            ["Spent so far", VERSALY_PROFILE.spendToDate],
          ].map(([k, v]) => (
            <p key={k} className="text-slate-300 break-words">
              <span className="text-slate-500">{k}: </span>
              {v}
            </p>
          ))}
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          <span className="font-semibold text-slate-300">Focus: </span>
          {VERSALY_PROFILE.focus}
        </p>
        <p className="text-[11px] text-slate-500">{VERSALY_PROFILE.note}</p>
      </Card>

      <Card title="12-month validation targets">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
          <Row label="Customer discovery interviews" actual={interviews} target={VERSALY_TARGETS.interviews} hint={`Prospects that reached "Discovery done" or later. The plan aims for ${VERSALY_TARGETS.interviews} to ${VERSALY_TARGETS.interviewsStretch}.`} />
          <Row label="Businesses contacted" actual={contacted} target={VERSALY_TARGETS.contacted} hint='Prospects that reached "Contacted" or later. The plan says 50 or more.' />
          <Row label="Product demonstrations" actual={demos} target={VERSALY_TARGETS.demos} />
          <Row label="Qualified pilot opportunities" actual={qualified} target={VERSALY_TARGETS.pilots} hint="Prospects qualified, in demo, proposal, pilot or paying." />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {["Melio RMS", "Mylkio", "Dukaset"].map((p) => (
            <div key={p} className="p-3 rounded-xl bg-slate-950/50 border border-slate-800/80">
              <Row label={`${p} interviews`} actual={productInterviews(p)} target={VERSALY_TARGETS.perProductInterviews} />
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 text-[11px]">
          <Badge tone="purple">{pilots} pilot{pilots === 1 ? "" : "s"} active or beyond</Badge>
          <Badge tone="green">{paying} paying customer{paying === 1 ? "" : "s"}</Badge>
        </div>
        <p className="text-[11px] text-slate-500">
          Counted from your VersalyLabs pipeline. Set each prospect&apos;s product and move them through the stages in the Clients tab. The plan values detailed interviews with real decision-makers over raw counts.
        </p>
      </Card>

      <Card
        title="Roadmap and milestones"
        action={
          checking ? null : projectId ? (
            <Link href={`/projects/${projectId}`} className="flex items-center gap-1.5 text-xs font-semibold text-blue-400 hover:text-blue-300">
              <FolderGit2 className="h-3.5 w-3.5" /> Open the tracking project <ExternalLink className="h-3 w-3" />
            </Link>
          ) : (
            <button onClick={track} disabled={!!creating} className={`${primaryBtn} flex items-center gap-1.5`}>
              {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FolderGit2 className="h-3.5 w-3.5" />}
              {creating ? `Creating ${creating.done}/${creating.total}...` : "Track this plan as a project"}
            </button>
          )
        }
      >
        <p className="text-[11px] text-slate-500">
          The plan counts in months from the start, here {shortDate(VERSALY_PLAN_START)}.{" "}
          {projectId ? "The milestones and first-six-month tasks live in your Projects, with dates, reminders and stalled warnings." : "Creates one project with the 8 company milestones (dated) and a task for every step of the first six months."}
        </p>
        {error && <p className="text-xs text-rose-400">{error}</p>}

        <div className="space-y-2">
          {VERSALY_MILESTONES.map((m) => {
            const due = planDate(m.atMonth);
            const days = daysFromToday(`${due}T12:00:00+03:00`);
            const late = days !== null && days < 0;
            return (
              <div key={m.title} className="p-3 rounded-xl bg-slate-950/50 border border-slate-800/80 space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-100">{m.title}</span>
                  <div className="flex items-center gap-2">
                    <Badge tone="slate">{m.period}</Badge>
                    <Badge tone={late ? "rose" : days !== null && days <= 14 ? "amber" : "slate"}>{shortDate(due)}</Badge>
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 break-words">Done when: {m.evidence}</p>
              </div>
            );
          })}
        </div>

        <div className="space-y-3 pt-2">
          {VERSALY_PHASES.map((p) => {
            const from = planDate(p.fromMonth);
            const to = planDate(p.toMonth);
            const state = t > to ? "past" : t >= from ? "now" : "next";
            return (
              <details key={p.id} open={state === "now"} className="rounded-xl bg-slate-950/50 border border-slate-800/80 open:border-slate-700">
                <summary className="list-none cursor-pointer p-3.5 flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-100">{p.name}</div>
                    <div className="text-[11px] text-slate-500">
                      {shortDate(from)} to {shortDate(to)}
                    </div>
                  </div>
                  <Badge tone={state === "now" ? "amber" : state === "past" ? "green" : "slate"}>{state === "now" ? "in progress" : state === "past" ? "past" : "upcoming"}</Badge>
                </summary>
                <div className="px-3.5 pb-3.5 space-y-3">
                  <p className="text-[11px] text-slate-400">
                    <span className="font-semibold text-slate-300">Focus: </span>
                    {p.focus}
                  </p>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 list-disc pl-4 text-xs text-slate-300">
                    {p.activities.map((a) => (
                      <li key={a} className="break-words">
                        {a}
                      </li>
                    ))}
                  </ul>
                  <p className="text-[11px] text-slate-400">
                    <span className="font-semibold text-slate-300">Aim: </span>
                    {p.outcome}
                  </p>
                </div>
              </details>
            );
          })}
        </div>
      </Card>

      <Card title="Qualifying a prospect">
        <p className="text-[11px] text-slate-500">A prospect counts as qualified because of real engagement, not because you have their number.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {VERSALY_QUALIFICATION.map((q) => (
            <div key={q.factor} className="p-3 rounded-xl bg-slate-950/50 border border-slate-800/80">
              <div className="text-xs font-semibold text-slate-100">{q.factor}</div>
              <div className="text-[11px] text-slate-400">{q.question}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Standard onboarding">
        <ol className="space-y-1.5 text-xs text-slate-300 list-decimal pl-4">
          {VERSALY_ONBOARDING.map((s) => (
            <li key={s} className="break-words">
              {s}
            </li>
          ))}
        </ol>
      </Card>

      <Card title="Business model">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Revenue streams</h3>
            <ul className="space-y-1.5 text-xs text-slate-300 list-disc pl-4">
              {VERSALY_MODEL.streams.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
            <p className="text-[11px] text-slate-400">
              <span className="font-semibold text-slate-300">Preferred: </span>
              {VERSALY_MODEL.preferred}
            </p>
          </div>
          <div className="space-y-2">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Proposed pricing structures</h3>
            <ul className="space-y-1.5 text-xs text-slate-300 list-disc pl-4">
              {VERSALY_MODEL.tiers.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
            <p className="text-[11px] text-slate-500">{VERSALY_MODEL.note}</p>
          </div>
        </div>
        <p className="text-[11px] text-slate-500">{VERSALY_MODEL.partners}</p>
      </Card>
    </div>
  );
}
