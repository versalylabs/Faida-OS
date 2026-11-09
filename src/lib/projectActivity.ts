import { prisma } from "@/lib/db";

/**
 * Marks a project as having just moved (task added or finished, milestone changed).
 *
 * Finished tasks are cleared 48 hours after completion, so "when did work last happen here?" cannot be
 * worked out from tasks alone. Project.updatedAt is that record. Best effort: a failure here must never
 * break the action that triggered it.
 */
export async function touchProject(projectId: string | null | undefined): Promise<void> {
  if (!projectId) return;
  try {
    await prisma.project.updateMany({ where: { id: projectId }, data: { updatedAt: new Date() } });
  } catch (error) {
    console.error("[projectActivity] could not record project activity:", error instanceof Error ? error.message : error);
  }
}
