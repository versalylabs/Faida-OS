import { prisma } from "@/lib/db";
import { isoWeekday, zonedDateKey, zonedNow, zonedTime } from "@/lib/tz";

/**
 * One list of everything that has a time attached: calendar events, reminders, task deadlines,
 * assignments and CATs, class sessions and live-class links, maintenance due dates and business
 * deliverables. The Calendar page, the dashboard briefing and Faida AI all read from here, so
 * they can never disagree about what is on today.
 */

export type AgendaCategory = "EVENT" | "REMINDER" | "TASK" | "ACADEMIC" | "CLASS" | "MAINTENANCE" | "BUSINESS";
export type AgendaSource = "EVENT" | "REMINDER" | "TASK" | "CAT" | "CLASS" | "ZOOM" | "MAINTENANCE" | "DELIVERABLE";

export interface AgendaItem {
  key: string;
  id: string; // the underlying record (a class session uses the class id)
  source: AgendaSource;
  category: AgendaCategory;
  title: string;
  subtitle: string | null;
  start: string; // ISO instant
  end: string | null;
  allDay: boolean;
  done: boolean;
  priority: string | null;
  color: string | null;
  href: string | null; // page inside Faida OS
  url: string | null; // outside link (LMS, meeting)
  canToggle: boolean;
  canEdit: boolean;
  raw?: Record<string, unknown>; // for editing events and reminders
}

const CLOSED_TASK = ["DONE", "CANCELLED", "ARCHIVED"];

/** Deadlines saved from a date picker carry no real time: show those as all-day. */
function isDateOnly(d: Date): boolean {
  const utc = d.getUTCHours() === 0 && d.getUTCMinutes() === 0;
  const z = zonedNow(d);
  return utc || (z.hour === 0 && z.minute === 0);
}

