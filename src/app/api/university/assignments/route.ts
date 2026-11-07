import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { PRIORITIES, TASK_STATUSES, ValidationError, badRequest, httpUrl, idOf, must, num, oneOf, ownedId, readBody, str } from "@/lib/validate";
import { date as parseDate } from "@/lib/validate";

// GET /api/university/assignments - Fetch academic assignments
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const courseId = searchParams.get("courseId");
    const status = searchParams.get("status"); // "TODO", "DONE", "ALL"

    const where: any = {
      userId: user.id,
      isAcademic: true,
    };

    if (courseId && courseId !== "ALL") {
      where.courseId = courseId;
    }

    if (status && status !== "ALL") {
      where.status = status;
    }

    const assignments = await prisma.task.findMany({
      where,
      include: {
        course: {
          select: { id: true, code: true, name: true, color: true },
        },
        subtasks: true,
      },
      orderBy: [{ dueDate: "asc" }, { priority: "desc" }],
    });

    return NextResponse.json({ success: true, assignments });
  } catch (error: any) {
    if (error instanceof ValidationError) return badRequest(error.message);
    console.error("Error fetching assignments:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch assignments" },
      { status: 500 }
    );
  }
}

// POST /api/university/assignments - Create a new academic assignment
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
      description,
      dueDate,
      estimatedMinutes,
      priority,
      submissionUrl,
      subtasks, // Optional array of strings
    } = body;

    const cleanTitle = must(str(title, { max: 300, required: true }), "Assignment title is required (max 300 characters)");
    const cleanDescription = must(str(description, { max: 10000 }), "Description is too long");
    const cleanDue = must(parseDate(dueDate), "Due date is invalid");
    const cleanMinutes = must(num(estimatedMinutes, { min: 0, max: 100000, int: true }), "Estimated minutes is invalid") ?? 180;
    const cleanPriority = must(oneOf(priority, PRIORITIES), "Invalid priority") ?? "HIGH";
    const cleanUrl = must(httpUrl(submissionUrl), "Submission URL must start with http:// or https://");
    if (subtasks !== undefined && !Array.isArray(subtasks)) throw new ValidationError("Subtasks must be a list");

    let course = null;
    if (courseId) {
      course = await prisma.universityCourse.findFirst({
        where: { id: courseId, userId: user.id },
      });
      if (!course) {
        return NextResponse.json({ success: false, error: "Linked course not found" }, { status: 404 });
      }
    }

    const entity = await prisma.entity.create({
      data: {
        userId: user.id,
        type: "TASK",
        title: cleanTitle,
        content: cleanDescription,
        priority: cleanPriority,
        status: "ACTIVE",
      },
    });

    const task = await prisma.task.create({
      data: {
        userId: user.id,
        entityId: entity.id,
        courseId: course?.id || null,
        isAcademic: true,
        academicType: "ASSIGNMENT",
        title: cleanTitle,
        description: cleanDescription,
        dueDate: cleanDue,
        estimatedMinutes: cleanMinutes,
        priority: cleanPriority,
        submissionUrl: cleanUrl,
        status: "TODO",
        category: course ? course.code : "Academic",
      },
      include: {
        course: { select: { id: true, code: true, name: true, color: true } },
      },
    });

    // Create subtasks if provided (e.g. from decomposition)
    if (Array.isArray(subtasks) && subtasks.length > 0) {
      for (const st of subtasks.slice(0, 100)) {
        if (typeof st === "string" && st.trim() && st.trim().length <= 300) {
          await prisma.subtask.create({
            data: {
              taskId: task.id,
              title: st.trim(),
            },
          });
        }
      }
    }

    // Auto-create calendar reminder if dueDate exists
    if (dueDate) {
      await prisma.reminder.create({
        data: {
          userId: user.id,
          taskId: task.id,
          title: `Deadline: ${task.title}${course ? ` (${course.code})` : ""}`,
          dueAt: new Date(dueDate),
          escalationState: "UPCOMING",
        },
      }).catch(() => {});
    }

    const completeTask = await prisma.task.findUnique({
      where: { id: task.id },
      include: {
        course: { select: { id: true, code: true, name: true, color: true } },
        subtasks: true,
      },
    });

    return NextResponse.json({ success: true, assignment: completeTask });
  } catch (error: any) {
    if (error instanceof ValidationError) return badRequest(error.message);
    console.error("Error creating academic assignment:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create assignment" },
      { status: 500 }
    );
  }
}

