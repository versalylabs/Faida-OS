import { prisma } from "@/lib/db";
import { getAgenda, type AgendaCategory } from "@/lib/agenda";
import { buildBriefing } from "@/lib/briefing";
import { getLmsOverview } from "@/lib/lms/overview";
import { whenLabel } from "@/lib/dates";
import { zonedDateKey, zonedNow, zonedTime } from "@/lib/tz";
import type { ToolSpec } from "@/lib/ai/llm";
import {
  executeAddShopping,
  executeCompleteTask,
  executeCreateTask,
  executeDecomposeAssignment,
  executeDecomposeGoal,
  executeLogFinance,
  type ToolActionPayload,
} from "@/lib/ai/tools";

/**
 * Everything Faida AI can look at or do. Read tools return small JSON so a free model with a small
 * token budget can use them; write tools change the student's own data and report what they did.
 * Every tool is scoped to the signed-in student: the model never supplies a user id.
 */

export interface ToolOutput {
  data: unknown;
  action?: ToolActionPayload;
}

export interface AgentTool {
  spec: ToolSpec;
  write: boolean;
  groups: Group[];
  run: (userId: string, args: Record<string, any>) => Promise<ToolOutput>;
}

type Group = "core" | "business" | "university" | "finance" | "life" | "projects";

const fn = (name: string, description: string, properties: Record<string, unknown> = {}, required: string[] = []): ToolSpec => ({
  type: "function",
  function: { name, description, parameters: { type: "object", properties, required } },
});
const s = (description: string) => ({ type: "string", description });
const n = (description: string) => ({ type: "number", description });

/** "2026-11-21", "2026-11-21 14:30", "2026-11-21T14:30" (Nairobi time) or a full ISO time. */
export function parseWhen(input: unknown, defaultTime = "09:00"): Date | null {
  if (typeof input !== "string" || !input.trim()) return null;
  const v = input.trim();
  let d: Date | null = null;
  const dateOnly = v.match(/^(\d{4}-\d{2}-\d{2})$/);
  const local = v.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{1,2}:\d{2})(?::\d{2})?$/);
  if (dateOnly) d = zonedTime(dateOnly[1], defaultTime);
  else if (local) d = zonedTime(local[1], local[2].padStart(5, "0"));
  else d = new Date(v);
  // Reject anything that is not a real date in a sensible range.
  return d && !Number.isNaN(d.getTime()) && d.getUTCFullYear() >= 2000 && d.getUTCFullYear() <= 2100 ? d : null;
}

const clip = (text: string | null | undefined, max = 160) => (text ? (text.length > max ? text.slice(0, max - 1) + "…" : text) : null);
const day = (d: Date | null, allDay = false) => (d ? whenLabel(d.toISOString(), allDay) : null);
const dateOnlyDue = (d: Date) => d.getUTCHours() === 0 && d.getUTCMinutes() === 0;
const limitOf = (v: unknown, def: number, max: number) => Math.min(max, Math.max(1, Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : def));
const ci = (text: string) => ({ contains: text.slice(0, 120), mode: "insensitive" as const });

const OPEN = { notIn: ["DONE", "CANCELLED", "ARCHIVED"] };

// ---------------------------------------------------------------------------------------------------
// Read tools
// ---------------------------------------------------------------------------------------------------

const getBriefing: AgentTool = {
  spec: fn("get_briefing", "What needs attention now: overdue, today, tomorrow, later this week, with a suggested next step."),
  write: false,
  groups: ["core"],
  async run(userId) {
    const b = await buildBriefing(userId);
    return {
      data: {
        headline: b.headline,
        suggestion: b.suggestion,
        groups: b.groups.map((g) => ({
          label: g.label,
          total: g.total,
          items: g.items.map((i) => ({ title: i.title, detail: i.meta, when: i.when ? day(new Date(i.when), i.allDay) : null })),
        })),
        clients_needing_attention: b.other.clientsNeedingAttention,
        budget: b.finance,
        open_tasks: b.other.openTasks,
      },
    };
  },
};

