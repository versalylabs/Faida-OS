import { prisma } from "@/lib/db";
import { decryptToken } from "@/lib/lms/crypto";
import {
  MoodleClient,
  MoodleError,
  MoodleTokenError,
  createMoodleClient,
  mapLimit,
} from "@/lib/lms/moodle";
import { fromUnix, htmlToText, isNoiseCourse, parseCourseName, quizKind, toNumber } from "@/lib/lms/text";

/**
 * Reads the student's LMS (Moodle) with their access key and keeps Faida OS in step:
 * units, assignments, quizzes/CATs, class links, materials and announcements, plus a log of
 * what changed so the University page can show "what happened since last time".
 *
 * Everything is read-only against the LMS. Nothing is ever submitted or changed there.
 */

export const AUTO_SYNC_AFTER_MS = 8 * 60 * 60 * 1000;
const STALE_LOCK_MS = 90 * 1000;
const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#06b6d4", "#ec4899", "#84cc16"];
const RESOURCE_MODS = new Set(["resource", "folder", "url", "page", "book", "imscp", "lesson"]);
const DAY = 86400000;

export interface SyncSummary {
  skipped?: "not-connected" | "invalid" | "fresh" | "running";
  firstSync?: boolean;
  courses?: number;
  items?: number;
  newItems?: number;
  activities?: number;
  tasksCreated?: number;
  warnings?: string[];
  ms?: number;
}

type FoundItem = {
  kind: "ASSIGNMENT" | "QUIZ" | "ZOOM" | "RESOURCE";
  sourceId: string;
  moodleCourseId: number;
  title: string;
  url: string;
  openAt: Date | null;
  dueAt: Date | null;
  instanceId?: number; // assignment id / quiz id
  durationMinutes?: number;
};

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/\s+(is due|closes|opens|is open)\s*$/i, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const sameDay = (a: Date | null, b: Date | null) => !a || !b || Math.abs(a.getTime() - b.getTime()) < DAY;

async function safe<T>(label: string, warnings: string[], work: Promise<T>): Promise<T | null> {
  try {
    return await work;
  } catch (err) {
    if (err instanceof MoodleTokenError) throw err;
    warnings.push(`${label}: ${err instanceof MoodleError ? err.message : "could not be read"}`);
    return null;
  }
}

export async function syncUser(userId: string, opts: { auto?: boolean; force?: boolean } = {}): Promise<SyncSummary> {
  const conn = await prisma.lmsConnection.findUnique({ where: { userId } });
  if (!conn) return { skipped: "not-connected" };
  if (conn.status === "INVALID" && !opts.force) return { skipped: "invalid" };

  const now = new Date();
  if (opts.auto && conn.lastSyncAt && now.getTime() - conn.lastSyncAt.getTime() < AUTO_SYNC_AFTER_MS) {
    return { skipped: "fresh" };
  }

  // Only one sync per student at a time (a click, the app opening and the daily job can overlap).
  const claim = await prisma.lmsConnection.updateMany({
    where: {
      id: conn.id,
      OR: [{ syncingSince: null }, { syncingSince: { lt: new Date(now.getTime() - STALE_LOCK_MS) } }],
    },
    data: { syncingSince: now },
  });
  if (claim.count === 0) return { skipped: "running" };

  const started = Date.now();
  try {
    const summary = await runSync(userId, conn, now);
    summary.ms = Date.now() - started;
    return summary;
  } catch (err) {
    if (err instanceof MoodleTokenError) {
      await prisma.lmsConnection.update({
        where: { id: conn.id },
        data: {
          status: "INVALID",
          lastError: "Your LMS rejected the access key. Create a new one in the LMS and reconnect.",
          syncingSince: null,
        },
      });
      throw err;
    }
    console.error("LMS sync failed:", err instanceof Error ? err.message : err);
    await prisma.lmsConnection.update({
      where: { id: conn.id },
      data: { status: "ERROR", lastError: "The last sync could not finish. It will try again.", syncingSince: null },
    });
    throw err;
  }
}