export async function getAgenda(userId: string, from: Date, to: Date, now: Date = new Date()) {
  const { startOfDay } = zonedNow(now);

  const [events, reminders, tasks, assessments, zooms, classes, maintenance, deliverables, lateTasks, lateReminders, lateMaintenance, lateDeliverables] =
    await Promise.all([
      prisma.calendarEvent.findMany({
        where: { userId, startTime: { gte: from, lt: to } },
        include: { task: { select: { id: true, title: true, status: true, priority: true } }, note: { select: { id: true, title: true } } },
        orderBy: { startTime: "asc" },
        take: 500,
      }),
      prisma.reminder.findMany({
        where: { userId, dueAt: { gte: from, lt: to } },
        include: { task: { select: { id: true, title: true, status: true, priority: true } }, note: { select: { id: true, title: true } } },
        orderBy: { dueAt: "asc" },
        take: 500,
      }),
      prisma.task.findMany({
        where: { userId, dueDate: { gte: from, lt: to }, status: { notIn: ["CANCELLED", "ARCHIVED"] } },
        include: { course: { select: { code: true, color: true } }, project: { select: { name: true } } },
        orderBy: { dueDate: "asc" },
        take: 500,
      }),
      prisma.academicAssessment.findMany({
        where: { userId, date: { gte: from, lt: to } },
        include: { course: { select: { code: true, color: true } } },
        orderBy: { date: "asc" },
        take: 200,
      }),
      prisma.lmsItem.findMany({
        where: { userId, kind: "ZOOM", dueAt: { gte: from, lt: to } },
        orderBy: { dueAt: "asc" },
        take: 100,
      }),
      prisma.academicClass.findMany({
        where: { userId },
        include: { course: { select: { id: true, code: true, name: true, color: true } } },
        take: 100,
      }),
      prisma.maintenanceItem.findMany({
        where: { userId, nextDueAt: { gte: from, lt: to } },
        orderBy: { nextDueAt: "asc" },
        take: 200,
      }),
      prisma.businessDeliverable.findMany({
        where: { userId, dueDate: { gte: from, lt: to } },
        include: { business: { select: { name: true, color: true } }, client: { select: { name: true } } },
        orderBy: { dueDate: "asc" },
        take: 300,
      }),
      // ---- overdue, whatever the range ----
      prisma.task.findMany({
        where: { userId, dueDate: { lt: startOfDay }, status: { notIn: CLOSED_TASK } },
        include: { course: { select: { code: true, color: true } }, project: { select: { name: true } } },
        orderBy: { dueDate: "desc" },
        take: 40,
      }),
      prisma.reminder.findMany({
        where: { userId, isCompleted: false, dueAt: { lt: now } },
        orderBy: { dueAt: "desc" },
        take: 40,
      }),
      prisma.maintenanceItem.findMany({
        where: { userId, nextDueAt: { lt: now } },
        orderBy: { nextDueAt: "desc" },
        take: 40,
      }),
      prisma.businessDeliverable.findMany({
        where: { userId, status: { not: "COMPLETED" }, dueDate: { lt: startOfDay } },
        include: { business: { select: { name: true, color: true } }, client: { select: { name: true } } },
        orderBy: { dueDate: "desc" },
        take: 40,
      }),
    ]);

  const taskItem = (t: (typeof tasks)[number]): AgendaItem => {
    const d = t.dueDate!;
    return {
      key: `TASK:${t.id}`,
      id: t.id,
      source: "TASK",
      category: t.isAcademic ? "ACADEMIC" : "TASK",
      title: t.title,
      subtitle: t.course?.code || t.project?.name || null,
      start: d.toISOString(),
      end: null,
      allDay: isDateOnly(d),
      done: t.status === "DONE",
      priority: t.priority,
      color: t.course?.color ?? null,
      href: t.isAcademic ? "/university" : "/tasks",
      url: t.isAcademic && t.submissionUrl && /^https?:\/\//.test(t.submissionUrl) ? t.submissionUrl : null,
      canToggle: true,
      canEdit: false,
    };
  };
  const reminderItem = (r: (typeof reminders)[number] | (typeof lateReminders)[number]): AgendaItem => ({
    key: `REMINDER:${r.id}`,
    id: r.id,
    source: "REMINDER",
    category: "REMINDER",
    title: r.title,
    subtitle: r.description ? r.description.slice(0, 80) : null,
    start: r.dueAt.toISOString(),
    end: null,
    allDay: false,
    done: r.isCompleted,
    priority: null,
    color: null,
    href: null,
    url: null,
    canToggle: true,
    canEdit: true,
    raw: r as unknown as Record<string, unknown>,
  });
  const maintenanceItem = (m: (typeof maintenance)[number]): AgendaItem => ({
    key: `MAINTENANCE:${m.id}`,
    id: m.id,
    source: "MAINTENANCE",
    category: "MAINTENANCE",
    title: m.title,
    subtitle: `${m.area.replace("_", " ").toLowerCase()} · every ${m.frequencyDays} days`,
    start: m.nextDueAt.toISOString(),
    end: null,
    allDay: true,
    done: false,
    priority: null,
    color: null,
    href: "/maintenance",
    url: null,
    canToggle: true,
    canEdit: false,
  });
  const deliverableItem = (d: (typeof deliverables)[number]): AgendaItem => ({
    key: `DELIVERABLE:${d.id}`,
    id: d.id,
    source: "DELIVERABLE",
    category: "BUSINESS",
    title: d.title,
    subtitle: [d.business?.name, d.client?.name].filter(Boolean).join(" · ") || null,
    start: d.dueDate!.toISOString(),
    end: null,
    allDay: isDateOnly(d.dueDate!),
    done: d.status === "COMPLETED",
    priority: d.priority,
    color: d.business?.color ?? null,
    href: "/business",
    url: null,
    canToggle: true,
    canEdit: false,
  });

  const items: AgendaItem[] = [];

  for (const e of events) {
    // Calendar rows that only mirror a CAT or a timetable class are already shown as those items.
    if (e.assessmentId || e.classSessionId) continue;
    items.push({
      key: `EVENT:${e.id}`,
      id: e.id,
      source: "EVENT",
      category: "EVENT",
      title: e.title,
      subtitle: e.location || null,
      start: e.startTime.toISOString(),
      end: e.endTime.toISOString(),
      allDay: e.isAllDay,
      done: false,
      priority: null,
      color: null,
      href: null,
      url: null,
      canToggle: false,
      canEdit: true,
      raw: e as unknown as Record<string, unknown>,
    });
  }
  // Adding an assignment also adds a "Deadline: <name>" reminder; the task or CAT already shows that deadline.
  const deadlineTitles = [...tasks, ...lateTasks].map((t) => t.title.toLowerCase()).concat(assessments.map((x) => x.title.toLowerCase()));
  const echoesDeadline = (title: string) => {
    const lower = title.toLowerCase();
    return lower.startsWith("deadline:") && deadlineTitles.some((t) => t.length > 2 && lower.includes(t.replace(/^🎓\s*/u, "")));
  };
  reminders.filter((r) => !echoesDeadline(r.title)).forEach((r) => items.push(reminderItem(r)));

  // Creating a CAT also creates a "🎓 CAT" prep task for the same day; show the CAT once, not twice.
  const catDays = assessments.map((x) => ({ day: zonedDateKey(x.date), title: x.title.toLowerCase() }));
  const isCatShadow = (t: { title: string; isAcademic: boolean; dueDate: Date | null }) =>
    t.isAcademic &&
    !!t.dueDate &&
    catDays.some((c) => c.day === zonedDateKey(t.dueDate!) && t.title.toLowerCase().includes(c.title));
  tasks.filter((t) => t.dueDate && !isCatShadow(t)).forEach((t) => items.push(taskItem(t)));

  for (const a of assessments) {
    items.push({
      key: `CAT:${a.id}`,
      id: a.id,
      source: "CAT",
      category: "ACADEMIC",
      title: a.title,
      subtitle: [a.course?.code, a.type, `${a.durationMinutes} min`].filter(Boolean).join(" · "),
      start: a.date.toISOString(),
      end: new Date(a.date.getTime() + a.durationMinutes * 60000).toISOString(),
      allDay: false,
      done: a.isCompleted,
      priority: "HIGH",
      color: a.course?.color ?? null,
      href: "/university",
      url: null,
      canToggle: false,
      canEdit: false,
    });
  }

  // Live classes from the LMS, then the weekly timetable (skipping a timetable slot the LMS already lists that day).
  const zoomDays = new Set<string>();
  for (const z of zooms) {
    const key = zonedDateKey(z.dueAt!);
    zoomDays.add(`${z.courseId}:${key}`);
    items.push({
      key: `ZOOM:${z.id}`,
      id: z.id,
      source: "ZOOM",
      category: "CLASS",
      title: z.title,
      subtitle: "Live class (LMS)",
      start: z.dueAt!.toISOString(),
      end: new Date(z.dueAt!.getTime() + 90 * 60000).toISOString(),
      allDay: false,
      done: false,
      priority: null,
      color: null,
      href: "/university",
      url: z.url,
      canToggle: false,
      canEdit: false,
    });
  }
  const dayMs = 86400000;
  const firstKey = zonedDateKey(from);
  const lastKey = zonedDateKey(new Date(to.getTime() - 1));
  for (let t = Date.parse(`${firstKey}T12:00:00Z`); t <= Date.parse(`${lastKey}T12:00:00Z`); t += dayMs) {
    const key = new Date(t).toISOString().slice(0, 10);
    const weekday = isoWeekday(key);
    for (const c of classes) {
      if (c.dayOfWeek !== weekday || zoomDays.has(`${c.courseId}:${key}`)) continue;
      items.push({
        key: `CLASS:${c.id}:${key}`,
        id: c.id,
        source: "CLASS",
        category: "CLASS",
        title: `${c.course.code} · ${c.title}`,
        subtitle: [c.course.name, c.location].filter(Boolean).join(" · ") || null,
        start: zonedTime(key, c.startTime).toISOString(),
        end: zonedTime(key, c.endTime).toISOString(),
        allDay: false,
        done: false,
        priority: null,
        color: c.course.color ?? null,
        href: "/university",
        url: c.location && /^https?:\/\//.test(c.location) ? c.location : null,
        canToggle: false,
        canEdit: false,
      });
    }
  }

  maintenance.forEach((m) => items.push(maintenanceItem(m)));
  deliverables.filter((d) => d.dueDate).forEach((d) => items.push(deliverableItem(d)));

  items.sort((a, b) => a.start.localeCompare(b.start));

  const overdue: AgendaItem[] = [
    ...lateTasks.filter((t) => t.dueDate).map((t) => taskItem(t as (typeof tasks)[number])),
    ...lateReminders.filter((r) => !echoesDeadline(r.title)).map(reminderItem),
    ...lateMaintenance.map((m) => maintenanceItem(m as (typeof maintenance)[number])),
    ...lateDeliverables.filter((d) => d.dueDate).map((d) => deliverableItem(d as (typeof deliverables)[number])),
  ].sort((a, b) => b.start.localeCompare(a.start));

  return { items, overdue };
}
