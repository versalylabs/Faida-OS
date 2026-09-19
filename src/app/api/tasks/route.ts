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
    const status = searchParams.get("status");
    const projectId = searchParams.get("projectId");

    const where: any = { userId: user.id };
    if (status && status !== "ALL") {
      where.status = status;
    }
    if (projectId) {
      where.projectId = projectId;
    }

    const tasks = await prisma.task.findMany({
      where,
      include: {
        project: true,
        subtasks: true,
      },
      orderBy: [
        { status: "asc" },
        { priority: "desc" },
        { createdAt: "desc" },
      ],
    });

    return NextResponse.json({ success: true, tasks });
  } catch (error: any) {
    console.error("Error fetching tasks:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch tasks" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { title, description, priority, estimatedMinutes, dueDate, projectId, category } = body;

    if (!title || typeof title !== "string" || !title.trim()) {
      return NextResponse.json({ success: false, error: "Task title is required" }, { status: 400 });
    }

    // 1. Create unified Entity
    const entity = await prisma.entity.create({
      data: {
        userId: user.id,
        type: "TASK",
        title: title.trim(),
        content: description,
        priority: priority || "MEDIUM",
        status: "ACTIVE",
      },
    });

    // 2. Create Task record
    const task = await prisma.task.create({
      data: {
        userId: user.id,
        entityId: entity.id,
        title: title.trim(),
        description,
        priority: priority || "MEDIUM",
        status: "TODO",
        estimatedMinutes: estimatedMinutes ? parseInt(estimatedMinutes, 10) : 30,
        dueDate: dueDate ? new Date(dueDate) : null,
        projectId: projectId || null,
        category: category || "Execution",
      },
      include: {
        project: true,
      },
    });

    // 3. Log activity
    await prisma.activityLog.create({
      data: {
        entityId: entity.id,
        action: "CREATED",
        details: `Created task: ${task.title}`,
      },
    });

    return NextResponse.json({ success: true, task });
  } catch (error: any) {
    console.error("Error creating task:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create task" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { id, status, actualMinutes, priority, title } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: "Task id is required" }, { status: 400 });
    }

    // Verify task belongs to user
    const existing = await prisma.task.findFirst({
      where: { id, userId: user.id },
    });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Task not found" }, { status: 404 });
    }

    const dataToUpdate: any = {};
    if (status !== undefined) dataToUpdate.status = status;
    if (actualMinutes !== undefined) dataToUpdate.actualMinutes = actualMinutes;
    if (priority !== undefined) dataToUpdate.priority = priority;
    if (title !== undefined) dataToUpdate.title = title;

    const task = await prisma.task.update({
      where: { id },
      data: dataToUpdate,
      include: { project: true },
    });

    // Sync status to Entity if linked
    if (task.entityId && status) {
      await prisma.entity.update({
        where: { id: task.entityId },
        data: {
          status: status === "DONE" ? "COMPLETED" : "ACTIVE",
        },
      });
    }

    // Log completion
    if (status === "DONE") {
      await prisma.activityLog.create({
        data: {
          entityId: task.entityId,
          action: "COMPLETED",
          details: `Completed task: ${task.title}`,
        },
      });
    }

    return NextResponse.json({ success: true, task });
  } catch (error: any) {
    console.error("Error updating task:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update task" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, error: "Task id is required" }, { status: 400 });
    }

    // Verify task belongs to user
    const existing = await prisma.task.findFirst({
      where: { id, userId: user.id },
    });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Task not found" }, { status: 404 });
    }

    const task = await prisma.task.delete({
      where: { id },
    });

    if (task.entityId) {
      await prisma.entity.delete({ where: { id: task.entityId } }).catch(() => {});
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting task:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to delete task" },
      { status: 500 }
    );
  }
}
