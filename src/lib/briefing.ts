import { prisma } from "@/lib/db";
import { getAgenda, type AgendaItem } from "@/lib/agenda";
import { zonedNow } from "@/lib/tz";
import { priorityRank } from "@/lib/priority";
import { pickNextAction, pickNextMilestone } from "@/lib/projectNext";

/**
 * The Faida Intelligence Briefing: what actually needs the student's attention right now.
 * Built from the same agenda the Calendar shows, so a number here always matches a list there.
 */

export type BriefTone = "danger" | "warn" | "info" | "good";

export interface BriefItem {
  key: string;
  title: string;
  meta: string | null;
  when: string | null; // ISO
  allDay: boolean;
  href: string | null;
  url: string | null;
  category: AgendaItem["category"];
  source: AgendaItem["source"];
  priority: string | null;
}

export interface BriefGroup {
  key: "overdue" | "today" | "tomorrow" | "week";
  label: string;
  tone: BriefTone;
  total: number;
  items: BriefItem[];
}

export interface ProjectFocus {
  id: string;
  name: string;
  color: string | null;
  action: string | null; // the next task to do on this project
  actionDue: string | null; // ISO
  overdue: boolean;
  milestone: string | null; // the next unfinished milestone
  milestoneDue: string | null; // ISO
  milestoneOverdue: boolean;
}

export interface Briefing {
  generatedAt: string;
  greeting: string;
  dateLabel: string;
  headline: string;
  suggestion: string | null;
  nextUp: BriefItem | null;
  groups: BriefGroup[];
  stats: { key: string; label: string; value: number; tone: BriefTone; href: string }[];
  other: {
    openTasks: number;
    activeProjects: number;
    shoppingPending: number;
    clientsNeedingAttention: string[];
    projectFocus: ProjectFocus[];
  };
  finance: { spent: number; limit: number; percentUsed: number; currency: string } | null;
}

const MAX_ITEMS = 4;

function toBrief(i: AgendaItem): BriefItem {
  return {
    key: i.key,
    title: i.title,
    meta: i.subtitle,
    when: i.start,
    allDay: i.allDay,
    href: i.href,
    url: i.url,
    category: i.category,
    source: i.source,
    priority: i.priority,
  };
}

const plural = (n: number, one: string, many = one + "s") => `${n} ${n === 1 ? one : many}`;

