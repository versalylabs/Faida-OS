import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// GET /api/university/assessments - Fetch CATs, Exams, Quizzes
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const courseId = searchParams.get("courseId");

    const where: any = { userId: user.id };
    if (courseId && courseId !== "ALL") where.courseId = courseId;

    const assessments = await prisma.academicAssessment.findMany({
      where,
      include: {
        course: { select: { id: true, code: true, name: true, color: true } },
      },
      orderBy: { date: "asc" },
    });

    return NextResponse.json({ success: true, assessments });
  } catch (error: any) {
    console.error("Error fetching academic assessments:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch assessments" },
      { status: 500 }
    );
  }
}

// POST /api/university/assessments - Schedule a new CAT, Exam, Quiz
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      courseId,
      title,
      type,
      date,
      durationMinutes,
      weightPercent,
      topicsCovered,
      estimatedEffortHours,
    } = body;

    if (!courseId || !title || !date) {
      return NextResponse.json(
        { success: false, error: "Course, title, and assessment date are required" },
        { status: 400 }
      );
    }

    const course = await prisma.universityCourse.findFirst({
      where: { id: courseId, userId: user.id },
    });
    if (!course) {
      return NextResponse.json({ success: false, error: "Course not found" }, { status: 404 });
    }

    const assessmentDate = new Date(date);
    const duration = parseInt(durationMinutes, 10) || 60;
    const endDate = new Date(assessmentDate.getTime() + duration * 60 * 1000);

    const assessment = await prisma.academicAssessment.create({
      data: {
        userId: user.id,
        courseId,
        title: title.trim(),
        type: type || "CAT",
        date: assessmentDate,
        durationMinutes: duration,
        weightPercent: weightPercent ? parseFloat(weightPercent) : null,
        topicsCovered: topicsCovered?.trim() || null,
        estimatedEffortHours: estimatedEffortHours ? parseFloat(estimatedEffortHours) : 4.0,
      },
      include: {
        course: { select: { id: true, code: true, name: true, color: true } },
      },
    });

    // Auto-create Calendar Event in Faida's calendar
    await prisma.calendarEvent.create({
      data: {
        userId: user.id,
        assessmentId: assessment.id,
        title: `🎓 ${course.code}: ${assessment.title}`,
        description: `Topics: ${assessment.topicsCovered || "Course syllabus"}. Weight: ${assessment.weightPercent || 0}%`,
        startTime: assessmentDate,
        endTime: endDate,
        location: "Exam Hall / Online",
      },
    }).catch(() => {});

    return NextResponse.json({ success: true, assessment });
  } catch (error: any) {
    console.error("Error creating academic assessment:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create assessment" },
      { status: 500 }
    );
  }
}

// PATCH /api/university/assessments - Edit assessment or update study plan
export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      id,
      title,
      type,
      date,
      durationMinutes,
      weightPercent,
      topicsCovered,
      estimatedEffortHours,
      studyPlan,
      isCompleted,
      grade,
    } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: "Assessment ID is required" }, { status: 400 });
    }

    const existing = await prisma.academicAssessment.findFirst({
      where: { id, userId: user.id },
    });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Assessment not found" }, { status: 404 });
    }

    const updated = await prisma.academicAssessment.update({
      where: { id },
      data: {
        ...(title !== undefined && { title: title.trim() }),
        ...(type !== undefined && { type }),
        ...(date !== undefined && { date: new Date(date) }),
        ...(durationMinutes !== undefined && { durationMinutes: parseInt(durationMinutes, 10) }),
        ...(weightPercent !== undefined && { weightPercent: parseFloat(weightPercent) }),
        ...(topicsCovered !== undefined && { topicsCovered }),
        ...(estimatedEffortHours !== undefined && { estimatedEffortHours: parseFloat(estimatedEffortHours) }),
        ...(studyPlan !== undefined && { studyPlan: typeof studyPlan === "string" ? studyPlan : JSON.stringify(studyPlan) }),
        ...(isCompleted !== undefined && { isCompleted }),
        ...(grade !== undefined && { grade }),
      },
      include: {
        course: { select: { id: true, code: true, name: true, color: true } },
      },
    });

    return NextResponse.json({ success: true, assessment: updated });
  } catch (error: any) {
    console.error("Error updating academic assessment:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update assessment" },
      { status: 500 }
    );
  }
}

// DELETE /api/university/assessments - Delete assessment
export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, error: "Assessment ID is required" }, { status: 400 });
    }

    const existing = await prisma.academicAssessment.findFirst({
      where: { id, userId: user.id },
    });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Assessment not found" }, { status: 404 });
    }

    await prisma.academicAssessment.delete({ where: { id } });

    return NextResponse.json({ success: true, message: "Assessment deleted" });
  } catch (error: any) {
    console.error("Error deleting assessment:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to delete assessment" },
      { status: 500 }
    );
  }
}
