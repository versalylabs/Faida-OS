import { prisma } from "@/lib/db";
import { zonedNow } from "@/lib/tz";
import { computeAttention, computeUnitProgress, type ProgressItem } from "@/lib/lms/progress";

/** Everything the University page needs about the LMS in one read. */
export async function getLmsOverview(userId: string) {
  const now = new Date();
  const conn = await prisma.lmsConnection.findUnique({ where: { userId } });

  if (!conn) {
    return { connected: false as const };
  }

  const [courses, rawItems, activities, unread] = await Promise.all([
    prisma.universityCourse.findMany({
      where: { userId, sourceSystem: "MOODLE", status: "ACTIVE" },
      orderBy: { code: "asc" },
    }),
    prisma.lmsItem.findMany({
      where: { userId, kind: { in: ["ASSIGNMENT", "QUIZ", "ZOOM"] } },
      orderBy: { dueAt: "asc" },
    }),
    prisma.lmsActivity.findMany({ where: { userId }, orderBy: { occurredAt: "desc" }, take: 40 }),
    prisma.lmsActivity.count({ where: { userId, readAt: null } }),
  ]);

  const courseById = new Map(courses.map((c) => [c.id, c]));
  const items: ProgressItem[] = rawItems
    .filter((i) => i.courseId && courseById.has(i.courseId))
    .map((i) => ({
      id: i.id,
      courseId: i.courseId,
      kind: i.kind,
      title: i.title,
      url: i.url,
      dueAt: i.dueAt,
      state: i.state,
      gradeEarned: i.gradeEarned,
      gradeMax: i.gradeMax,
      dismissed: i.dismissed,
    }));

  const units = computeUnitProgress(
    courses.map((c) => ({
      id: c.id,
      code: c.code,
      name: c.name,
      lecturer: c.lecturer,
      color: c.color,
      sourceUrl: c.sourceUrl,
      lmsCompletion: c.lmsCompletion,
    })),
    items,
    now
  );

  const { endOfDay } = zonedNow(now);
  const attention = computeAttention(items, now, endOfDay);
  const withCourse = <T extends { courseId: string | null }>(list: T[]) =>
    list.map((x) => ({
      ...x,
      courseCode: (x.courseId && courseById.get(x.courseId)?.code) || null,
      courseColor: (x.courseId && courseById.get(x.courseId)?.color) || null,
    }));

  // Live class links for the next day and a half (shown as "Join" buttons).
  const classesSoon = items
    .filter((i) => i.kind === "ZOOM" && i.dueAt && i.dueAt.getTime() > now.getTime() - 45 * 60000 && i.dueAt.getTime() < now.getTime() + 36 * 3600000)
    .map((i) => ({ id: i.id, courseId: i.courseId, title: i.title, url: i.url, startsAt: i.dueAt!.toISOString() }));

  return {
    connected: true as const,
    connection: {
      baseUrl: conn.baseUrl,
      status: conn.status,
      lastError: conn.lastError,
      lastSyncAt: conn.lastSyncAt?.toISOString() ?? null,
      studentName: conn.lmsUserName,
      firstSyncPending: !conn.baselineDone,
    },
    units,
    attention: { missed: withCourse(attention.missed), dueSoon: withCourse(attention.dueSoon) },
    classesSoon: withCourse(classesSoon),
    feed: activities.map((a) => ({
      id: a.id,
      type: a.type,
      title: a.title,
      detail: a.detail,
      url: a.url,
      occurredAt: a.occurredAt.toISOString(),
      unread: !a.readAt,
      courseCode: (a.courseId && courseById.get(a.courseId)?.code) || null,
    })),
    unreadCount: unread,
  };
}
