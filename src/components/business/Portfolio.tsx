"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, FolderGit2, Loader2, Search } from "lucide-react";
import { VERSALY_PORTFOLIO, VERSALY_READINESS_MILESTONES, VERSALY_PRIORITY_PRODUCTS, type PortfolioProduct } from "@/lib/versalyPlaybook";
import { createTrackedProject, fetchProjects, projectMatches, type ProjectSummary } from "@/components/business/trackProject";
import { Badge, Card, EmptyState, ProgressBar, inputCls } from "@/components/business/ui";

type Tier = "priority" | "secondary" | "all";

/**
 * The 28-product portfolio from the business plan. Each product is matched to a Project of the same name, so you
 * see the plan's estimate next to the live progress from Projects, and can start tracking a product in one tap.
 */
export function PortfolioSection({ onProjectsChanged }: { onProjectsChanged?: () => void }) {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [tier, setTier] = useState<Tier>("priority");
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = () =>
    fetchProjects()
      .then(setProjects)
      .catch(() => {})
      .finally(() => setLoading(false));
  useEffect(() => {
    load();
  }, []);

  const matchFor = (p: PortfolioProduct) => projects.find((pr) => projectMatches(pr.name, p.aliases));

  const shown = useMemo(
    () =>
      VERSALY_PORTFOLIO.filter((p) => (tier === "all" ? true : p.tier === tier)).filter((p) => {
        const q = query.trim().toLowerCase();
        return !q || p.name.toLowerCase().includes(q) || p.segment.toLowerCase().includes(q);
      }),
    [tier, query]
  );

  const track = async (p: PortfolioProduct) => {
    setError("");
    setCreating(p.name);
    try {
      await createTrackedProject({
        name: p.name,
        description: `${p.what}. Built for ${p.segment}. Plan estimate: ${p.completion}% complete.`,
        color: p.tier === "priority" ? "#3b82f6" : "#8b5cf6",
        milestones: VERSALY_READINESS_MILESTONES.map((title) => ({ title })),
      });
      await load();
      onProjectsChanged?.();
    } catch (e: any) {
      setError(e?.message || "Could not create the project");
    } finally {
      setCreating(null);
    }
  };

  const counts = {
    priority: VERSALY_PORTFOLIO.filter((p) => p.tier === "priority").length,
    secondary: VERSALY_PORTFOLIO.filter((p) => p.tier === "secondary").length,
    all: VERSALY_PORTFOLIO.length,
  };
  const trackedCount = VERSALY_PORTFOLIO.filter((p) => matchFor(p)).length;

  return (
    <div className="space-y-4">
      <Card title="Product portfolio">
        <p className="text-[11px] text-slate-400 leading-relaxed">
          28 systems at different stages. The plan only commercialises three first (Melio RMS, Mylkio, Dukaset). Percentages marked <em>plan</em> are the plan&apos;s internal
          estimates, not tested readiness. <strong className="text-slate-300">Live</strong> comes from the matching Project in your Projects page
          {loading ? "." : `; ${trackedCount} of ${VERSALY_PORTFOLIO.length} products have one.`}
        </p>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-500" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search products or customers..." className={`${inputCls} pl-9`} />
          </div>
          <div className="flex items-center gap-1.5 text-xs overflow-x-auto">
            {(["priority", "secondary", "all"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTier(t)}
                className={`px-3 py-1.5 rounded-xl font-medium whitespace-nowrap cursor-pointer transition-all ${
                  tier === t ? "bg-blue-600 text-white font-semibold" : "bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-slate-800"
                }`}
              >
                {t === "priority" ? "Launch priorities" : t === "secondary" ? "Next candidates" : "All 28"} ({counts[t]})
              </button>
            ))}
          </div>
        </div>
        {error && <p className="text-xs text-rose-400">{error}</p>}
      </Card>

      {tier === "priority" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {VERSALY_PRIORITY_PRODUCTS.map((p) => (
            <Card key={p.name} title={p.name}>
              <p className="text-[11px] text-slate-500">{p.segment}</p>
              <ul className="space-y-1.5 text-xs text-slate-300 list-disc pl-4">
                {p.priorities.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}

      {shown.length === 0 ? (
        <EmptyState>No products match.</EmptyState>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,19rem),1fr))] gap-4">
          {shown.map((p) => {
            const pr = matchFor(p);
            return (
              <div key={p.name} className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-all space-y-3 flex flex-col justify-between min-w-0">
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-bold text-slate-100 break-words min-w-0">{p.name}</h3>
                    <Badge tone={p.tier === "priority" ? "blue" : p.tier === "secondary" ? "purple" : "slate"}>
                      {p.tier === "priority" ? "launch priority" : p.tier === "secondary" ? "next candidate" : "portfolio"}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-slate-400 break-words">{p.what}</p>
                  <p className="text-[11px] text-slate-500 break-words">For: {p.segment}</p>
                </div>

                <div className="space-y-2">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
                      <span>plan estimate</span>
                      <span>{p.completion}%</span>
                    </div>
                    <ProgressBar percent={p.completion} color="#64748b" />
                  </div>

                  {loading ? (
                    <div className="text-[11px] text-slate-500">Checking Projects...</div>
                  ) : pr ? (
                    <div className="space-y-1.5 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                      <div className="flex items-center justify-between text-[10px] font-mono">
                        <span className="text-blue-300">live in Projects</span>
                        <span className="text-slate-300">{pr.progressPercent}%</span>
                      </div>
                      <ProgressBar percent={pr.progressPercent} color="#3b82f6" />
                      {pr.nextAction && (
                        <p className="text-[11px] text-slate-300 break-words">
                          Next: {pr.nextAction.title}
                          {pr.nextAction.overdue && <span className="text-rose-400"> (overdue)</span>}
                        </p>
                      )}
                      {pr.staleDays != null && <p className="text-[11px] text-amber-300">No progress in {pr.staleDays} days</p>}
                      <Link href={`/projects/${pr.id}`} className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-400 hover:text-blue-300">
                        <FolderGit2 className="h-3 w-3" /> Open project <ExternalLink className="h-2.5 w-2.5" />
                      </Link>
                    </div>
                  ) : (
                    <button
                      onClick={() => track(p)}
                      disabled={creating !== null}
                      className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-blue-600 text-slate-200 hover:text-white text-[11px] font-semibold cursor-pointer transition-colors disabled:opacity-50"
                    >
                      {creating === p.name ? <Loader2 className="h-3 w-3 animate-spin" /> : <FolderGit2 className="h-3 w-3" />}
                      Track as a project
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