// PATCH /api/university/assignments - Update an assignment
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
      description,
      status,
      dueDate,
      estimatedMinutes,
      actualMinutes,
      priority,
      courseId,
      submissionUrl,
    } = body;

    const assignmentId = must(idOf(id), "Assignment ID is required");
    const pTitle = title !== undefined ? must(str(title, { max: 300, required: true }), "Title is required (max 300 characters)") : undefined;
    const pDescription = description !== undefined ? must(str(description, { max: 10000 }), "Description is too long") : undefined;
    const pStatus = status !== undefined ? must(oneOf(status, TASK_STATUSES, { required: true }), "Invalid status") : undefined;
    const pDue = dueDate !== undefined ? must(parseDate(dueDate), "Due date is invalid") : undefined;
    const pEstimated = estimatedMinutes !== undefined ? must(num(estimatedMinutes, { min: 0, max: 100000, int: true, required: true }), "Estimated minutes is invalid") : undefined;
    const pActual = actualMinutes !== undefined ? must(num(actualMinutes, { min: 0, max: 100000, int: true, required: true }), "Actual minutes is invalid") : undefined;
    const pPriority = priority !== undefined ? must(oneOf(priority, PRIORITIES, { required: true }), "Invalid priority") : undefined;
    const pUrl = submissionUrl !== undefined ? must(httpUrl(submissionUrl), "Submission URL must start with http:// or https://") : undefined;
    let pCourseId: string | null | undefined;
    if (courseId !== undefined) {
      pCourseId = await ownedId("universityCourse", user.id, courseId);
      if (pCourseId === undefined) return NextResponse.json({ success: false, error: "Course not found" }, { status: 404 });
    }

    const existing = await prisma.task.findFirst({
      where: { id: assignmentId, userId: user.id, isAcademic: true },
    });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Assignment not found" }, { status: 404 });
    }

    const updated = await prisma.task.update({
      where: { id: assignmentId },
      data: {
        ...(pTitle !== undefined && { title: pTitle }),
        ...(pDescription !== undefined && { description: pDescription }),
        ...(pStatus !== undefined && { status: pStatus }),
        ...(pDue !== undefined && { dueDate: pDue }),
        ...(pEstimated !== undefined && { estimatedMinutes: pEstimated }),
        ...(pActual !== undefined && { actualMinutes: pActual }),
        ...(pPriority !== undefined && { priority: pPriority }),
        ...(pCourseId !== undefined && { courseId: pCourseId }),
        ...(pUrl !== undefined && { submissionUrl: pUrl }),
      },
      include: {
        course: { select: { id: true, code: true, name: true, color: true } },
        subtasks: true,
      },
    });

    return NextResponse.json({ success: true, assignment: updated });
  } catch (error: any) {
    if (error instanceof ValidationError) return badRequest(error.message);
    console.error("Error updating academic assignment:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update assignment" },
      { status: 500 }
    );
  }
}

// DELETE /api/university/assignments - Delete an assignment
export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, error: "Assignment ID is required" }, { status: 400 });
    }

    const existing = await prisma.task.findFirst({
      where: { id, userId: user.id, isAcademic: true },
    });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Assignment not found" }, { status: 404 });
    }

    await prisma.task.delete({ where: { id } });

    return NextResponse.json({ success: true, message: "Assignment deleted" });
  } catch (error: any) {
    if (error instanceof ValidationError) return badRequest(error.message);
    console.error("Error deleting assignment:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete assignment" },
      { status: 500 }
    );
  }
}
