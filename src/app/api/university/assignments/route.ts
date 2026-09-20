import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

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
    console.error("Error fetching assignments:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch assignments" },
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

    const body = await req.json();
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

    if (!title || !title.trim()) {
      return NextResponse.json({ success: false, error: "Assignment title is required" }, { status: 400 });
    }

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
        title: title.trim(),
        content: description || null,
        priority: priority || "HIGH",
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
        title: title.trim(),
        description: description || null,
        dueDate: dueDate ? new Date(dueDate) : null,
        estimatedMinutes: estimatedMinutes ? parseInt(estimatedMinutes, 10) : 180,
        priority: priority || "HIGH",
        submissionUrl: submissionUrl || null,
        status: "TODO",
        category: course ? course.code : "Academic",
      },
      include: {
        course: { select: { id: true, code: true, name: true, color: true } },
      },
    });

    // Create subtasks if provided (e.g. from decomposition)
    if (Array.isArray(subtasks) && subtasks.length > 0) {
      for (const st of subtasks) {
        if (typeof st === "string" && st.trim()) {
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
    console.error("Error creating academic assignment:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create assignment" },
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

    const body = await req.json();
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

    if (!id) {
      return NextResponse.json({ success: false, error: "Assignment ID is required" }, { status: 400 });
    }

    const existing = await prisma.task.findFirst({
      where: { id, userId: user.id, isAcademic: true },
    });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Assignment not found" }, { status: 404 });
    }

    const updated = await prisma.task.update({
      where: { id },
      data: {
        ...(title !== undefined && { title: title.trim() }),
        ...(description !== undefined && { description }),
        ...(status !== undefined && { status }),
        ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
        ...(estimatedMinutes !== undefined && { estimatedMinutes: parseInt(estimatedMinutes, 10) }),
        ...(actualMinutes !== undefined && { actualMinutes: parseInt(actualMinutes, 10) }),
        ...(priority !== undefined && { priority }),
        ...(courseId !== undefined && { courseId: courseId || null }),
        ...(submissionUrl !== undefined && { submissionUrl }),
      },
      include: {
        course: { select: { id: true, code: true, name: true, color: true } },
        subtasks: true,
      },
    });

    return NextResponse.json({ success: true, assignment: updated });
  } catch (error: any) {
    console.error("Error updating academic assignment:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update assignment" },
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
    console.error("Error deleting assignment:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to delete assignment" },
      { status: 500 }
    );
  }
}