async function runSync(
  userId: string,
  conn: NonNullable<Awaited<ReturnType<typeof prisma.lmsConnection.findUnique>>>,
  now: Date
): Promise<SyncSummary> {
  const warnings: string[] = [];
  const base = conn.baseUrl;
  const client: MoodleClient = createMoodleClient(base, decryptToken(conn.tokenEnc), Date.now() + 50_000);

  // ---- who am I, and which features does this LMS allow? -------------------------------------
  const info = await client.call("core_webservice_get_site_info");
  const lmsUserId: number = info.userid;
  const available = new Set<string>((info.functions || []).map((f: any) => f.name));
  const has = (fn: string) => available.size === 0 || available.has(fn);

  // ---- units ---------------------------------------------------------------------------------
  const enrolled: any[] = (await client.call("core_enrol_get_users_courses", { userid: lmsUserId })) || [];
  const selected = enrolled.filter((c) => {
    if (c.id === 1 || c.hidden || c.visible === 0) return false;
    if (isNoiseCourse(String(c.fullname || ""))) return false;
    if (c.enddate && c.enddate > 0 && c.enddate * 1000 < now.getTime() - 14 * DAY) return false;
    return true;
  });

  const existingCourses = await prisma.universityCourse.findMany({ where: { userId } });
  const localByMoodle = new Map<number, { id: string; code: string }>();
  let colorIndex = existingCourses.length;

  for (const c of selected) {
    const parsed = parseCourseName(String(c.fullname || c.shortname), c.shortname);
    const found =
      existingCourses.find((x) => x.sourceId === String(c.id)) ||
      existingCourses.find((x) => !x.sourceId && x.code.toUpperCase() === parsed.code);
    const data = {
      name: parsed.name,
      lecturer: parsed.lecturer ?? found?.lecturer ?? null,
      semester: parsed.term ?? found?.semester ?? null,
      sourceId: String(c.id),
      sourceSystem: "MOODLE",
      sourceUrl: `${base}/course/view.php?id=${c.id}`,
      lastSyncedAt: now,
      lmsCompletion: typeof c.progress === "number" ? Math.round(c.progress) : null,
      status: "ACTIVE",
    };
    const saved = found
      ? await prisma.universityCourse.update({ where: { id: found.id }, data: { ...data, code: parsed.code } })
      : await prisma.universityCourse.create({
          data: { ...data, userId, code: parsed.code, color: COLORS[colorIndex++ % COLORS.length], credits: 3 },
        });
    localByMoodle.set(c.id, { id: saved.id, code: saved.code });
  }

  const courseIds: number[] = selected.map((c) => c.id);
  if (courseIds.length === 0) warnings.push("No current units were found in your LMS.");

  // ---- what exists in the LMS ----------------------------------------------------------------
  const [assignRes, quizRes, forumRes, zoomRes, contentsList, gradesList] = await Promise.all([
    courseIds.length > 0 && has("mod_assign_get_assignments")
      ? safe("Assignments", warnings, client.call("mod_assign_get_assignments", { courseids: courseIds }))
      : null,
    courseIds.length > 0 && has("mod_quiz_get_quizzes_by_courses")
      ? safe("Quizzes", warnings, client.call("mod_quiz_get_quizzes_by_courses", { courseids: courseIds }))
      : null,
    courseIds.length > 0 && has("mod_forum_get_forums_by_courses")
      ? safe("Announcements", warnings, client.call("mod_forum_get_forums_by_courses", { courseids: courseIds }))
      : null,
    has("core_calendar_get_action_events_by_timesort")
      ? safe(
          "Class links",
          warnings,
          client.call("core_calendar_get_action_events_by_timesort", {
            timesortfrom: Math.floor(Date.now() / 1000) - 3600,
            timesortto: Math.floor(Date.now() / 1000) + 14 * 86400,
            limitnum: 50,
          })
        )
      : null,
    has("core_course_get_contents")
      ? mapLimit(courseIds, 3, (id) =>
          safe(
            "Course contents",
            warnings,
            client.call("core_course_get_contents", { courseid: id, options: [{ name: "excludecontents", value: 1 }] })
          )
        )
      : [],
    has("gradereport_user_get_grade_items")
      ? mapLimit(courseIds, 3, (id) =>
          safe("Marks", warnings, client.call("gradereport_user_get_grade_items", { courseid: id, userid: lmsUserId }))
        )
      : [],
  ]);

  const found = new Map<string, FoundItem>();
  const add = (f: FoundItem) => found.set(`${f.kind}:${f.sourceId}`, f);

  // Which activities the student can actually see (hidden ones are skipped), per unit.
  const visible = new Map<number, Set<string>>();
  const contentsOk = new Set<number>();
  courseIds.forEach((id, idx) => {
    const sections: any[] | null = (contentsList as any[])[idx];
    if (!Array.isArray(sections)) return;
    contentsOk.add(id);
    const seen = new Set<string>();
    for (const sec of sections) {
      for (const m of sec.modules || []) {
        if (m.uservisible === false || m.visible === 0) continue;
        const cmid = String(m.id);
        seen.add(cmid);
        if (RESOURCE_MODS.has(m.modname)) {
          add({
            kind: "RESOURCE",
            sourceId: cmid,
            moodleCourseId: id,
            title: String(m.name || "Material").slice(0, 200),
            url: `${base}/mod/${m.modname}/view.php?id=${cmid}`,
            openAt: null,
            dueAt: null,
          });
        }
      }
    }
    visible.set(id, seen);
  });
  const isVisible = (courseId: number, cmid: string) => !visible.has(courseId) || visible.get(courseId)!.has(cmid);

  for (const course of assignRes?.courses || []) {
    for (const a of course.assignments || []) {
      if (a.nosubmissions) continue; // no online submission to track
      const cmid = String(a.cmid);
      if (!isVisible(course.id, cmid)) continue;
      add({
        kind: "ASSIGNMENT",
        sourceId: cmid,
        moodleCourseId: course.id,
        title: String(a.name).slice(0, 200),
        url: `${base}/mod/assign/view.php?id=${cmid}`,
        openAt: fromUnix(a.allowsubmissionsfromdate),
        dueAt: fromUnix(a.duedate),
        instanceId: a.id,
      });
    }
  }

  for (const q of quizRes?.quizzes || []) {
    const cmid = String(q.coursemodule);
    if (!isVisible(q.course, cmid)) continue;
    add({
      kind: "QUIZ",
      sourceId: cmid,
      moodleCourseId: q.course,
      title: String(q.name).slice(0, 200),
      url: `${base}/mod/quiz/view.php?id=${cmid}`,
      openAt: fromUnix(q.timeopen),
      dueAt: fromUnix(q.timeclose),
      instanceId: q.id,
      durationMinutes: q.timelimit ? Math.round(q.timelimit / 60) : undefined,
    });
  }

  for (const ev of zoomRes?.events || []) {
    if (ev.modulename !== "zoom" || !ev.url || !ev.course?.id || !localByMoodle.has(ev.course.id)) continue;
    const cmid = String(ev.url).match(/[?&]id=(\d+)/)?.[1];
    if (!cmid) continue;
    add({
      kind: "ZOOM",
      sourceId: cmid,
      moodleCourseId: ev.course.id,
      title: String(ev.name || "Class").slice(0, 200),
      url: `${base}/mod/zoom/view.php?id=${cmid}`,
      openAt: null,
      dueAt: fromUnix(ev.timestart),
    });
  }

  // ---- marks ---------------------------------------------------------------------------------
  const marks = new Map<string, { earned: number; max: number }>();
  const marksOk = new Set<number>();
  courseIds.forEach((id, idx) => {
    const res = (gradesList as any[])[idx];
    const items: any[] | undefined = res?.usergrades?.[0]?.gradeitems;
    if (!Array.isArray(items)) return;
    marksOk.add(id);
    for (const g of items) {
      if (g.cmid === undefined || g.cmid === null) continue;
      const earned = toNumber(g.graderaw);
      const max = toNumber(g.grademax);
      if (earned !== null && max) marks.set(String(g.cmid), { earned, max });
    }
  });

  // ---- what we already know ------------------------------------------------------------------
  const dbItems = await prisma.lmsItem.findMany({ where: { userId } });
  const known = new Map(dbItems.map((i) => [`${i.kind}:${i.sourceId}`, i]));

  // Submission status is only (re)checked for work that is still open; finished work stays finished.
  const needStatus = [...found.values()].filter(
    (f) => (f.kind === "ASSIGNMENT" || f.kind === "QUIZ") && (known.get(`${f.kind}:${f.sourceId}`)?.state ?? "TODO") === "TODO"
  );
  const submitted = new Set<string>();
  await mapLimit(needStatus, 4, async (f) => {
    const key = `${f.kind}:${f.sourceId}`;
    try {
      if (f.kind === "ASSIGNMENT") {
        const st = await client.call("mod_assign_get_submission_status", { assignid: f.instanceId, userid: lmsUserId });
        const sub = st?.lastattempt?.submission?.status;
        const team = st?.lastattempt?.teamsubmission?.status;
        if (sub === "submitted" || team === "submitted") submitted.add(key);
      } else {
        const res = await client.call("mod_quiz_get_user_attempts", {
          quizid: f.instanceId,
          userid: lmsUserId,
          status: "all",
          includepreviews: 0,
        });
        if ((res?.attempts || []).some((a: any) => a.state === "finished")) submitted.add(key);
      }
    } catch (err) {
      if (err instanceof MoodleTokenError) throw err;
      warnings.push(`Status of "${f.title}" could not be checked`);
    }
  });

  // ---- save items and work out what changed --------------------------------------------------
  const baseline = conn.baselineDone;
  const activities: {
    userId: string;
    courseId: string | null;
    itemId: string | null;
    type: string;
    title: string;
    detail: string | null;
    url: string | null;
    dedupeKey: string;
    occurredAt: Date;
  }[] = [];
  const newMaterials = new Map<string, { courseId: string; titles: string[]; url: string; ids: string[] }>();
  const saved: { row: Awaited<ReturnType<typeof prisma.lmsItem.upsert>>; f: FoundItem; isNew: boolean }[] = [];
  const entries = [...found.values()];

  for (let i = 0; i < entries.length; i += 10) {
    const chunk = entries.slice(i, i + 10);
    const rows = await Promise.all(
      chunk.map((f) => {
        const key = `${f.kind}:${f.sourceId}`;
        const ex = known.get(key);
        const course = localByMoodle.get(f.moodleCourseId);
        const m = marks.get(f.sourceId);

        let state = ex?.state ?? "TODO";
        let earned = ex?.gradeEarned ?? null;
        let max = ex?.gradeMax ?? null;
        if (f.kind === "ASSIGNMENT" || f.kind === "QUIZ") {
          if (m && marksOk.has(f.moodleCourseId)) {
            state = "GRADED";
            earned = m.earned;
            max = m.max;
          } else if (submitted.has(key) && state === "TODO") {
            state = "SUBMITTED";
          }
        }

        const changed =
          !ex ||
          ex.state !== state ||
          ex.title !== f.title ||
          ex.dueAt?.getTime() !== f.dueAt?.getTime() ||
          ex.gradeEarned !== earned;

        const data = {
          courseId: course?.id ?? null,
          title: f.title,
          url: f.url,
          openAt: f.openAt,
          dueAt: f.dueAt,
          state,
          gradeEarned: earned,
          gradeMax: max,
          lastSeenAt: now,
        };
        return prisma.lmsItem
          .upsert({
            where: { userId_kind_sourceId: { userId, kind: f.kind, sourceId: f.sourceId } },
            create: { ...data, userId, kind: f.kind, sourceId: f.sourceId, firstSeenAt: now, lastChangedAt: now },
            update: changed ? { ...data, lastChangedAt: now } : { lastSeenAt: now },
          })
          .then((row) => ({ row, f, isNew: !ex }));
      })
    );
    saved.push(...rows);
  }

  if (baseline) {
    for (const { row, f, isNew } of saved) {
      const key = `${f.kind}:${f.sourceId}`;
      const ex = known.get(key);
      const courseCode = row.courseId ? [...localByMoodle.values()].find((c) => c.id === row.courseId)?.code : null;
      const label = courseCode ? `${courseCode} · ` : "";
      const ctx = { userId, courseId: row.courseId, itemId: row.id, url: row.url, occurredAt: now };

      if (f.kind === "RESOURCE") {
        if (isNew && row.courseId) {
          const g = newMaterials.get(row.courseId) || { courseId: row.courseId, titles: [], url: f.url, ids: [] };
          g.titles.push(f.title);
          g.ids.push(f.sourceId);
          newMaterials.set(row.courseId, g);
        }
        continue;
      }
      if (f.kind === "ZOOM") continue;

      const isOld = row.dueAt && row.dueAt.getTime() < now.getTime() - 7 * DAY;
      if (isNew && !isOld && row.state === "TODO") {
        activities.push({
          ...ctx,
          type: "NEW_ITEM",
          title: `${label}New ${f.kind === "QUIZ" ? "quiz" : "assignment"}: ${f.title}`,
          detail: row.dueAt ? `Due ${row.dueAt.toISOString()}` : null,
          dedupeKey: `new:${key}`,
        });
      }
      if (ex && ex.state === "TODO" && row.state === "SUBMITTED") {
        activities.push({ ...ctx, type: "SUBMITTED", title: `${label}Submitted: ${f.title}`, detail: null, dedupeKey: `sub:${key}` });
      }
      if (row.state === "GRADED" && (!ex || ex.state !== "GRADED" || ex.gradeEarned !== row.gradeEarned) && !(isNew && isOld)) {
        activities.push({
          ...ctx,
          type: "GRADED",
          title: `${label}Marked: ${f.title}`,
          detail: row.gradeEarned !== null && row.gradeMax ? `${row.gradeEarned} / ${row.gradeMax}` : null,
          dedupeKey: `grade:${key}:${row.gradeEarned}`,
        });
      }
      // Only worth telling about while the work is still open (an extension, a moved CAT).
      if (
        ex &&
        row.state === "TODO" &&
        ex.dueAt &&
        row.dueAt &&
        row.dueAt.getTime() > now.getTime() - DAY &&
        Math.abs(ex.dueAt.getTime() - row.dueAt.getTime()) > 60_000
      ) {
        activities.push({
          ...ctx,
          type: "DUE_CHANGED",
          title: `${label}Deadline changed: ${f.title}`,
          detail: `Now due ${row.dueAt.toISOString()}`,
          dedupeKey: `due:${key}:${row.dueAt.getTime()}`,
        });
      }
    }

    for (const g of newMaterials.values()) {
      const code = [...localByMoodle.values()].find((c) => c.id === g.courseId)?.code;
      activities.push({
        userId,
        courseId: g.courseId,
        itemId: null,
        type: "NEW_MATERIAL",
        title:
          g.titles.length === 1
            ? `${code ? code + " · " : ""}New material: ${g.titles[0]}`
            : `${code ? code + " · " : ""}${g.titles.length} new materials added`,
        detail: g.titles.length > 1 ? g.titles.slice(0, 4).join(", ") : null,
        url: g.url,
        dedupeKey: `res:${g.courseId}:${[...g.ids].sort().join(",").slice(0, 120)}`,
        occurredAt: now,
      });
    }
  }

  // Items that disappeared from a unit we read in full (hidden or removed by the lecturer).
  const seenKeys = new Set(found.keys());
  const staleIds = dbItems
    .filter((i) => {
      if (i.kind === "ZOOM" || seenKeys.has(`${i.kind}:${i.sourceId}`)) return false;
      const moodleId = [...localByMoodle.entries()].find(([, c]) => c.id === i.courseId)?.[0];
      return moodleId !== undefined && contentsOk.has(moodleId) && !!assignRes && !!quizRes;
    })
    .map((i) => i.id);
  if (staleIds.length) await prisma.lmsItem.deleteMany({ where: { id: { in: staleIds }, userId } });

  // ---- keep Tasks and CATs in step so the planner, Lazy Mode and the dashboard see them ------
  const tasksCreated = await mirrorToTasks(userId, saved, localByMoodle, now);

  // ---- announcements -------------------------------------------------------------------------
  let announcementsSeen = 0;
  const newsForums = (Array.isArray(forumRes) ? forumRes : []).filter((f: any) => f.type === "news" && localByMoodle.has(f.course));
  if (newsForums.length && (has("mod_forum_get_forum_discussions") || has("mod_forum_get_forum_discussions_paginated"))) {
    const lists = await mapLimit(newsForums, 3, async (forum: any) => {
      const modern = has("mod_forum_get_forum_discussions");
      const res = await safe(
        "Announcements",
        warnings,
        modern
          ? client.call("mod_forum_get_forum_discussions", { forumid: forum.id, sortorder: -1, page: 0, perpage: 10 })
          : client.call("mod_forum_get_forum_discussions_paginated", {
              forumid: forum.id,
              sortby: "timemodified",
              sortdirection: "DESC",
              page: 0,
              perpage: 10,
            })
      );
      return { forum, discussions: (res?.discussions || []) as any[] };
    });

    const ids = lists.flatMap((l) => l.discussions.map((d) => String(d.discussion ?? d.id)));
    const have = new Set(
      (await prisma.academicAnnouncement.findMany({ where: { userId, sourceId: { in: ids } }, select: { sourceId: true } })).map(
        (a) => a.sourceId
      )
    );
    for (const { forum, discussions } of lists) {
      const course = localByMoodle.get(forum.course)!;
      for (const d of discussions) {
        const sourceId = String(d.discussion ?? d.id);
        announcementsSeen++;
        if (have.has(sourceId)) continue;
        const published = fromUnix(d.timemodified) || fromUnix(d.created) || now;
        const title = htmlToText(String(d.subject || d.name || "Announcement"), 200);
        const content = htmlToText(d.message);
        await prisma.academicAnnouncement.create({
          data: { userId, courseId: course.id, title, content, publishedAt: published, sourceId },
        });
        if (baseline && now.getTime() - published.getTime() < 14 * DAY) {
          activities.push({
            userId,
            courseId: course.id,
            itemId: null,
            type: "ANNOUNCEMENT",
            title: `${course.code} · Announcement: ${title}`,
            detail: content.slice(0, 240) || null,
            url: `${base}/mod/forum/discuss.php?d=${sourceId}`,
            dedupeKey: `ann:${sourceId}`,
            occurredAt: published,
          });
        }
      }
    }
  }

  const created = activities.length
    ? await prisma.lmsActivity.createMany({ data: activities, skipDuplicates: true })
    : { count: 0 };

  // Keep the activity log from growing forever.
  await prisma.lmsActivity.deleteMany({ where: { userId, occurredAt: { lt: new Date(now.getTime() - 120 * DAY) } } });

  const courseProblems = warnings.filter((w) => /contents|assignments|quizzes|marks/i.test(w)).length;
  await prisma.lmsConnection.update({
    where: { id: conn.id },
    data: {
      status: "ACTIVE",
      lastError: warnings.length ? warnings.slice(0, 3).join(" · ").slice(0, 400) : null,
      lastSyncAt: now,
      syncingSince: null,
      lmsUserId,
      lmsUserName: String(info.fullname || info.username || "").slice(0, 120) || null,
      baselineDone: baseline || courseProblems === 0,
    },
  });

  void announcementsSeen;
  return {
    firstSync: !baseline,
    courses: selected.length,
    items: saved.length,
    newItems: saved.filter((s) => s.isNew).length,
    activities: created.count,
    tasksCreated,
    warnings,
  };
}