export async function buildBriefing(userId: string, now: Date = new Date()): Promise<Briefing> {
  const z = zonedNow(now);
  const dayMs = 86400000;
  const rangeEnd = new Date(z.startOfDay.getTime() + 8 * dayMs);

  const [{ items, overdue }, openTasks, activeProjects, shoppingPending, riskyClients, budgets, monthTxs, projectRows] = await Promise.all([
    getAgenda(userId, z.startOfDay, rangeEnd, now),
    prisma.task.count({ where: { userId, status: { notIn: ["DONE", "CANCELLED", "ARCHIVED", "BACKLOG"] } } }),
    prisma.project.count({ where: { userId, status: "ACTIVE" } }),
    prisma.shoppingItem.count({ where: { userId, isChecked: false } }),
    prisma.businessClient.findMany({
      where: { userId, health: { in: ["AT_RISK", "ATTENTION"] }, status: { notIn: ["COMPLETED", "PAUSED"] } },
      select: { name: true },
      take: 5,
    }),
    prisma.budget.findMany({ where: { userId }, orderBy: { createdAt: "desc" } }),
    prisma.financeTransaction.findMany({ where: { userId, date: { gte: z.startOfMonth }, amount: { lt: 0 } }, select: { amount: true } }),
    prisma.project.findMany({
      where: { userId, status: "ACTIVE" },
      select: {
        id: true,
        name: true,
        color: true,
        tasks: {
          where: { userId, status: { notIn: ["DONE", "CANCELLED", "ARCHIVED", "BACKLOG", "BLOCKED"] } },
          select: { id: true, title: true, status: true, priority: true, dueDate: true, estimatedMinutes: true, createdAt: true },
        },
        milestones: { where: { isDone: false }, select: { id: true, title: true, isDone: true, order: true, dueDate: true } },
      },
      take: 30,
    }),
  ]);

  // One "next move" per active project; the ones that need you most come first.
  const projectFocus: ProjectFocus[] = projectRows
    .map((p) => {
      const action = pickNextAction(p.tasks, now);
      const milestone = pickNextMilestone(p.milestones, now);
      return { p, action, milestone };
    })
    .filter((x) => x.action || x.milestone)
    .sort(
      (a, b) =>
        Number(!!b.action?.overdue || !!b.milestone?.overdue) - Number(!!a.action?.overdue || !!a.milestone?.overdue) ||
        priorityRank(a.action?.priority) - priorityRank(b.action?.priority) ||
        (a.action?.dueDate ?? "9").localeCompare(b.action?.dueDate ?? "9")
    )
    .slice(0, 4)
    .map(({ p, action, milestone }) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      action: action?.title ?? null,
      actionDue: action?.dueDate ?? null,
      overdue: !!action?.overdue,
      milestone: milestone?.title ?? null,
      milestoneDue: milestone?.dueDate ?? null,
      milestoneOverdue: !!milestone?.overdue,
    }));

  const startOfTomorrow = z.endOfDay.getTime();
  const endOfTomorrow = startOfTomorrow + dayMs;
  const t = (i: AgendaItem) => new Date(i.start).getTime();

  // Things still to do or attend (done work and events that already ended are not "attention").
  const stillOpen = (i: AgendaItem) => {
    if (i.done) return false;
    if (i.source === "EVENT" || i.source === "CLASS" || i.source === "ZOOM" || i.source === "CAT") {
      const end = i.end ? new Date(i.end).getTime() : t(i);
      return end >= now.getTime();
    }
    return true;
  };

  const byImportance = (a: AgendaItem, b: AgendaItem) => {
    const timed = Number(a.allDay) - Number(b.allDay);
    if (a.allDay === b.allDay) {
      const p = priorityRank(a.priority) - priorityRank(b.priority);
      if (a.allDay && p !== 0) return p;
      return t(a) - t(b);
    }
    return timed; // timed items first
  };

  // Something already overdue is listed under "Overdue" only, never twice.
  const lateKeys = new Set(overdue.filter((i) => !i.done).map((i) => i.key));
  const pastDue = (i: AgendaItem) => !i.allDay && i.source !== "EVENT" && i.source !== "CLASS" && i.source !== "ZOOM" && i.source !== "CAT" && t(i) < now.getTime();
  const today = items.filter((i) => t(i) < startOfTomorrow && stillOpen(i) && !lateKeys.has(i.key) && !pastDue(i)).sort(byImportance);
  const tomorrow = items.filter((i) => t(i) >= startOfTomorrow && t(i) < endOfTomorrow && !i.done).sort(byImportance);
  const week = items
    .filter((i) => t(i) >= endOfTomorrow && !i.done && (i.category === "ACADEMIC" || i.category === "BUSINESS" || i.category === "TASK" || i.category === "EVENT"))
    .sort((a, b) => t(a) - t(b));
  const lateToday = items.filter((i) => t(i) < startOfTomorrow && !i.done && pastDue(i) && !lateKeys.has(i.key));
  const late = [...overdue.filter((i) => !i.done), ...lateToday];

  const group = (key: BriefGroup["key"], label: string, tone: BriefTone, list: AgendaItem[]): BriefGroup => ({
    key,
    label,
    tone,
    total: list.length,
    items: list.slice(0, MAX_ITEMS).map(toBrief),
  });

  const groups = [
    group("overdue", "Overdue, needs action", "danger", late),
    group("today", "Today", "warn", today),
    group("tomorrow", "Tomorrow", "info", tomorrow),
    group("week", "Later this week", "info", week),
  ].filter((g) => g.total > 0);

  // ---- numbers ---------------------------------------------------------------------------------
  const count = (list: AgendaItem[], pred: (i: AgendaItem) => boolean) => list.filter(pred).length;
  const stats = [
    { key: "overdue", label: "Overdue", value: late.length, tone: "danger" as const, href: "/tasks" },
    { key: "today", label: "Due today", value: count(today, (i) => i.source !== "EVENT" && i.source !== "CLASS" && i.source !== "ZOOM"), tone: "warn" as const, href: "/calendar" },
    { key: "events", label: "Events & classes today", value: count(today, (i) => i.source === "EVENT" || i.source === "CLASS" || i.source === "ZOOM" || i.source === "CAT"), tone: "info" as const, href: "/calendar" },
    {
      key: "academic",
      label: "Academic open",
      value: count([...late, ...today, ...tomorrow, ...week], (i) => i.category === "ACADEMIC"),
      tone: "info" as const,
      href: "/university",
    },
    {
      key: "maintenance",
      label: "Maintenance due",
      value: count([...late, ...today], (i) => i.category === "MAINTENANCE"),
      tone: "warn" as const,
      href: "/maintenance",
    },
    {
      key: "business",
      label: "Deliverables due",
      value: count([...late, ...today, ...tomorrow], (i) => i.category === "BUSINESS"),
      tone: "warn" as const,
      href: "/business",
    },
  ].filter((s) => s.value > 0);

  // ---- finance, this month ---------------------------------------------------------------------
  const spent = Math.round(monthTxs.reduce((n, x) => n + Math.abs(x.amount), 0));
  const overall = budgets.find((b) => b.category === "Overall");
  const personal = budgets.find((b) => b.category === "Personal");
  const business = budgets.find((b) => b.category === "Business");
  const limit = overall ? overall.monthlyLimit : (personal?.monthlyLimit ?? 0) + (business?.monthlyLimit ?? 0);
  const finance = limit > 0 ? { spent, limit, percentUsed: Math.round((spent / limit) * 100), currency: "KES" } : null;

  // ---- one line a person can act on --------------------------------------------------------------
  const nextTimed = today.find((i) => !i.allDay && (i.source === "EVENT" || i.source === "CLASS" || i.source === "ZOOM" || i.source === "CAT"));
  const nextUp = nextTimed ? toBrief(nextTimed) : null;

  const hour = z.hour;
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const dateLabel = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Nairobi", weekday: "long", day: "numeric", month: "long" }).format(now);

  const parts: string[] = [];
  if (late.length) parts.push(`${plural(late.length, "item")} overdue`);
  const dueToday = count(today, (i) => i.source !== "EVENT" && i.source !== "CLASS" && i.source !== "ZOOM");
  if (dueToday) parts.push(`${dueToday} due today`);
  const evToday = count(today, (i) => i.source === "EVENT" || i.source === "CLASS" || i.source === "ZOOM" || i.source === "CAT");
  if (evToday) parts.push(`${plural(evToday, "event")} or ${evToday === 1 ? "class" : "classes"} still ahead today`);
  const headline = parts.length
    ? `${greeting}. ${parts.join(", ")}.`
    : tomorrow.length
    ? `${greeting}. Nothing is overdue or due today. ${plural(tomorrow.length, "thing")} on tomorrow's list.`
    : `${greeting}. Nothing is overdue or due today. You are clear.`;

  let suggestion: string | null = null;
  const topLate = late.find((i) => i.category === "ACADEMIC" || i.category === "BUSINESS") || late[0];
  const soonEvent = nextTimed && t(nextTimed) - now.getTime() < 2 * 3600000 ? nextTimed : null;
  const topToday = today.find((i) => i.source === "TASK" || i.source === "DELIVERABLE" || i.source === "REMINDER");
  if (soonEvent) suggestion = `Next up: ${soonEvent.title}. Get ready for it first.`;
  else if (topLate) suggestion = `Start by clearing "${topLate.title}", it is already overdue.`;
  else if (topToday) suggestion = `Best next move: "${topToday.title}".`;
  else if (nextTimed) suggestion = `Next up: ${nextTimed.title}.`;

  return {
    generatedAt: now.toISOString(),
    greeting,
    dateLabel,
    headline,
    suggestion,
    nextUp,
    groups,
    stats,
    other: {
      openTasks,
      activeProjects,
      shoppingPending,
      clientsNeedingAttention: riskyClients.map((c) => c.name),
      projectFocus,
    },
    finance,
  };
}

