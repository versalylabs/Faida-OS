import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const courseId = searchParams.get("courseId");
    const classId = searchParams.get("classId");

    let targetCourseId: string | null | undefined = courseId;

    if (!targetCourseId && classId) {
      const cls = await prisma.academicClass.findFirst({
        where: { id: classId, userId: user.id },
      });
      if (cls) targetCourseId = cls.courseId;
    }

    if (!targetCourseId) {
      // Pick first active course if none specified
      const firstCourse = await prisma.universityCourse.findFirst({
        where: { userId: user.id, status: "ACTIVE" },
      });
      targetCourseId = firstCourse?.id ?? null;
    }

    if (!targetCourseId) {
      return NextResponse.json(
        { success: false, error: "No course found to prepare for" },
        { status: 404 }
      );
    }

    const [course, materials, assignments, assessments, notes] = await Promise.all([
      prisma.universityCourse.findFirst({
        where: { id: targetCourseId, userId: user.id },
      }),
      prisma.academicMaterial.findMany({
        where: { courseId: targetCourseId, userId: user.id },
        orderBy: [{ weekNumber: "desc" }, { createdAt: "desc" }],
        take: 3,
      }),
      prisma.task.findMany({
        where: { courseId: targetCourseId, userId: user.id, isAcademic: true },
        include: { subtasks: true },
        orderBy: [{ dueDate: "asc" }],
      }),
      prisma.academicAssessment.findMany({
        where: { courseId: targetCourseId, userId: user.id, isCompleted: false },
        orderBy: [{ date: "asc" }],
        take: 2,
      }),
      prisma.note.findMany({
        where: { courseId: targetCourseId, userId: user.id },
        orderBy: [{ updatedAt: "desc" }],
        take: 3,
      }),
    ]);

    if (!course) {
      return NextResponse.json({ success: false, error: "Course not found" }, { status: 404 });
    }

    // Determine Last Topic
    const lastTopic =
      materials[0]?.title ||
      notes[0]?.title.replace(`${course.code}: `, "") ||
      "Core Course Foundations";

    // Determine Coursework Status
    const activeAssignment = assignments.find((a) => a.status !== "DONE");
    let courseworkStatus = "No outstanding assignments.";
    if (activeAssignment) {
      const totalSub = activeAssignment.subtasks.length;
      const doneSub = activeAssignment.subtasks.filter((s) => s.isDone).length;
      const pct = totalSub > 0 ? Math.round((doneSub / totalSub) * 100) : 0;
      courseworkStatus = `${activeAssignment.title} — ${pct > 0 ? `${pct}% complete` : "Not started"}`;
    }

    // Determine Upcoming Assessment
    const now = new Date();
    const upcomingCAT = assessments[0];
    let upcomingAssessmentText = "No upcoming CATs scheduled.";
    if (upcomingCAT) {
      const diffDays = Math.max(
        0,
        Math.ceil((new Date(upcomingCAT.date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      );
      upcomingAssessmentText = `${upcomingCAT.title} in ${diffDays} day${diffDays === 1 ? "" : "s"} (${upcomingCAT.topicsCovered || "Comprehensive"})`;
    }

    // High-yield 15-minute preparation action
    let suggestedPrep = `Review ${lastTopic} summary for 15 minutes before the lecturer begins.`;
    if (materials[0]) {
      suggestedPrep = `Scan ${materials[0].title} (Week ${materials[0].weekNumber || 1}) and formulate 1 question.`;
    }

    const briefing = {
      courseCode: course.code,
      courseName: course.name,
      lecturer: course.lecturer || "Instructor",
      lastTopic,
      relevantMaterial: materials[0] ? materials[0].title : null,
      currentCoursework: courseworkStatus,
      upcomingAssessment: upcomingAssessmentText,
      suggestedPreparation: suggestedPrep,
      recentNotesCount: notes.length,
      materialsCount: materials.length,
    };

    return NextResponse.json({ success: true, briefing });
  } catch (error: any) {
    console.error("Error generating class preparation briefing:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to generate briefing" },
      { status: 500 }
    );
  }
}
