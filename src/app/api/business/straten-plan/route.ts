import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { touchProject } from "@/lib/projectActivity";
import { STRATEN_PHASES, STRATEN_PLAN_MARKER, phaseMilestone } from "@/lib/playbooks";
import { ValidationError, badRequest, notFound, ownedId, readBody } from "@/lib/validate";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const noCache = { "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate", Pragma: "no-cache", Expires: "0" };

/**
 * Brings a project that was made from the first Straten plan up to the revised one. Only adds, renames and links:
 * nothing is deleted, existing dates and finished work stay, and tasks that were completed (and cleared after a day)
 * are never re-created because only tasks new in the revised plan are added. Safe to run again.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401, headers: noCache });

    const body = await readBody(req);
    const projectId = await ownedId("project", user.id, body.projectId);
    if (!projectId) return notFound("Project not found", noCache);

    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: user.id },
      include: { milestones: { orderBy: { order: "asc" } }, tasks: { where: { userId: user.id } } },
    });
    if (!project) return notFound("Project not found", noCache);

    // 1. Milestones: add the missing ones, then put them in plan order
    let addedMilestones = 0;
    let milestones = project.milestones;
    let nextOrder = milestones.reduce((m, x) => Math.max(m, x.order), -1) + 1;
    for (const phase of STRATEN_PHASES) {
      if (phaseMilestone(phase, milestones)) continue;
      const created = await prisma.milestone.create({ data: { projectId, title: phase.name, dueDate: new Date(phase.end), order: nextOrder++ } });
      milestones = [...milestones, created];
      addedMilestones++;
    }
    // Plan order: the parallel sprint first, then the numbered phases (also repairs an earlier run that stopped early)
    const wanted = STRATEN_PHASES.map((p) => phaseMilestone(p, milestones)?.id).filter((v): v is string => !!v);
    const rest = milestones.filter((m) => !wanted.includes(m.id)).map((m) => m.id);
    const finalOrder = [...wanted, ...rest];
    const currentOrder = [...milestones].sort((a, b) => a.order - b.order).map((m) => m.id);
    if (finalOrder.join() !== currentOrder.join()) {
      await Promise.all(finalOrder.map((id, order) => prisma.milestone.updateMany({ where: { id, projectId }, data: { order } })));
    }

    // 2. Tasks
    const byTitle = new Map(project.tasks.map((t) => [t.title.trim().toLowerCase(), t]));
    let addedTasks = 0;
    let renamed = 0;
    let linked = 0;
    for (const phase of STRATEN_PHASES) {
      const milestoneId = phaseMilestone(phase, milestones)?.id ?? null;
      for (const task of phase.tasks) {
        const present = byTitle.get(task.title.trim().toLowerCase());
        const old = task.renamedFrom ? byTitle.get(task.renamedFrom.trim().toLowerCase()) : undefined;
        if (!present && old) {
          await prisma.task.update({ where: { id: old.id }, data: { title: task.title, ...(milestoneId && !old.milestoneId ? { milestoneId } : {}) } });
          if (old.entityId) await prisma.entity.update({ where: { id: old.entityId }, data: { title: task.title } }).catch(() => {});
          renamed++;
        } else if (!present && task.added) {
          const entity = await prisma.entity.create({ data: { userId: user.id, type: "TASK", title: task.title, content: "", priority: "MEDIUM", status: "ACTIVE" } });
          await prisma.task.create({
            data: {
              userId: user.id,
              entityId: entity.id,
              title: task.title,
              description: "",
              priority: "MEDIUM",
              status: "TODO",
              estimatedMinutes: 60,
              dueDate: new Date(task.due ?? phase.end),
              projectId,
              milestoneId,
              category: "Straten",
            },
          });
          await prisma.activityLog.create({ data: { entityId: entity.id, action: "CREATED", details: `Created task: ${task.title}` } });
          addedTasks++;
        } else if (present && milestoneId && !present.milestoneId) {
          await prisma.task.update({ where: { id: present.id }, data: { milestoneId } });
          linked++;
        }
      }
    }

    // 3. Note the plan version in the description
    if (!project.description?.includes(STRATEN_PLAN_MARKER)) {
      const base = (project.description ?? "").trim();
      const description = `${base}${base ? "\n\n" : ""}${STRATEN_PLAN_MARKER} (revised 17 November 2026).`;
      await prisma.project.update({ where: { id: projectId }, data: { description } });
      if (project.entityId) await prisma.entity.update({ where: { id: project.entityId }, data: { content: description } }).catch(() => {});
    }
    await touchProject(projectId);

    return NextResponse.json({ success: true, addedTasks, addedMilestones, renamed, linked }, { headers: noCache });
  } catch (error: any) {
    if (error instanceof ValidationError) return badRequest(error.message);
    console.error("Error updating the Straten plan project:", error);
    return NextResponse.json({ success: false, error: "Could not update the project" }, { status: 500, headers: noCache });
  }
}