const getAgendaTool: AgentTool = {
  spec: fn(
    "get_agenda",
    "Everything scheduled in a date range: events, reminders, task deadlines, CATs, assignments, classes, maintenance, business deliverables.",
    {
      from: s("Start date YYYY-MM-DD (default today)"),
      to: s("End date YYYY-MM-DD (default 7 days after start)"),
      type: { type: "string", enum: ["events", "tasks", "academic", "classes", "reminders", "maintenance", "business"], description: "Optional filter" },
    }
  ),
  write: false,
  groups: ["core"],
  async run(userId, a) {
    const today = zonedDateKey(new Date());
    const from = /^\d{4}-\d{2}-\d{2}$/.test(a.from || "") ? a.from : today;
    const toRaw = /^\d{4}-\d{2}-\d{2}$/.test(a.to || "") ? a.to : new Date(Date.parse(`${from}T12:00:00Z`) + 7 * 86400000).toISOString().slice(0, 10);
    const to = toRaw < from ? from : toRaw;
    if (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`) > 62 * 86400000) return { data: { error: "Ask for 60 days or fewer at a time." } };

    const { items, overdue } = await getAgenda(userId, zonedTime(from, "00:00"), new Date(zonedTime(to, "00:00").getTime() + 86400000));
    const want: Record<string, AgendaCategory> = { events: "EVENT", tasks: "TASK", academic: "ACADEMIC", classes: "CLASS", reminders: "REMINDER", maintenance: "MAINTENANCE", business: "BUSINESS" };
    const cat = want[String(a.type || "")];
    const keep = (i: { category: string }) => !cat || i.category === cat;
    const rows = items.filter(keep).slice(0, 30).map((i) => ({
      when: whenLabel(i.start, i.allDay),
      title: i.title,
      kind: i.category.toLowerCase(),
      detail: i.subtitle,
      done: i.done || undefined,
    }));
    const late = from <= today && today <= to ? overdue.filter((i) => !i.done).filter(keep).slice(0, 10).map((i) => ({ title: i.title, kind: i.category.toLowerCase(), was_due: whenLabel(i.start, i.allDay) })) : [];
    return { data: { from, to, count: rows.length, items: rows, overdue: late } };
  },
};

const listTasks: AgentTool = {
  spec: fn("list_tasks", "List the student's tasks.", {
    status: { type: "string", enum: ["open", "done"], description: "Default open" },
    query: s("Text in the title"),
    due_within_days: n("Only tasks due within this many days"),
    limit: n("Max 15"),
  }),
  write: false,
  groups: ["core"],
  async run(userId, a) {
    const where: any = { userId, status: a.status === "done" ? "DONE" : OPEN };
    if (a.query) where.title = ci(String(a.query));
    if (Number.isFinite(Number(a.due_within_days))) where.dueDate = { lt: new Date(Date.now() + Number(a.due_within_days) * 86400000) };
    const rows = await prisma.task.findMany({
      where,
      include: { project: { select: { name: true } }, course: { select: { code: true } } },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      take: limitOf(a.limit, 10, 15),
    });
    return {
      data: {
        count: rows.length,
        tasks: rows.map((t) => ({
          title: t.title,
          priority: t.priority,
          due: t.dueDate ? day(t.dueDate, dateOnlyDue(t.dueDate)) : null,
          project: t.project?.name ?? t.course?.code ?? null,
          minutes: t.estimatedMinutes,
        })),
      },
    };
  },
};

const getUniversity: AgentTool = {
  spec: fn("get_university", "University status: each unit's progress and marks, missed and due work, upcoming CATs and exams, classes."),
  write: false,
  groups: ["university"],
  async run(userId) {
    const lms = await getLmsOverview(userId);
    const soon = await prisma.academicAssessment.findMany({
      where: { userId, isCompleted: false, date: { gte: new Date(Date.now() - 86400000), lt: new Date(Date.now() + 21 * 86400000) } },
      include: { course: { select: { code: true } } },
      orderBy: { date: "asc" },
      take: 6,
    });
    const assessments = soon.map((x) => ({ title: x.title, unit: x.course.code, type: x.type, when: day(x.date) }));
    if (!lms.connected) {
      const [courses, tasks] = await Promise.all([
        prisma.universityCourse.findMany({ where: { userId, status: "ACTIVE" }, select: { code: true, name: true }, take: 12 }),
        prisma.task.findMany({ where: { userId, isAcademic: true, status: OPEN }, orderBy: { dueDate: "asc" }, take: 8, include: { course: { select: { code: true } } } }),
      ]);
      return {
        data: {
          lms_connected: false,
          units: courses,
          open_academic_tasks: tasks.map((t) => ({ title: t.title, unit: t.course?.code, due: t.dueDate ? day(t.dueDate, dateOnlyDue(t.dueDate)) : null })),
          upcoming_assessments: assessments,
        },
      };
    }
    return {
      data: {
        lms_connected: true,
        last_synced: lms.connection.lastSyncAt,
        units: lms.units.map((u) => ({
          unit: u.code,
          name: u.name,
          completed: `${u.done} of ${u.total}`,
          percent: u.percent,
          marks: u.marksPercent === null ? null : `${u.marksEarned}/${u.marksMax} (${u.marksPercent}%)`,
          missed: u.missed,
          next: u.next ? `${u.next.title}, ${day(new Date(u.next.dueAt))}` : null,
        })),
        missed: lms.attention.missed.slice(0, 8).map((m) => ({ title: m.title, unit: m.courseCode, was_due: day(new Date(m.dueAt)) })),
        due_soon: lms.attention.dueSoon.slice(0, 8).map((m) => ({ title: m.title, unit: m.courseCode, due: day(new Date(m.dueAt)) })),
        upcoming_assessments: assessments,
      },
    };
  },
};

const getBusiness: AgentTool = {
  spec: fn("get_business", "Business Hub overview: businesses and MRR, clients and their health, deliverables overdue or due soon, latest weekly metrics."),
  write: false,
  groups: ["business"],
  async run(userId) {
    const [businesses, clients, deliverables] = await Promise.all([
      prisma.business.findMany({
        where: { userId, isActive: true },
        include: { weeklyMetrics: { orderBy: { createdAt: "desc" }, take: 1 } },
        take: 8,
      }),
      prisma.businessClient.findMany({ where: { userId }, select: { name: true, status: true, health: true, business: { select: { name: true } }, contractValue: true, billingCycle: true }, take: 60 }),
      prisma.businessDeliverable.findMany({
        where: { userId, status: { not: "COMPLETED" } },
        include: { business: { select: { name: true } }, client: { select: { name: true } } },
        orderBy: { dueDate: "asc" },
        take: 40,
      }),
    ]);
    const now = Date.now();
    const byStatus: Record<string, number> = {};
    clients.forEach((c) => (byStatus[c.status] = (byStatus[c.status] || 0) + 1));
    const late = deliverables.filter((d) => d.dueDate && d.dueDate.getTime() < now);
    const soon = deliverables.filter((d) => d.dueDate && d.dueDate.getTime() >= now && d.dueDate.getTime() < now + 7 * 86400000);
    const row = (d: (typeof deliverables)[number]) => ({
      title: d.title,
      business: d.business?.name,
      client: d.client?.name ?? null,
      status: d.status,
      priority: d.priority,
      due: d.dueDate ? day(d.dueDate, dateOnlyDue(d.dueDate)) : null,
    });
    return {
      data: {
        businesses: businesses.map((b) => ({
          name: b.name,
          type: b.type,
          mrr: b.mrr,
          target_mrr: b.targetMrr,
          currency: b.currency,
          latest_week: b.weeklyMetrics[0]
            ? { week: b.weeklyMetrics[0].weekStartDate, outreach: b.weeklyMetrics[0].outreachSent, audits_booked: b.weeklyMetrics[0].auditsBooked, show_rate: b.weeklyMetrics[0].showRate, close_rate: b.weeklyMetrics[0].closeRate, mrr: b.weeklyMetrics[0].mrr }
            : null,
        })),
        clients: { total: clients.length, by_status: byStatus },
        clients_needing_attention: clients.filter((c) => c.health !== "HEALTHY" && !["COMPLETED", "PAUSED"].includes(c.status)).slice(0, 8).map((c) => ({ name: c.name, health: c.health, business: c.business?.name })),
        open_deliverables: deliverables.length,
        overdue_deliverables: late.slice(0, 8).map(row),
        due_next_7_days: soon.slice(0, 8).map(row),
      },
    };
  },
};

const listDeliverables: AgentTool = {
  spec: fn("list_deliverables", "List business deliverables.", {
    status: { type: "string", enum: ["PENDING", "IN_PROGRESS", "REVIEW", "COMPLETED"] },
    business: s("Business name"),
    overdue_only: { type: "boolean" },
    limit: n("Max 15"),
  }),
  write: false,
  groups: ["business"],
  async run(userId, a) {
    const where: any = { userId };
    if (a.status) where.status = a.status;
    else where.status = { not: "COMPLETED" };
    if (a.business) where.business = { name: ci(String(a.business)) };
    if (a.overdue_only) where.dueDate = { lt: zonedNow().startOfDay };
    const rows = await prisma.businessDeliverable.findMany({
      where,
      include: { business: { select: { name: true } }, client: { select: { name: true } } },
      orderBy: { dueDate: "asc" },
      take: limitOf(a.limit, 10, 15),
    });
    return {
      data: {
        count: rows.length,
        deliverables: rows.map((d) => ({ title: d.title, business: d.business?.name, client: d.client?.name ?? null, status: d.status, priority: d.priority, due: d.dueDate ? day(d.dueDate, dateOnlyDue(d.dueDate)) : null })),
      },
    };
  },
};

const getFinance: AgentTool = {
  spec: fn("get_finance", "This month's income, spending, budget used, top categories, account balances and recent transactions (KES)."),
  write: false,
  groups: ["finance"],
  async run(userId) {
    const start = zonedNow().startOfMonth;
    const [txs, budgets, accounts, recent] = await Promise.all([
      prisma.financeTransaction.findMany({ where: { userId, date: { gte: start } }, select: { amount: true, category: true } }),
      prisma.budget.findMany({ where: { userId }, orderBy: { createdAt: "desc" } }),
      prisma.financeAccount.findMany({ where: { userId }, select: { name: true, balance: true, currency: true } }),
      prisma.financeTransaction.findMany({ where: { userId }, orderBy: { date: "desc" }, take: 5, select: { description: true, amount: true, category: true, date: true } }),
    ]);
    let income = 0;
    let spent = 0;
    const cats: Record<string, number> = {};
    for (const t of txs) {
      if (t.amount > 0) income += t.amount;
      else {
        spent += -t.amount;
        cats[t.category] = (cats[t.category] || 0) + -t.amount;
      }
    }
    const overall = budgets.find((b) => b.category === "Overall");
    const limit = overall ? overall.monthlyLimit : (budgets.find((b) => b.category === "Personal")?.monthlyLimit ?? 0) + (budgets.find((b) => b.category === "Business")?.monthlyLimit ?? 0);
    return {
      data: {
        currency: "KES",
        month_income: Math.round(income),
        month_spent: Math.round(spent),
        month_net: Math.round(income - spent),
        budget: limit > 0 ? { limit, used_percent: Math.round((spent / limit) * 100), remaining: Math.round(limit - spent) } : null,
        top_categories: Object.entries(cats).sort((x, y) => y[1] - x[1]).slice(0, 5).map(([category, amount]) => ({ category, amount: Math.round(amount) })),
        accounts: accounts.map((x) => ({ name: x.name, balance: x.balance })),
        recent: recent.map((r) => ({ description: r.description, amount: r.amount, category: r.category, date: day(r.date, true) })),
      },
    };
  },
};

const listProjects: AgentTool = {
  spec: fn("list_projects", "The student's projects with progress and open task counts."),
  write: false,
  groups: ["projects"],
  async run(userId) {
    const rows = await prisma.project.findMany({
      where: { userId },
      include: { _count: { select: { tasks: { where: { status: OPEN } } } } },
      orderBy: { updatedAt: "desc" },
      take: 15,
    });
    return { data: { projects: rows.map((p) => ({ name: p.name, status: p.status, progress_percent: p.progressPercent, open_tasks: p._count.tasks, target: p.targetDate ? day(p.targetDate, true) : null })) } };
  },
};

const getMaintenance: AgentTool = {
  spec: fn("get_maintenance", "Maintenance jobs that are overdue or due in the next two weeks."),
  write: false,
  groups: ["life"],
  async run(userId) {
    const rows = await prisma.maintenanceItem.findMany({ where: { userId, nextDueAt: { lt: new Date(Date.now() + 14 * 86400000) } }, orderBy: { nextDueAt: "asc" }, take: 12 });
    return { data: { count: rows.length, items: rows.map((m) => ({ title: m.title, area: m.area, due: day(m.nextDueAt, true), overdue: m.nextDueAt.getTime() < Date.now(), every_days: m.frequencyDays })) } };
  },
};

const getShopping: AgentTool = {
  spec: fn("get_shopping", "Items still to buy on the shopping list."),
  write: false,
  groups: ["life"],
  async run(userId) {
    const rows = await prisma.shoppingItem.findMany({ where: { userId, isChecked: false }, orderBy: { createdAt: "desc" }, take: 30 });
    return { data: { count: rows.length, items: rows.map((r) => ({ name: r.name, store: r.preferredStore, category: r.category })) } };
  },
};

const searchNotes: AgentTool = {
  spec: fn("search_notes", "Search the student's notes by words in the title or body.", { query: s("Words to look for") }, ["query"]),
  write: false,
  groups: ["projects"],
  async run(userId, a) {
    const q = String(a.query || "").trim();
    if (!q) return { data: { error: "Give some words to search for." } };
    const rows = await prisma.note.findMany({
      where: { userId, OR: [{ title: ci(q) }, { content: ci(q) }] },
      orderBy: { updatedAt: "desc" },
      take: 5,
    });
    // Notes are the student's own text, but they may have pasted anything: it is data, never instructions.
    return { data: { count: rows.length, notes: rows.map((r) => ({ title: r.title, category: r.category, snippet: clip(r.content.replace(/\s+/g, " "), 220) })) } };
  },
};

// ---------------------------------------------------------------------------------------------------
// Write tools
// ---------------------------------------------------------------------------------------------------

const createTask: AgentTool = {
  spec: fn(
    "create_task",
    "Create a task.",
    {
      title: s("Task title"),
      priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "URGENT"] },
      due: s("Due date YYYY-MM-DD or YYYY-MM-DD HH:mm (Nairobi)"),
      minutes: n("Estimated minutes"),
      project: s("Project name"),
    },
    ["title"]
  ),
  write: true,
  groups: ["core"],
  async run(userId, a) {
    const title = String(a.title || "").trim().slice(0, 300);
    if (!title) return { data: { error: "A title is required." } };
    const due = a.due ? parseWhen(a.due, "23:59") : null;
    if (a.due && !due) return { data: { error: "I could not read that due date. Use YYYY-MM-DD." } };
    const r = await executeCreateTask({
      userId,
      title,
      projectName: a.project ? String(a.project).slice(0, 100) : undefined,
      priority: ["LOW", "MEDIUM", "HIGH", "URGENT"].includes(a.priority) ? a.priority : "MEDIUM",
      durationMinutes: Math.min(960, Math.max(5, Number(a.minutes) || 30)),
      dueDate: due ?? undefined,
    });
    return { data: { created: title, due: due ? day(due) : null }, action: r.action };
  },
};

const completeTask: AgentTool = {
  spec: fn("complete_task", "Mark an open task as done by (part of) its title.", { title: s("Task title or part of it") }, ["title"]),
  write: true,
  groups: ["core"],
  async run(userId, a) {
    const r = await executeCompleteTask(userId, String(a.title || "").slice(0, 200));
    return { data: { result: r.message.replace(/\*\*/g, "") }, action: r.action.type === "TASK_COMPLETED" ? r.action : undefined };
  },
};

const logTransaction: AgentTool = {
  spec: fn(
    "log_transaction",
    "Record an expense or income in KES.",
    { description: s("What it was for"), amount: n("Positive KES amount"), type: { type: "string", enum: ["expense", "income"] }, category: s("Category, e.g. Dining, Groceries, Utilities, Freelance") },
    ["description", "amount", "type"]
  ),
  write: true,
  groups: ["finance"],
  async run(userId, a) {
    const amount = Number(a.amount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 100_000_000) return { data: { error: "The amount must be a positive number." } };
    const r = await executeLogFinance({
      userId,
      description: String(a.description || "Transaction").slice(0, 200),
      amount,
      type: a.type === "income" ? "INCOME" : "EXPENSE",
      category: a.category ? String(a.category).slice(0, 60) : undefined,
    });
    return { data: { result: r.message.replace(/\*\*/g, "") }, action: r.action };
  },
};

const addShopping: AgentTool = {
  spec: fn("add_shopping", "Add items to the shopping list.", { items: { type: "array", items: { type: "string" }, description: "Item names" }, store: s("Preferred store") }, ["items"]),
  write: true,
  groups: ["life", "finance"],
  async run(userId, a) {
    const items = (Array.isArray(a.items) ? a.items : []).map((x: unknown) => String(x).trim().slice(0, 100)).filter(Boolean).slice(0, 20);
    if (!items.length) return { data: { error: "Which items?" } };
    const r = await executeAddShopping({ userId, items, preferredStore: a.store ? String(a.store).slice(0, 60) : undefined });
    return { data: { added: items }, action: r.action };
  },
};

const createEvent: AgentTool = {
  spec: fn(
    "create_event",
    "Add a calendar event or meeting.",
    { title: s("Event title"), start: s("YYYY-MM-DD HH:mm (Nairobi)"), end: s("YYYY-MM-DD HH:mm, default one hour later"), location: s("Where") },
    ["title", "start"]
  ),
  write: true,
  groups: ["core"],
  async run(userId, a) {
    const title = String(a.title || "").trim().slice(0, 300);
    const start = parseWhen(a.start);
    if (!title || !start) return { data: { error: "I need a title and a start time like 2026-11-21 14:30." } };
    const end = parseWhen(a.end) ?? new Date(start.getTime() + 3600000);
    if (end <= start) return { data: { error: "The end must be after the start." } };
    await prisma.calendarEvent.create({
      data: { userId, title, startTime: start, endTime: end, location: a.location ? String(a.location).slice(0, 300) : null },
    });
    return { data: { created: title, when: day(start) }, action: { type: "SCHEDULE_REPLANNED", title, badge: "Event added", details: day(start) ?? undefined, link: "/calendar" } };
  },
};

const createReminder: AgentTool = {
  spec: fn("create_reminder", "Create a reminder that notifies the student at a time.", { title: s("What to be reminded of"), when: s("YYYY-MM-DD HH:mm (Nairobi)") }, ["title", "when"]),
  write: true,
  groups: ["core"],
  async run(userId, a) {
    const title = String(a.title || "").trim().slice(0, 300);
    const when = parseWhen(a.when);
    if (!title || !when) return { data: { error: "I need what to remind you of and a time like 2026-11-21 14:30." } };
    const entity = await prisma.entity.create({ data: { userId, type: "REMINDER", title, status: "ACTIVE" } });
    await prisma.reminder.create({ data: { userId, entityId: entity.id, title, dueAt: when } });
    return { data: { created: title, when: day(when) }, action: { type: "SCHEDULE_REPLANNED", title, badge: "Reminder set", details: day(when) ?? undefined, link: "/calendar" } };
  },
};

const createDeliverable: AgentTool = {
  spec: fn(
    "create_deliverable",
    "Add a business deliverable.",
    { title: s("Deliverable"), business: s("Business name (ask if there are several)"), client: s("Client name"), due: s("YYYY-MM-DD"), priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "URGENT"] } },
    ["title"]
  ),
  write: true,
  groups: ["business"],
  async run(userId, a) {
    const title = String(a.title || "").trim().slice(0, 300);
    if (!title) return { data: { error: "A title is required." } };
    const businesses = await prisma.business.findMany({ where: { userId, isActive: true }, select: { id: true, name: true } });
    let business = a.business ? businesses.find((b) => b.name.toLowerCase().includes(String(a.business).toLowerCase())) : businesses.length === 1 ? businesses[0] : undefined;
    if (!business) return { data: { error: "Which business is this for?", options: businesses.map((b) => b.name) } };
    const client = a.client ? await prisma.businessClient.findFirst({ where: { userId, businessId: business.id, name: ci(String(a.client)) }, select: { id: true } }) : null;
    const due = a.due ? parseWhen(a.due, "23:59") : null;
    if (a.due && !due) return { data: { error: "I could not read that due date. Use YYYY-MM-DD." } };
    await prisma.businessDeliverable.create({
      data: { userId, businessId: business.id, clientId: client?.id ?? null, title, dueDate: due, priority: ["LOW", "MEDIUM", "HIGH", "URGENT"].includes(a.priority) ? a.priority : "MEDIUM" },
    });
    return { data: { created: title, business: business.name, due: due ? day(due) : null }, action: { type: "TASK_CREATED", title, badge: "Deliverable added", details: business.name, link: "/business" } };
  },
};

const updateDeliverable: AgentTool = {
  spec: fn(
    "update_deliverable",
    "Change a business deliverable's status.",
    { title: s("Deliverable title or part of it"), status: { type: "string", enum: ["PENDING", "IN_PROGRESS", "REVIEW", "COMPLETED"] } },
    ["title", "status"]
  ),
  write: true,
  groups: ["business"],
  async run(userId, a) {
    if (!["PENDING", "IN_PROGRESS", "REVIEW", "COMPLETED"].includes(a.status)) return { data: { error: "Status must be PENDING, IN_PROGRESS, REVIEW or COMPLETED." } };
    const matches = await prisma.businessDeliverable.findMany({ where: { userId, title: ci(String(a.title || "")) }, take: 3, select: { id: true, title: true } });
    if (matches.length === 0) return { data: { error: `No deliverable matches "${String(a.title).slice(0, 60)}".` } };
    if (matches.length > 1) return { data: { error: "More than one deliverable matches. Which one?", options: matches.map((m) => m.title) } };
    await prisma.businessDeliverable.update({ where: { id: matches[0].id }, data: { status: a.status, completedAt: a.status === "COMPLETED" ? new Date() : null } });
    return { data: { updated: matches[0].title, status: a.status }, action: { type: "TASK_COMPLETED", title: matches[0].title, badge: a.status.replace("_", " "), link: "/business" } };
  },
};

const decomposeGoal: AgentTool = {
  spec: fn("break_down_goal", "Turn a big goal into a project with concrete tasks.", { goal: s("The goal"), project: s("Project name") }, ["goal"]),
  write: true,
  groups: ["projects", "core"],
  async run(userId, a) {
    const r = await executeDecomposeGoal(userId, String(a.goal || "").slice(0, 300), a.project ? String(a.project).slice(0, 100) : undefined);
    return { data: { result: r.message.replace(/\*\*/g, "").slice(0, 600) }, action: r.action };
  },
};

const decomposeAssignment: AgentTool = {
  spec: fn("break_down_assignment", "Split a university assignment into study steps.", { title: s("Assignment title") }, ["title"]),
  write: true,
  groups: ["university"],
  async run(userId, a) {
    const r = await executeDecomposeAssignment(userId, String(a.title || "").slice(0, 300));
    return { data: { result: r.message.replace(/\*\*/g, "").slice(0, 600) }, action: r.action };
  },
};

export const ALL_TOOLS: AgentTool[] = [
  getBriefing,
  getAgendaTool,
  listTasks,
  createTask,
  completeTask,
  createEvent,
  createReminder,
  getUniversity,
  decomposeAssignment,
  getBusiness,
  listDeliverables,
  createDeliverable,
  updateDeliverable,
  getFinance,
  logTransaction,
  listProjects,
  decomposeGoal,
  searchNotes,
  getMaintenance,
  getShopping,
  addShopping,
];

const TOOL_BY_NAME = new Map(ALL_TOOLS.map((t) => [t.spec.function.name, t]));
export const toolByName = (name: string) => TOOL_BY_NAME.get(name);

const TRIGGERS: [Group, RegExp][] = [
  ["business", /business|client|deliverable|mrr|revenue|versaly|straten|invoice|proposal|retainer|outreach|lead|audit|contract/i],
  ["university", /universit|class|lecture|cat\b|cats\b|exam|assignment|unit\b|units\b|lecturer|lms|moodle|marks?\b|grades?\b|course|study|submission|submit|due/i],
  ["business", /done|finished|completed?|delivered|handed over|shipped/i],
  ["finance", /spen[dt]|money|budget|kes|ksh|expense|income|paid|bought|buy|salary|cash|finance|cost|mpesa|m-pesa|balance/i],
  ["life", /shop|grocer|maintenance|backup|back up|service|buy|supermarket/i],
  ["projects", /project|note|goal|plan|break down|melio|faida/i],
];

/** Only the tools the message could need are sent, which keeps each call small enough for free-tier limits. */
export function toolsFor(message: string, recent: string[] = []): AgentTool[] {
  const text = [message, ...recent.slice(-2)].join(" \n ");
  const groups = new Set<Group>(["core"]);
  for (const [g, re] of TRIGGERS) if (re.test(text)) groups.add(g);
  // A vague question ("how am I doing?") gets the main read tools from each area.
  if (groups.size === 1 && /how|doing|status|overview|everything|summary|summar|where|week/i.test(message)) {
    ["business", "university", "finance"].forEach((g) => groups.add(g as Group));
    return ALL_TOOLS.filter((t) => !t.write && t.groups.some((g) => groups.has(g)));
  }
  return ALL_TOOLS.filter((t) => t.groups.some((g) => groups.has(g)));
}
