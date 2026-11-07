import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ValidationError, badRequest, idOf, must, num, ownedId, readBody, str } from "@/lib/validate";
import { date as parseDate } from "@/lib/validate";

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
    if (error instanceof ValidationError) return badRequest(error.message);
    console.error("Error fetching academic assessments:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch assessments" },
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

    const body = await readBody(req);
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

    const cleanTitle = must(str(title, { max: 300, required: true }), "Title is required (max 300 characters)");
    const assessmentDate = must(parseDate(date, { required: true }), "A valid assessment date is required");
    const cleanType = must(str(type, { max: 40 }), "Invalid type") ?? "CAT";
    const duration = must(num(durationMinutes, { min: 1, max: 1440, int: true }), "Duration must be between 1 and 1440 minutes") ?? 60;
    const cleanWeight = must(num(weightPercent, { min: 0, max: 100 }), "Weight must be between 0 and 100");
    const cleanTopics = must(str(topicsCovered, { max: 5000 }), "Topics are too long");
    const cleanEffort = must(num(estimatedEffortHours, { min: 0, max: 1000 }), "Estimated effort is invalid") ?? 4.0;
    const linkedCourseId = must(idOf(courseId), "Course is required");

    const course = await prisma.universityCourse.findFirst({
      where: { id: courseId, userId: user.id },
    });
    if (!course) {
      return NextResponse.json({ success: false, error: "Course not found" }, { status: 404 });
    }

    const endDate = new Date(assessmentDate.getTime() + duration * 60 * 1000);

    const assessment = await prisma.academicAssessment.create({
      data: {
        userId: user.id,
        courseId: linkedCourseId,
        title: cleanTitle,
        type: cleanType,
        date: assessmentDate,
        durationMinutes: duration,
        weightPercent: cleanWeight,
        topicsCovered: cleanTopics,
        estimatedEffortHours: cleanEffort,
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
    if (error instanceof ValidationError) return badRequest(error.message);
    console.error("Error creating academic assessment:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create assessment" },
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

    const body = await readBody(req);
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

    const assessmentId = must(idOf(id), "Assessment ID is required");
    const pTitle = title !== undefined ? must(str(title, { max: 300, required: true }), "Title is required (max 300 characters)") : undefined;
    const pType = type !== undefined ? must(str(type, { max: 40, required: true }), "Invalid type") : undefined;
    const pDate = date !== undefined ? must(parseDate(date, { required: true }), "Assessment date is invalid") : undefined;
    const pDuration = durationMinutes !== undefined ? must(num(durationMinutes, { min: 1, max: 1440, int: true, required: true }), "Duration must be between 1 and 1440 minutes") : undefined;
    const pWeight = weightPercent !== undefined ? must(num(weightPercent, { min: 0, max: 100 }), "Weight must be between 0 and 100") : undefined;
    const pTopics = topicsCovered !== undefined ? must(str(topicsCovered, { max: 5000 }), "Topics are too long") : undefined;
    const pEffort = estimatedEffortHours !== undefined ? must(num(estimatedEffortHours, { min: 0, max: 1000, required: true }), "Estimated effort is invalid") : undefined;
    const pPlan = studyPlan !== undefined ? (typeof studyPlan === "string" ? studyPlan : JSON.stringify(studyPlan)) : undefined;
    if (pPlan !== undefined && pPlan.length > 100000) throw new ValidationError("Study plan is too large");
    const pGrade = grade !== undefined ? must(str(grade, { max: 40 }), "Grade is invalid") : undefined;
    if (isCompleted !== undefined && typeof isCompleted !== "boolean") throw new ValidationError("isCompleted must be true or false");

    const existing = await prisma.academicAssessment.findFirst({
      where: { id: assessmentId, userId: user.id },
    });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Assessment not found" }, { status: 404 });
    }

    const updated = await prisma.academicAssessment.update({
      where: { id: assessmentId },
      data: {
        ...(pTitle !== undefined && { title: pTitle }),
        ...(pType !== undefined && { type: pType }),
        ...(pDate !== undefined && { date: pDate }),
        ...(pDuration !== undefined && { durationMinutes: pDuration }),
        ...(pWeight !== undefined && { weightPercent: pWeight }),
        ...(pTopics !== undefined && { topicsCovered: pTopics }),
        ...(pEffort !== undefined && { estimatedEffortHours: pEffort }),
        ...(pPlan !== undefined && { studyPlan: pPlan }),
        ...(isCompleted !== undefined && { isCompleted }),
        ...(pGrade !== undefined && { grade: pGrade }),
      },
      include: {
        course: { select: { id: true, code: true, name: true, color: true } },
      },
    });

    return NextResponse.json({ success: true, assessment: updated });
  } catch (error: any) {
    if (error instanceof ValidationError) return badRequest(error.message);
    console.error("Error updating academic assessment:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update assessment" },
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
    if (error instanceof ValidationError) return badRequest(error.message);
    console.error("Error deleting assessment:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete assessment" },
      { status: 500 }
    );
  }
}
