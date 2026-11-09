import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ValidationError, badRequest, readBody, safeInt, must, idOf, num, notFound } from "@/lib/validate";
import { byPriorityThenNewest } from "@/lib/priority";
import { zonedNow } from "@/lib/tz";
import { touchProject } from "@/lib/projectActivity";
import { spawnNextRecurrence } from "@/lib/recurrence";
import { estimateEnergy, evaluateTasks, pickLowEnergyBatch, type RawEffortTask } from "@/lib/effort";

export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "no-store" };

/** Average energy you reported for each hour of the day over the last three weeks (needs 2+ check-ins). */
async function learnedEnergyByHour(userId: string): Promise<Record<number, number>> {
  const since = new Date(Date.now() - 21 * 86400000);
  const rows = await prisma.energyCheckin.findMany({
    where: { userId, createdAt: { gte: since } },
    select: { hour: true, level: true },
  });
  const sums: Record<number, { total: number; n: number }> = {};
  for (const r of rows) {
    sums[r.hour] = sums[r.hour] || { total: 0, n: 0 };
    sums[r.hour].total += r.level;
    sums[r.hour].n += 1;
  }
  const out: Record<number, number> = {};
  for (const [h, v] of Object.entries(sums)) if (v.n >= 2) out[Number(h)] = Math.round(v.total / v.n);
  return out;
}

/** Real totals from what Lazy Mode actually did for you, this week and overall. */
async function effortSavedSummary(userId: string, weekStart: Date) {
  const events = await prisma.effortEvent.findMany({
    where: { userId },
    select: { type: true, minutes: true, createdAt: true },
  });
  const blank = () => ({ deferred: 0, dropped: 0, batches: 0, sprints: 0, minutesFreed: 0 });
  const week = blank();
  const total = blank();
  for (const e of events) {
    for (const bucket of e.createdAt >= weekStart ? [week, total] : [total]) {
      if (e.type === "DEFER") bucket.deferred++;
      else if (e.type === "DROP") bucket.dropped++;
      else if (e.type === "BATCH") bucket.batches++;
      else if (e.type === "SPRINT") bucket.sprints++;
      if (e.type === "DEFER" || e.type === "DROP") bucket.minutesFreed += e.minutes;
    }
  }
  return { week, total };
}

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401, headers: noStore });
    }

    const { searchParams } = new URL(req.url);
    const local = zonedNow();
    const hourParam = safeInt(searchParams.get("hour"), -1, -1, 23);
    const hour = hourParam >= 0 ? hourParam : local.hour;

    const [dbTasks, learned, effortSaved] = await Promise.all([
      prisma.task.findMany({
        where: { userId: user.id, status: { notIn: ["DONE", "ARCHIVED"] } },
        include: { project: true, course: true },
        orderBy: { createdAt: "desc" },
      }),
      learnedEnergyByHour(user.id),
      effortSavedSummary(user.id, new Date(local.startOfDay.getTime() - ((local.dayOfWeek + 6) % 7) * 86400000)),
    ]);
    dbTasks.sort(byPriorityThenNewest);

    const suggestedEnergy = learned[hour] ?? estimateEnergy(hour);
    const energyParam = searchParams.get("energy");
    const currentEnergy = energyParam ? safeInt(energyParam, suggestedEnergy, 0, 100) : suggestedEnergy;
    const isLazyMode = searchParams.get("lazy") === "true" || currentEnergy <= 30;

    const rawTasks: RawEffortTask[] = dbTasks.map((t) => ({
      id: t.id,
      title: t.title,
      projectName: t.course ? `${t.course.code}` : t.project?.name,
      estimatedMinutes: t.estimatedMinutes || 30,
      priority: t.priority,
      isAcademic: Boolean(t.isAcademic),
      dueDate: t.dueDate ? t.dueDate.toISOString() : null,
    }));

    const tasks = evaluateTasks(rawTasks, currentEnergy, isLazyMode, local.endOfDay.getTime());

    return NextResponse.json(
      {
        success: true,
        currentEnergy,
        suggestedEnergy,
        learnedEnergyByHour: learned,
        isLazyMode,
        tasks,
        rawTasks,
        endOfDay: local.endOfDay.toISOString(),
        lowEnergyBatch: pickLowEnergyBatch(tasks),
        effortSaved,
      },
      { headers: noStore }
    );
  } catch (error: any) {
    if (error instanceof ValidationError) return badRequest(error.message);
    console.error("Error in effort engine:", error);
    return NextResponse.json({ success: false, error: "Effort engine failure" }, { status: 500, headers: noStore });
  }
}

