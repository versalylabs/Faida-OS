import { prisma } from "@/lib/db";

/**
 * Checks that a task may be linked to a milestone: the milestone must exist in one of the user's own
 * projects, and if the task already belongs to a project it must be that same project.
 * Returns the milestone id plus the project it belongs to (so the task can be put in that project),
 * `{ milestoneId: null }` to unlink, or an error message.
 */
export async function resolveMilestoneLink(
  userId: string,
  milestoneId: unknown,
  taskProjectId: string | null
): Promise<{ milestoneId: string | null; projectId?: string } | { error: string }> {
  if (milestoneId === undefined || milestoneId === null || milestoneId === "") return { milestoneId: null };
  if (typeof milestoneId !== "string" || milestoneId.length > 100) return { error: "Milestone ID is invalid" };

  const milestone = await prisma.milestone.findFirst({
    where: { id: milestoneId, project: { userId } },
    select: { id: true, projectId: true },
  });
  if (!milestone) return { error: "Milestone not found" };
  if (taskProjectId && taskProjectId !== milestone.projectId) {
    return { error: "That milestone belongs to a different project than the task" };
  }
  return { milestoneId: milestone.id, projectId: milestone.projectId };
}
