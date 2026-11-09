import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { byPriorityThenNewest } from "@/lib/priority";
import { purgeOldCompleted } from "@/lib/cleanup";
import { touchProject } from "@/lib/projectActivity";
import { PRIORITIES, RECURRENCES, ValidationError, badRequest, date, must, notFound, num, oneOf, ownedId, readBody, str } from "@/lib/validate";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const noCacheHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401, headers: noCacheHeaders });
    }

    // Housekeeping: finished tasks are cleared 48 hours after they were completed
    await purgeOldCompleted(user.id);

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
        subtasks: {
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: [
        { status: "asc" },
        { createdAt: "desc" },
      ],
    });
    // Priority is ranked here, not in SQL (alphabetical order would put HIGH last)
    tasks.sort((a, b) => a.status.localeCompare(b.status) || byPriorityThenNewest(a, b));

    return NextResponse.json({ success: true, tasks }, { headers: noCacheHeaders });
  } catch (error: any) {
    if (error instanceof ValidationError) return badRequest(error.message);
    console.error("Error fetching tasks:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch tasks" },
      { status: 500, headers: noCacheHeaders }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await readBody(req);
    const { title, description, priority, estimatedMinutes, dueDate, projectId, category, subtasks, recurrence } = body;

    const cleanTitle = must(str(title, { max: 300, required: true }), "Task title is required (max 300 characters)");
    const cleanDescription = must(str(description, { max: 10000 }), "Description is too long");
    const cleanPriority = must(oneOf(priority, PRIORITIES), "Invalid priority") ?? "MEDIUM";
    const minutes = must(num(estimatedMinutes, { min: 0, max: 100000, int: true }), "Estimated minutes must be a whole number between 0 and 100000") ?? 30;
    const cleanDue = must(date(dueDate), "Due date is invalid");
    const cleanCategory = must(str(category, { max: 80 }), "Category is too long") ?? "Execution";
    const cleanRecurrence = must(oneOf(recurrence, RECURRENCES), "Invalid repeat option");
    const ownedProjectId = await ownedId("project", user.id, projectId);
    if (ownedProjectId === undefined) return notFound("Project not found");
    const cleanSubtasks: { title: string; isDone: boolean }[] = [];
    if (subtasks !== undefined && !Array.isArray(subtasks)) throw new ValidationError("Subtasks must be a list");
    for (const sub of (subtasks ?? []).slice(0, 100)) {
      const t = str(typeof sub === "string" ? sub : sub?.title, { max: 300 });
      if (t === undefined) throw new ValidationError("Subtask title is invalid (max 300 characters)");
      if (t) cleanSubtasks.push({ title: t, isDone: typeof sub === "object" ? Boolean(sub.isDone) : false });
    }

    // 1. Create unified Entity
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

    // 2. Create Task record
    const task = await prisma.task.create({
      data: {
        userId: user.id,
        entityId: entity.id,
        title: cleanTitle,
        description: cleanDescription,
        priority: cleanPriority,
        status: "TODO",
        estimatedMinutes: minutes,
        dueDate: cleanDue,
        projectId: ownedProjectId,
        category: cleanCategory,
        recurrence: cleanRecurrence,
        subtasks: cleanSubtasks.length > 0 ? { create: cleanSubtasks } : undefined,
      },
      include: {
        project: true,
        subtasks: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    await touchProject(task.projectId);

    // 3. Log activity
    await prisma.activityLog.create({
      data: {
        entityId: entity.id,
        action: "CREATED",
        details: `Created task: ${task.title}`,
      },
    });

    return NextResponse.json({ success: true, task }, { headers: noCacheHeaders });
  } catch (error: any) {
    if (error instanceof ValidationError) return badRequest(error.message);
    console.error("Error creating task:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create task" },
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

    const body = await readBody(req);
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

    if (status === "DONE") await touchProject(task.projectId);

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
    if (error instanceof ValidationError) return badRequest(error.message);
    console.error("Error updating task:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update task" },
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

    // Delete related subtasks, reminders, calendarEvents first to prevent FK constraint errors
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