/**
 * Actions that make Lazy Mode actually do something:
 *  CHECKIN  { level }                 remember how much energy you have (teaches it your daily curve)
 *  DEFER    { taskId, days? }         push a task out (default: tomorrow morning) and log the time kept free
 *  DROP     { taskId }                archive a task you will never do, and log it
 *  COMPLETE { taskId, kind? }         mark done; kind "BATCH" or "SPRINT" is counted as effort saved
 *  SPRINT   { taskId }                a 15-minute sprint was finished on a heavy task (task stays open)
 *  RESTORE  { taskId, status, dueDate, eventId? }  undo a defer or drop
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401, headers: noStore });
    }

    const body = await readBody(req);
    const action = body.action;

    if (action === "CHECKIN") {
      const level = must(num(body.level, { min: 0, max: 100, int: true, required: true }), "level must be 0 to 100");
      const hour = body.hour !== undefined ? must(num(body.hour, { min: 0, max: 23, int: true, required: true }), "hour must be 0 to 23") : zonedNow().hour;
      await prisma.energyCheckin.create({ data: { userId: user.id, level, hour } });
      return NextResponse.json({ success: true }, { headers: noStore });
    }

    const taskId = must(idOf(body.taskId), "taskId is required");
    const task = await prisma.task.findFirst({ where: { id: taskId, userId: user.id } });
    if (!task) return notFound("Task not found", noStore);

    if (action === "DEFER") {
      const days = must(num(body.days ?? 1, { min: 1, max: 60, int: true, required: true }), "days must be 1 to 60");
      const local = zonedNow();
      // Nine in the morning, local time, that many days from today
      const dueDate = new Date(local.startOfDay.getTime() + days * 86400000 + 9 * 3600000);
      await prisma.task.update({ where: { id: task.id }, data: { dueDate } });
      const event = await prisma.effortEvent.create({
        data: { userId: user.id, type: "DEFER", taskId: task.id, minutes: task.estimatedMinutes || 0 },
      });
      return NextResponse.json(
        { success: true, dueDate: dueDate.toISOString(), eventId: event.id, previous: { status: task.status, dueDate: task.dueDate } },
        { headers: noStore }
      );
    }

    if (action === "DROP") {
      await prisma.task.update({ where: { id: task.id }, data: { status: "ARCHIVED" } });
      const event = await prisma.effortEvent.create({
        data: { userId: user.id, type: "DROP", taskId: task.id, minutes: task.estimatedMinutes || 0 },
      });
      return NextResponse.json(
        { success: true, eventId: event.id, previous: { status: task.status, dueDate: task.dueDate } },
        { headers: noStore }
      );
    }

    if (action === "COMPLETE") {
      await prisma.task.update({ where: { id: task.id }, data: { status: "DONE" } });
      if (task.status !== "DONE") await spawnNextRecurrence(task);
      await touchProject(task.projectId);
      if (task.entityId) {
        await prisma.entity.update({ where: { id: task.entityId }, data: { status: "COMPLETED" } }).catch(() => {});
      }
      if (body.kind === "BATCH" || body.kind === "SPRINT") {
        await prisma.effortEvent.create({
          data: { userId: user.id, type: body.kind, taskId: task.id, minutes: task.estimatedMinutes || 0 },
        });
      }
      return NextResponse.json({ success: true }, { headers: noStore });
    }

    if (action === "SPRINT") {
      await prisma.effortEvent.create({ data: { userId: user.id, type: "SPRINT", taskId: task.id, minutes: 15 } });
      return NextResponse.json({ success: true }, { headers: noStore });
    }

    if (action === "RESTORE") {
      const status = typeof body.status === "string" && body.status.length <= 20 ? body.status : "TODO";
      const dueDate = body.dueDate ? new Date(body.dueDate) : null;
      if (dueDate && Number.isNaN(dueDate.getTime())) throw new ValidationError("dueDate is invalid");
      await prisma.task.update({ where: { id: task.id }, data: { status, dueDate } });
      if (typeof body.eventId === "string") {
        await prisma.effortEvent.deleteMany({ where: { id: body.eventId, userId: user.id } });
      }
      return NextResponse.json({ success: true }, { headers: noStore });
    }

    throw new ValidationError("Unknown action");
  } catch (error: any) {
    if (error instanceof ValidationError) return badRequest(error.message);
    console.error("Error executing effort action:", error);
    return NextResponse.json({ success: false, error: "Effort action failed" }, { status: 500, headers: noStore });
  }
}
