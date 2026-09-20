import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { mode, moodleUrl, moodleToken, iCalUrl, importData } = body;

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
        const res = await fetch(iCalUrl);
        const icsText = await res.text();

        // Simple iCal VEVENT parser
        const events = icsText.split("BEGIN:VEVENT");
        for (let i = 1; i < events.length; i++) {
          const evChunk = events[i].split("END:VEVENT")[0];
          const summaryMatch = evChunk.match(/SUMMARY:(.+)/);
          const dtStartMatch = evChunk.match(/DTSTART(?:;[^:]+)?:(\d{8}T\d{6}Z?)/);
          const uidMatch = evChunk.match(/UID:(.+)/);

          if (!summaryMatch || !dtStartMatch) continue;

          const title = summaryMatch[1].trim();
          const uid = uidMatch ? uidMatch[1].trim() : `ical-${i}`;

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
              OR: [{ title }, { submissionUrl: uid }],
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
                submissionUrl: uid,
                category: "Moodle LMS",
              },
            });
            importedCount++;
          } else {
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
        return NextResponse.json(
          { success: false, error: `Failed to fetch or parse iCal feed: ${err.message}` },
          { status: 500 }
        );
      }
    }

    // -------------------------------------------------------------------------
    // Mode 3: Official Moodle Web Services API
    // -------------------------------------------------------------------------
    if (mode === "MOODLE_API" && moodleUrl && moodleToken) {
      const cleanUrl = moodleUrl.replace(/\/+$/, "");
      const wsEndpoint = `${cleanUrl}/webservice/rest/server.php`;

      try {
        // 1. Test token & get user site info
        const infoUrl = `${wsEndpoint}?wstoken=${moodleToken}&wsfunction=core_webservice_get_site_info&moodlewsrestformat=json`;
        const infoRes = await fetch(infoUrl);
        const infoData = await infoRes.json();

        if (infoData.exception || infoData.errorcode) {
          return NextResponse.json(
            {
              success: false,
              error: `Moodle API error: ${infoData.message || infoData.errorcode}`,
            },
            { status: 400 }
          );
        }

        const moodleUserId = infoData.userid;

        // 2. Fetch Enrolled Courses
        const coursesUrl = `${wsEndpoint}?wstoken=${moodleToken}&wsfunction=core_enrol_get_users_courses&userid=${moodleUserId}&moodlewsrestformat=json`;
        const coursesRes = await fetch(coursesUrl);
        const enrolledCourses = await coursesRes.json();

        if (Array.isArray(enrolledCourses)) {
          for (const mc of enrolledCourses) {
            if (mc.id === 1) continue; // Skip site home

            const code = (mc.shortname || mc.fullname).slice(0, 15).toUpperCase();
            const existingCourse = await prisma.universityCourse.findFirst({
              where: {
                userId: user.id,
                OR: [{ sourceId: String(mc.id) }, { code }],
              },
            });

            if (existingCourse) {
              await prisma.universityCourse.update({
                where: { id: existingCourse.id },
                data: {
                  sourceId: String(mc.id),
                  sourceSystem: "MOODLE",
                  sourceUrl: `${cleanUrl}/course/view.php?id=${mc.id}`,
                  lastSyncedAt: new Date(),
                },
              });
              updatedCount++;
            } else {
              await prisma.universityCourse.create({
                data: {
                  userId: user.id,
                  code,
                  name: mc.fullname,
                  sourceId: String(mc.id),
                  sourceSystem: "MOODLE",
                  sourceUrl: `${cleanUrl}/course/view.php?id=${mc.id}`,
                  lastSyncedAt: new Date(),
                },
              });
              importedCount++;
            }
          }
        }

        // Store credential safely in DevCredential
        await prisma.devCredential.upsert({
          where: {
            id: `moodle-${user.id}`,
          },
          create: {
            id: `moodle-${user.id}`,
            userId: user.id,
            serviceName: "Moodle LMS",
            environment: "production",
            keyName: "MOODLE_TOKEN",
            keyValue: moodleToken,
            url: cleanUrl,
            notes: `Moodle user: ${infoData.fullname || infoData.username}`,
          },
          update: {
            keyValue: moodleToken,
            url: cleanUrl,
            notes: `Moodle user: ${infoData.fullname || infoData.username}`,
          },
        }).catch(() => {});

        return NextResponse.json({
          success: true,
          message: `Connected to Moodle (${infoData.sitename || cleanUrl}). Enrolled courses synchronized.`,
          importedCount,
          updatedCount,
          siteName: infoData.sitename,
          studentName: infoData.fullname,
        });
      } catch (err: any) {
        return NextResponse.json(
          { success: false, error: `Moodle connection error: ${err.message}` },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      { success: false, error: "Invalid sync mode or missing parameters" },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("Error synchronizing academic data:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to synchronize academic data" },
      { status: 500 }
    );
  }
}
