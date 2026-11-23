import { prisma } from "@/lib/db";

/**
 * Finished tasks and finished work deliverables are removed 24 hours after they were completed, so the lists
 * stay about what is still ahead of you.
 *
 * Safety for existing data: the rule starts at RELEASE_AT. Anything that was already completed before
 * then counts as completed *at* RELEASE_AT, so nothing existing disappears until 24 hours after the release
 * (time to look through, or export it from Settings). After that it is a plain rolling 24-hour window.
 */
export const COMPLETED_RETENTION_HOURS = 24;
const RELEASE_AT = new Date("2026-11-07T04:00:00Z");

const lastRun = new Map<string, number>();

export async function purgeOldCompleted(userId: string): Promise<{ tasks: number; deliverables: number }> {
  const now = Date.now();
  // At most once every 10 minutes per user per server instance; it is only housekeeping
  if ((lastRun.get(userId) ?? 0) > now - 10 * 60000) return { tasks: 0, deliverables: 0 };
  lastRun.set(userId, now);

  const cutoff = new Date(now - COMPLETED_RETENTION_HOURS * 3600000);
  if (RELEASE_AT >= cutoff) return { tasks: 0, deliverables: 0 }; // still inside the grace period

  try {
    const oldTasks = await prisma.task.findMany({
      where: { userId, status: "DONE", updatedAt: { lt: cutoff } },
      select: { id: true, entityId: true, title: true, estimatedMinutes: true, projectId: true, updatedAt: true },
    });
    if (oldTasks.length > 0) {
      // Remember what was finished before it goes (the weekly review reads this)
      await prisma.completionLog.createMany({
        data: oldTasks.map((t) => ({
          userId,
          kind: "TASK",
          sourceId: t.id,
          title: t.title.slice(0, 300),
          minutes: t.estimatedMinutes || null,
          projectId: t.projectId,
          completedAt: t.updatedAt,
        })),
        skipDuplicates: true,
      });
      await prisma.task.deleteMany({ where: { id: { in: oldTasks.map((t) => t.id) }, userId } });
      const entityIds = oldTasks.map((t) => t.entityId).filter((id): id is string => Boolean(id));
      if (entityIds.length > 0) await prisma.entity.deleteMany({ where: { id: { in: entityIds }, userId } });
    }

    const doneWork = await prisma.businessDeliverable.findMany({
      where: {
        userId,
        status: "COMPLETED",
        OR: [{ completedAt: { lt: cutoff } }, { completedAt: null, updatedAt: { lt: cutoff } }],
      },
      select: { id: true, title: true, businessId: true, completedAt: true, updatedAt: true },
    });
    if (doneWork.length > 0) {
      await prisma.completionLog.createMany({
        data: doneWork.map((d) => ({
          userId,
          kind: "DELIVERABLE",
          sourceId: d.id,
          title: d.title.slice(0, 300),
          businessId: d.businessId,
          completedAt: d.completedAt ?? d.updatedAt,
        })),
        skipDuplicates: true,
      });
      await prisma.businessDeliverable.deleteMany({ where: { userId, id: { in: doneWork.map((d) => d.id) } } });
    }

    return { tasks: oldTasks.length, deliverables: doneWork.length };
  } catch (error) {
    console.error("[cleanup] Could not clear old completed items:", error);
    return { tasks: 0, deliverables: 0 };
  }
}
