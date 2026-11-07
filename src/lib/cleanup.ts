import { prisma } from "@/lib/db";

/**
 * Finished tasks and finished work deliverables are removed 48 hours after they were completed, so the lists
 * stay about what is still ahead of you.
 *
 * Safety for existing data: the rule starts at RELEASE_AT. Anything that was already completed before
 * then counts as completed *at* RELEASE_AT, so nothing existing disappears until 48 hours after the release
 * (time to look through, or export it from Settings). After that it is a plain rolling 48-hour window.
 */
export const COMPLETED_RETENTION_HOURS = 48;
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
      select: { id: true, entityId: true },
    });
    if (oldTasks.length > 0) {
      await prisma.task.deleteMany({ where: { id: { in: oldTasks.map((t) => t.id) }, userId } });
      const entityIds = oldTasks.map((t) => t.entityId).filter((id): id is string => Boolean(id));
      if (entityIds.length > 0) await prisma.entity.deleteMany({ where: { id: { in: entityIds }, userId } });
    }

    const deliverables = await prisma.businessDeliverable.deleteMany({
      where: {
        userId,
        status: "COMPLETED",
        OR: [{ completedAt: { lt: cutoff } }, { completedAt: null, updatedAt: { lt: cutoff } }],
      },
    });

    return { tasks: oldTasks.length, deliverables: deliverables.count };
  } catch (error) {
    console.error("[cleanup] Could not clear old completed items:", error);
    return { tasks: 0, deliverables: 0 };
  }
}
