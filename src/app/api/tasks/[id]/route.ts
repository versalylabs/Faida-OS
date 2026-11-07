import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { spawnNextRecurrence } from "@/lib/recurrence";
import { PRIORITIES, RECURRENCES, TASK_STATUSES, ValidationError, badRequest, date, must, notFound, num, oneOf, ownedId, readBody, str } from "@/lib/validate";

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
    if (error instanceof ValidationError) return badRequest(error.message);
    return NextResponse.json(
      { success: false, error: "Failed to fetch task" },
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

    const body = await readBody(req);
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
    const cleanStatus = status !== undefined ? must(oneOf(status, TASK_STATUSES, { required: true }), "Invalid status") : undefined;
    const cleanTitle = title !== undefined ? must(str(title, { max: 300, required: true }), "Title is required (max 300 characters)") : undefined;
    const cleanDescription = description !== undefined ? must(str(description, { max: 10000 }), "Description is too long") : undefined;
    const cleanPriority = priority !== undefined ? must(oneOf(priority, PRIORITIES, { required: true }), "Invalid priority") : undefined;
    if (cleanStatus !== undefined) dataToUpdate.status = cleanStatus;
    if (cleanTitle !== undefined) dataToUpdate.title = cleanTitle;
    if (cleanDescription !== undefined) dataToUpdate.description = cleanDescription;
    if (cleanPriority !== undefined) dataToUpdate.priority = cleanPriority;
    if (estimatedMinutes !== undefined) dataToUpdate.estimatedMinutes = must(num(estimatedMinutes, { min: 0, max: 100000, int: true, required: true }), "Estimated minutes is invalid");
    if (actualMinutes !== undefined) dataToUpdate.actualMinutes = must(num(actualMinutes, { min: 0, max: 100000, int: true, required: true }), "Actual minutes is invalid");
    if (dueDate !== undefined) dataToUpdate.dueDate = must(date(dueDate), "Due date is invalid");
    if (projectId !== undefined) {
      const ownedProjectId = await ownedId("project", user.id, projectId);
      if (ownedProjectId === undefined) return notFound("Project not found", noCacheHeaders);
      dataToUpdate.projectId = ownedProjectId;
    }
    if (category !== undefined) dataToUpdate.category = must(str(category, { max: 80 }), "Category is too long");
    if (recurrence !== undefined) dataToUpdate.recurrence = must(oneOf(recurrence, RECURRENCES), "Invalid recurrence");
    if (isAcademic !== undefined) dataToUpdate.isAcademic = Boolean(isAcademic);
    if (courseId !== undefined) {
      const ownedCourseId = await ownedId("universityCourse", user.id, courseId);
      if (ownedCourseId === undefined) return notFound("Course not found", noCacheHeaders);
      dataToUpdate.courseId = ownedCourseId;
    }
    if (subtasks !== undefined && !Array.isArray(subtasks)) throw new ValidationError("Subtasks must be a list");

    const task = await prisma.task.update({
      where: { id },
      data: dataToUpdate,
      include: {
        project: true,
        subtasks: { orderBy: { createdAt: "asc" } },
        course: true,
      },
    });

    // Recurring task finished: line up the next one
    if (cleanStatus === "DONE" && existing.status !== "DONE") {
      await spawnNextRecurrence(existing);
    }

    // If subtasks array is provided, sync subtasks / todos
    if (Array.isArray(subtasks)) {
      for (const item of subtasks.slice(0, 200)) {
        if (!item || typeof item !== "object") continue;
        const itemTitle = typeof item.title === "string" ? str(item.title, { max: 300 }) : null;
        if (itemTitle === undefined) continue;
        if (typeof item.id === "string" && item.id && !item.id.startsWith("temp_") && !item.id.startsWith("new_")) {
          // Scoped to this task so another user's subtask id can never be touched.
          if (item._deleted) {
            await prisma.subtask.deleteMany({ where: { id: item.id, taskId: id } }).catch(() => {});
          } else {
            await prisma.subtask.updateMany({
              where: { id: item.id, taskId: id },
              data: {
                title: itemTitle || undefined,
                isDone: item.isDone !== undefined ? Boolean(item.isDone) : undefined,
              },
            }).catch(() => {});
          }
        } else if (!item._deleted && itemTitle) {
          await prisma.subtask.create({
            data: {
              taskId: id,
              title: itemTitle,
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
          title: cleanTitle,
          content: cleanDescription,
          priority: cleanPriority,
          status: cleanStatus ? (cleanStatus === "DONE" ? "COMPLETED" : "ACTIVE") : undefined,
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
    if (error instanceof ValidationError) return badRequest(error.message);
    console.error("Error updating task:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update task" },
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
    if (error instanceof ValidationError) return badRequest(error.message);
    console.error("Error deleting task:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete task" },
      { status: 500, headers: noCacheHeaders }
    );
  }
}
