import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { spawnNextRecurrence } from "@/lib/recurrence";
import { touchProject } from "@/lib/projectActivity";
import { readBody, ValidationError, badRequest } from "@/lib/validate";

export const dynamic = "force-dynamic";

const HOUR = 3600000;
const DAY = 24 * HOUR;
const NO_STORE = { "Cache-Control": "private, no-store" };

/**
 * POST /api/notify/action  { ref: "TASK:<id>" | "REMINDER:<id>" | "DELIVERABLE:<id>", action: "done" | "snooze" | "tomorrow" }
 *
 * Called by the service worker when a notification button is tapped, so a reminder can be handled
 * without opening the app. Every change is limited to the signed-in user's own records.
 *   done      finish it (a repeating task lines up its next one)
 *   snooze    remind again in an hour (a reminder moves; a task or client work gets a one-off reminder)
 *   tomorrow  move the due date one day later
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401, headers: NO_STORE });

    const body = await readBody(req);
    const ref = typeof body.ref === "string" ? body.ref : "";
    const action = typeof body.action === "string" ? body.action : "";
    // A planned block ("PLAN:<taskId>:<start>") acts on its task.
    const [rawSource, id] = ref.split(":");
    const source = rawSource === "PLAN" ? "TASK" : rawSource;
    if (!id || !["done", "snooze", "tomorrow", "confirm"].includes(action)) return badRequest("Unknown notification action");

    // The evening M-Pesa check: "All correct" marks everything logged so far as checked.
    if (source === "REVIEW" && action === "confirm") {
      const r = await prisma.financeTransaction.updateMany({ where: { userId: user.id, needsReview: true, createdAt: { lte: new Date() } }, data: { needsReview: false } });
      return NextResponse.json({ success: true, message: `${r.count} M-Pesa transactions checked` }, { headers: NO_STORE });
    }

    const now = new Date();
    let message = "";

    if (source === "TASK") {
      const task = await prisma.task.findFirst({ where: { id, userId: user.id } });
      if (!task) return NextResponse.json({ success: false, error: "Task not found" }, { status: 404, headers: NO_STORE });
      if (action === "done") {
        if (task.status !== "DONE") {
          await prisma.task.update({ where: { id }, data: { status: "DONE" } });
          await spawnNextRecurrence(task);
          await touchProject(task.projectId);
          if (task.entityId) await prisma.entity.update({ where: { id: task.entityId }, data: { status: "COMPLETED" } }).catch(() => {});
        }
        message = `Done: ${task.title}`;
      } else if (action === "tomorrow") {
        const due = task.dueDate ? new Date(task.dueDate.getTime() + DAY) : new Date(now.getTime() + DAY);
        await prisma.task.update({ where: { id }, data: { dueDate: due } });
        // Logged like the planner's "Move to tomorrow", so today's plan drops it too.
        await prisma.effortEvent.create({ data: { userId: user.id, type: "DEFER", taskId: id, minutes: task.estimatedMinutes || 0 } });
        message = `Moved to tomorrow: ${task.title}`;
      } else {
        await prisma.reminder.create({ data: { userId: user.id, taskId: id, title: task.title, dueAt: new Date(now.getTime() + HOUR) } });
        message = `Snoozed for an hour: ${task.title}`;
      }
    } else if (source === "REMINDER") {
      const reminder = await prisma.reminder.findFirst({ where: { id, userId: user.id } });
      if (!reminder) return NextResponse.json({ success: false, error: "Reminder not found" }, { status: 404, headers: NO_STORE });
      if (action === "done") {
        await prisma.reminder.update({ where: { id }, data: { isCompleted: true } });
        // A snoozed task comes back as a reminder for it: "Done" then finishes the task too.
        if (reminder.taskId) {
          const task = await prisma.task.findFirst({ where: { id: reminder.taskId, userId: user.id } });
          if (task && task.status !== "DONE") {
            await prisma.task.update({ where: { id: task.id }, data: { status: "DONE" } });
            await spawnNextRecurrence(task);
            await touchProject(task.projectId);
          }
        }
        message = `Done: ${reminder.title}`;
      } else {
        const dueAt = action === "snooze" ? new Date(now.getTime() + HOUR) : new Date(Math.max(reminder.dueAt.getTime(), now.getTime()) + DAY);
        await prisma.reminder.update({ where: { id }, data: { dueAt, isCompleted: false } });
        message = action === "snooze" ? `Snoozed for an hour: ${reminder.title}` : `Moved to tomorrow: ${reminder.title}`;
      }
    } else if (source === "DELIVERABLE") {
      const work = await prisma.businessDeliverable.findFirst({ where: { id, userId: user.id } });
      if (!work) return NextResponse.json({ success: false, error: "Deliverable not found" }, { status: 404, headers: NO_STORE });
      if (action === "done") {
        await prisma.businessDeliverable.update({ where: { id }, data: { status: "COMPLETED", completedAt: now } });
        message = `Delivered: ${work.title}`;
      } else if (action === "tomorrow") {
        const due = work.dueDate ? new Date(work.dueDate.getTime() + DAY) : new Date(now.getTime() + DAY);
        await prisma.businessDeliverable.update({ where: { id }, data: { dueDate: due } });
        message = `Moved to tomorrow: ${work.title}`;
      } else {
        await prisma.reminder.create({ data: { userId: user.id, title: work.title, dueAt: new Date(now.getTime() + HOUR) } });
        message = `Snoozed for an hour: ${work.title}`;
      }
    } else {
      return badRequest("This notification has no actions");
    }

    return NextResponse.json({ success: true, message }, { headers: NO_STORE });
  } catch (error) {
    if (error instanceof ValidationError) return badRequest(error.message);
    console.error("Notification action failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ success: false, error: "Could not apply that action" }, { status: 500, headers: NO_STORE });
  }
}
