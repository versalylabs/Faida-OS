import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const noCacheHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401, headers: noCacheHeaders });
    }

    const { id } = await params;
    const task = await prisma.task.findFirst({
      where: { id, userId: user.id },
      include: {
        project: true,
        subtasks: { orderBy: { createdAt: "asc" } },
        course: true,
      },
    });

    if (!task) {
      return NextResponse.json({ success: false, error: "Task not found" }, { status: 404, headers: noCacheHeaders });
    }

    return NextResponse.json({ success: true, task }, { headers: noCacheHeaders });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch task" },
      { status: 500, headers: noCacheHeaders }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleUpdate(req, params);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleUpdate(req, params);
}

async function handleUpdate(
  req: NextRequest,
  paramsPromise: Promise<{ id: string }>
) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401, headers: noCacheHeaders });
    }

    const { id } = await paramsPromise;
    const existing = await prisma.task.findFirst({
      where: { id, userId: user.id },
      include: { subtasks: true },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: "Task not found" }, { status: 404, headers: noCacheHeaders });
    }

    const body = await req.json();
    const {
      status,
      title,
      description,
      priority,
      estimatedMinutes,
      actualMinutes,
      dueDate,
      projectId,
      category,
      recurrence,
      isAcademic,
      courseId,
      subtasks,
    } = body;

    const dataToUpdate: any = {};
    if (status !== undefined) dataToUpdate.status = status;
    if (title !== undefined) dataToUpdate.title = title.trim();
    if (description !== undefined) dataToUpdate.description = description ? description.trim() : null;
    if (priority !== undefined) dataToUpdate.priority = priority;
    if (estimatedMinutes !== undefined) dataToUpdate.estimatedMinutes = Number(estimatedMinutes);
    if (actualMinutes !== undefined) dataToUpdate.actualMinutes = Number(actualMinutes);
    if (dueDate !== undefined) dataToUpdate.dueDate = dueDate ? new Date(dueDate) : null;
    if (projectId !== undefined) dataToUpdate.projectId = projectId ? projectId : null;
    if (category !== undefined) dataToUpdate.category = category ? category.trim() : null;
    if (recurrence !== undefined) dataToUpdate.recurrence = recurrence ? recurrence : null;
    if (isAcademic !== undefined) dataToUpdate.isAcademic = Boolean(isAcademic);
    if (courseId !== undefined) dataToUpdate.courseId = courseId;

    const task = await prisma.task.update({
      where: { id },
      data: dataToUpdate,
      include: {
        project: true,
        subtasks: { orderBy: { createdAt: "asc" } },
        course: true,
      },
    });

    // If subtasks array is provided, sync subtasks / todos
    if (Array.isArray(subtasks)) {
      for (const item of subtasks) {
        if (item.id && !item.id.startsWith("temp_") && !item.id.startsWith("new_")) {
          if (item._deleted) {
            await prisma.subtask.delete({ where: { id: item.id } }).catch(() => {});
          } else {
            await prisma.subtask.update({
              where: { id: item.id },
              data: {
                title: item.title ? item.title.trim() : undefined,
                isDone: item.isDone !== undefined ? Boolean(item.isDone) : undefined,
              },
            }).catch(() => {});
          }
        } else if (!item._deleted && item.title && item.title.trim()) {
          await prisma.subtask.create({
            data: {
              taskId: id,
              title: item.title.trim(),
              isDone: Boolean(item.isDone),
            },
          }).catch(() => {});
        }
      }
    }

    if (task.entityId && (status || title || description || priority)) {
      await prisma.entity.update({
        where: { id: task.entityId },
        data: {
          title: title !== undefined ? title.trim() : undefined,
          content: description !== undefined ? (description ? description.trim() : null) : undefined,
          priority: priority !== undefined ? priority : undefined,
          status: status ? (status === "DONE" ? "COMPLETED" : "ACTIVE") : undefined,
        },
      }).catch(() => {});
    }

    // Re-fetch fresh task with updated subtasks
    const freshTask = await prisma.task.findFirst({
      where: { id, userId: user.id },
      include: {
        project: true,
        subtasks: { orderBy: { createdAt: "asc" } },
        course: true,
      },
    });

    return NextResponse.json({ success: true, task: freshTask || task }, { headers: noCacheHeaders });
  } catch (error: any) {
    console.error("Error updating task:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update task" },
      { status: 500, headers: noCacheHeaders }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401, headers: noCacheHeaders });
    }

    const { id } = await params;
    const existing = await prisma.task.findFirst({
      where: { id, userId: user.id },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: "Task not found" }, { status: 404, headers: noCacheHeaders });
    }

    // Delete subtasks first to satisfy foreign keys cleanly
    await prisma.subtask.deleteMany({ where: { taskId: id } }).catch(() => {});
    await prisma.reminder.deleteMany({ where: { taskId: id } }).catch(() => {});
    await prisma.calendarEvent.deleteMany({ where: { taskId: id } }).catch(() => {});

    const task = await prisma.task.delete({
      where: { id },
    });

    if (task.entityId) {
      await prisma.entity.delete({ where: { id: task.entityId } }).catch(() => {});
    }

    return NextResponse.json({ success: true, message: "Task deleted successfully" }, { headers: noCacheHeaders });
  } catch (error: any) {
    console.error("Error deleting task:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to delete task" },
      { status: 500, headers: noCacheHeaders }
    );
  }
}