/** Plain-text/markdown version for Faida AI replies. */
export function briefingToMarkdown(b: Briefing): string {
  const lines: string[] = [`**${b.headline}**`];
  const when = (i: BriefItem) => {
    if (!i.when) return "";
    const d = new Date(i.when);
    const day = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Nairobi", weekday: "short", day: "numeric", month: "short" }).format(d);
    const time = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Nairobi", hour: "numeric", minute: "2-digit", hour12: true }).format(d);
    return i.allDay ? ` (${day})` : ` (${day}, ${time})`;
  };
  for (const g of b.groups) {
    lines.push(`\n**${g.label} (${g.total})**`);
    g.items.forEach((i) => lines.push(`• ${i.title}${i.meta ? ` · ${i.meta}` : ""}${when(i)}`));
    if (g.total > g.items.length) lines.push(`• …and ${g.total - g.items.length} more`);
  }
  if (b.other.projectFocus.length) {
    lines.push("\n**Projects: next move**");
    b.other.projectFocus.forEach((p) =>
      lines.push(`• ${p.name}: ${p.action ?? "no open tasks"}${p.overdue ? " (overdue)" : ""}${p.milestone ? ` · next milestone: ${p.milestone}${p.milestoneOverdue ? " (overdue)" : ""}` : ""}`)
    );
  }
  if (b.other.clientsNeedingAttention.length) lines.push(`\n**Clients needing attention:** ${b.other.clientsNeedingAttention.join(", ")}`);
  if (b.finance) lines.push(`\n**Money:** KES ${b.finance.spent.toLocaleString()} of KES ${b.finance.limit.toLocaleString()} used this month (${b.finance.percentUsed}%).`);
  if (b.suggestion) lines.push(`\n**Suggestion:** ${b.suggestion}`);
  return lines.join("\n");
}
