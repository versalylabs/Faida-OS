import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ValidationError, badRequest, readBody } from "@/lib/validate";
import { fetchPublicText } from "@/lib/safeFetch";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await readBody(req);
    const { mode, iCalUrl, importData } = body;

    let importedCount = 0;
    let updatedCount = 0;
    const errors: string[] = [];

    // -------------------------------------------------------------------------
    // Mode 1: Manual / Structured Data Import (Courses, Assignments, Classes)
    // -------------------------------------------------------------------------
    if (mode === "MANUAL_IMPORT" && importData) {
      const { courses = [], assignments = [], classes = [] } = importData;

      // 1. Upsert Courses
      for (const c of courses) {
        if (!c.code || !c.name) continue;
        const existing = await prisma.universityCourse.findFirst({
          where: { userId: user.id, code: c.code.trim().toUpperCase() },
        });

        if (existing) {
          await prisma.universityCourse.update({
            where: { id: existing.id },
            data: {
              name: c.name.trim(),
              lecturer: c.lecturer || existing.lecturer,
              semester: c.semester || existing.semester,
              color: c.color || existing.color,
            },
          });
          updatedCount++;
        } else {
          await prisma.universityCourse.create({
            data: {
              userId: user.id,
              code: c.code.trim().toUpperCase(),
              name: c.name.trim(),
              lecturer: c.lecturer || null,
              semester: c.semester || "Year 2 Sem 1",
              color: c.color || "#3b82f6",
              credits: c.credits || 3,
              sourceSystem: "IMPORT",
            },
          });
          importedCount++;
        }
      }

      // 2. Upsert Assignments (as Faida Tasks)
      for (const a of assignments) {
        if (!a.title) continue;

        let courseId = null;
        if (a.courseCode) {
          const course = await prisma.universityCourse.findFirst({
            where: { userId: user.id, code: a.courseCode.trim().toUpperCase() },
          });
          if (course) courseId = course.id;
        }

        // Deduplication by title and userId
        const existing = await prisma.task.findFirst({
          where: { userId: user.id, isAcademic: true, title: a.title.trim() },
        });

        if (existing) {
          await prisma.task.update({
            where: { id: existing.id },
            data: {
              dueDate: a.dueDate ? new Date(a.dueDate) : existing.dueDate,
              estimatedMinutes: a.estimatedMinutes || existing.estimatedMinutes,
              courseId: courseId || existing.courseId,
            },
          });
          updatedCount++;
        } else {
          await prisma.task.create({
            data: {
              userId: user.id,
              courseId,
              isAcademic: true,
              academicType: "ASSIGNMENT",
              title: a.title.trim(),
              description: a.description || null,
              dueDate: a.dueDate ? new Date(a.dueDate) : null,
              estimatedMinutes: a.estimatedMinutes || 180,
              priority: a.priority || "HIGH",
              status: "TODO",
              category: a.courseCode || "Academic",
            },
          });
          importedCount++;
        }
      }

      // 3. Upsert Class Timetable Sessions
      for (const cls of classes) {
        if (!cls.courseCode || cls.dayOfWeek === undefined || !cls.startTime || !cls.endTime) continue;

        const course = await prisma.universityCourse.findFirst({
          where: { userId: user.id, code: cls.courseCode.trim().toUpperCase() },
        });
        if (!course) continue;

        const existing = await prisma.academicClass.findFirst({
          where: {
            userId: user.id,
            courseId: course.id,
            dayOfWeek: parseInt(cls.dayOfWeek, 10),
            startTime: cls.startTime.trim(),
          },
        });

        if (existing) {
          await prisma.academicClass.update({
            where: { id: existing.id },
            data: {
              endTime: cls.endTime.trim(),
              location: cls.location || existing.location,
            },
          });
          updatedCount++;
        } else {
          await prisma.academicClass.create({
            data: {
              userId: user.id,
              courseId: course.id,
              title: cls.title || "Lecture",
              dayOfWeek: parseInt(cls.dayOfWeek, 10),
              startTime: cls.startTime.trim(),
              endTime: cls.endTime.trim(),
              location: cls.location || null,
              lecturer: cls.lecturer || course.lecturer || null,
            },
          });
          importedCount++;
        }
      }

      return NextResponse.json({
        success: true,
        message: `Import complete: ${importedCount} items created, ${updatedCount} items updated.`,
        importedCount,
        updatedCount,
      });
    }

    // -------------------------------------------------------------------------
    // Mode 2: Moodle iCal Calendar Feed Synchronizer
    // -------------------------------------------------------------------------
    if (mode === "ICAL_SYNC" && iCalUrl) {
      try {
        const icsText = await fetchPublicText(iCalUrl, { label: "Calendar URL" });

        // Simple iCal VEVENT parser
        const events = icsText.split("BEGIN:VEVENT").slice(0, 2001); // cap work per sync
        for (let i = 1; i < events.length; i++) {
          // iCal folds long lines (CRLF + space); join them back before reading fields.
          const evChunk = events[i].split("END:VEVENT")[0].replace(/\r?\n[ \t]/g, "");
          const summaryMatch = evChunk.match(/SUMMARY:(.+)/);
          const dtStartMatch = evChunk.match(/DTSTART(?:;[^:]+)?:(\d{8}T\d{6}Z?)/);
          const uidMatch = evChunk.match(/UID:(.+)/);

          if (!summaryMatch || !dtStartMatch) continue;

          const title = summaryMatch[1].trim().replace(/\\([,;])/g, "$1");
          const uid = uidMatch ? uidMatch[1].trim() : `ical-${i}`;

          // Prefer a real activity address when the feed carries one (URL: line, or a Moodle
          // activity link inside the description); otherwise remember the event id so the
          // same event is never imported twice. The id is not a link and is marked as such.
          const explicitUrl = evChunk.match(/^URL[^:\r\n]*:(https?:\/\/\S+)/m)?.[1];
          const activityUrl = evChunk.match(/https?:\/\/[^\s"'<>\\]+\/mod\/\w+\/view\.php\?id=\d+/)?.[0];
          const realUrl = explicitUrl || activityUrl || null;
          const sourceRef = realUrl || `ical:${uid}`;

          // Parse YYYYMMDDTHHMMSS
          const rawDate = dtStartMatch[1].replace("Z", "");
          const y = parseInt(rawDate.slice(0, 4), 10);
          const m = parseInt(rawDate.slice(4, 6), 10) - 1;
          const d = parseInt(rawDate.slice(6, 8), 10);
          const hh = parseInt(rawDate.slice(9, 11), 10);
          const mm = parseInt(rawDate.slice(11, 13), 10);
          const dueDate = new Date(Date.UTC(y, m, d, hh, mm));

          // Deduplication by sourceId or title
          const existing = await prisma.task.findFirst({
            where: {
              userId: user.id,
              isAcademic: true,
              // `uid` alone is how earlier syncs stored it, so it still counts as a match.
              OR: [{ title }, { submissionUrl: uid }, { submissionUrl: `ical:${uid}` }, ...(realUrl ? [{ submissionUrl: realUrl }] : [])],
            },
          });

          if (!existing) {
            await prisma.task.create({
              data: {
                userId: user.id,
                isAcademic: true,
                academicType: "ASSIGNMENT",
                title,
                dueDate,
                estimatedMinutes: 180,
                priority: "HIGH",
                status: "TODO",
                submissionUrl: sourceRef,
                category: "Moodle LMS",
              },
            });
            importedCount++;
          } else {
            // Repair earlier imports whose link was just an event id.
            if (realUrl && existing.submissionUrl !== realUrl) {
              await prisma.task.update({ where: { id: existing.id }, data: { submissionUrl: realUrl } });
            }
            updatedCount++;
          }
        }

        return NextResponse.json({
          success: true,
          message: `iCal synchronization complete: ${importedCount} deadlines imported, ${updatedCount} existing.`,
          importedCount,
          updatedCount,
        });
      } catch (err: any) {
        if (err instanceof ValidationError) return badRequest(err.message);
        return NextResponse.json(
          { success: false, error: "Failed to fetch or parse the iCal feed" },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      { success: false, error: "Invalid sync mode or missing parameters" },
      { status: 400 }
    );
  } catch (error: any) {
    if (error instanceof ValidationError) return badRequest(error.message);
    console.error("Error synchronizing academic data:", error);
    return NextResponse.json(
      { success: false, error: "Failed to synchronize academic data" },
      { status: 500 }
    );
  }
}