/** Creates/links the Faida task or CAT for each LMS item and ticks them off once submitted. */
async function mirrorToTasks(
  userId: string,
  saved: { row: any; f: FoundItem; isNew: boolean }[],
  localByMoodle: Map<number, { id: string; code: string }>,
  now: Date
): Promise<number> {
  const work = saved.filter((s) => s.f.kind === "ASSIGNMENT" || s.f.kind === "QUIZ");
  if (work.length === 0) return 0;

  const [tasks, assessments] = await Promise.all([
    prisma.task.findMany({
      where: { userId, isAcademic: true },
      select: { id: true, title: true, dueDate: true, status: true, submissionUrl: true, courseId: true },
    }),
    prisma.academicAssessment.findMany({
      where: { userId },
      select: { id: true, title: true, courseId: true, date: true },
    }),
  ]);
  const claimed = new Set<string>();
  let created = 0;

  for (const { row, f } of work) {
    const done = row.state === "SUBMITTED" || row.state === "GRADED";
    const recent = !row.dueAt || row.dueAt.getTime() > now.getTime() - 14 * DAY;
    const isAssessment = f.kind === "QUIZ" && quizKind(f.title) !== "QUIZ";

    try {
      if (isAssessment) {
        const kind = quizKind(f.title);
        const grade = row.gradeEarned !== null && row.gradeMax ? `${row.gradeEarned}/${row.gradeMax}` : null;
        let id: string | null = row.assessmentId;
        if (!id) {
          const match = assessments.find(
            (a) => !claimed.has(a.id) && a.courseId === row.courseId && norm(a.title) === norm(f.title)
          );
          if (match) id = match.id;
        }
        if (id) {
          claimed.add(id);
          await prisma.academicAssessment.updateMany({
            where: { id, userId },
            data: { isCompleted: done, ...(grade ? { grade } : {}), ...(row.dueAt ? { date: row.dueAt } : {}) },
          });
        } else if (row.courseId && row.dueAt && (recent || !done)) {
          const made = await prisma.academicAssessment.create({
            data: {
              userId,
              courseId: row.courseId,
              title: f.title,
              type: kind,
              date: row.dueAt,
              durationMinutes: f.durationMinutes || 60,
              isCompleted: done,
              grade,
            },
          });
          id = made.id;
          created++;
        }
        if (id && id !== row.assessmentId) await prisma.lmsItem.update({ where: { id: row.id }, data: { assessmentId: id } });
        continue;
      }

      let taskId: string | null = row.taskId;
      const linked = taskId ? tasks.find((t) => t.id === taskId) : undefined;
      if (!taskId) {
        const match = tasks.find(
          (t) =>
            !claimed.has(t.id) &&
            (t.submissionUrl === row.url ||
              (norm(t.title) === norm(f.title) && sameDay(t.dueDate, row.dueAt) && (!t.courseId || t.courseId === row.courseId)))
        );
        if (match) taskId = match.id;
      }
      const target = linked || (taskId ? tasks.find((t) => t.id === taskId) : undefined);

      if (target) {
        claimed.add(target.id);
        await prisma.task.updateMany({
          where: { id: target.id, userId },
          data: {
            submissionUrl: row.url,
            ...(target.courseId ? {} : { courseId: row.courseId }),
            ...(row.dueAt ? { dueDate: row.dueAt } : {}),
            ...(done && target.status !== "DONE" ? { status: "DONE" } : {}),
          },
        });
      } else if (!taskId && !done && !row.dismissed && recent) {
        const hoursLeft = row.dueAt ? (row.dueAt.getTime() - now.getTime()) / 3600000 : Infinity;
        const course = [...localByMoodle.values()].find((c) => c.id === row.courseId);
        const made = await prisma.task.create({
          data: {
            userId,
            courseId: row.courseId,
            isAcademic: true,
            academicType: "ASSIGNMENT",
            title: f.title,
            dueDate: row.dueAt,
            estimatedMinutes: f.kind === "QUIZ" ? 45 : 90,
            priority: hoursLeft < 48 ? "URGENT" : hoursLeft < 24 * 7 ? "HIGH" : "MEDIUM",
            status: "TODO",
            category: course?.code || "Academic",
            submissionUrl: row.url,
          },
        });
        taskId = made.id;
        created++;
      }
      if (taskId && taskId !== row.taskId) await prisma.lmsItem.update({ where: { id: row.id }, data: { taskId } });
    } catch (err) {
      console.error("LMS mirror failed for one item:", err instanceof Error ? err.message : err);
    }
  }
  return created;
}
