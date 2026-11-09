import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { pickNextAction, pickNextMilestone, staleDays } from "@/lib/projectNext";
import { ValidationError, badRequest, color, date, must, readBody, str } from "@/lib/validate";

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

    const projects = await prisma.project.findMany({
      where: { userId: user.id },
      include: {
        milestones: {
          orderBy: { order: "asc" },
        },
        tasks: {
          where: { userId: user.id },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    // Calculate dynamic progress percent if milestones exist
    const enrichedProjects = projects.map((proj) => {
      let progress = proj.progressPercent;
      if (proj.milestones.length > 0) {
        const doneCount = proj.milestones.filter((m) => m.isDone).length;
        progress = Math.round((doneCount / proj.milestones.length) * 100);
      } else if (proj.tasks.length > 0) {
        const doneTasks = proj.tasks.filter((t) => t.status === "DONE").length;
        progress = Math.round((doneTasks / proj.tasks.length) * 100);
      }

      return {
        ...proj,
        progressPercent: progress,
        totalTasks: proj.tasks.length,
        completedTasks: proj.tasks.filter((t) => t.status === "DONE").length,
        staleDays: staleDays(
          proj.status,
          proj.milestones.some((m) => !m.isDone) || proj.tasks.some((t) => !["DONE", "CANCELLED", "ARCHIVED"].includes(t.status)),
          [proj.updatedAt, ...proj.tasks.map((t) => t.updatedAt)]
        ),
        nextAction: pickNextAction(proj.tasks),
        nextMilestone: pickNextMilestone(proj.milestones),
        totalMilestones: proj.milestones.length,
        completedMilestones: proj.milestones.filter((m) => m.isDone).length,
      };
    });

    return NextResponse.json({ success: true, projects: enrichedProjects }, { headers: noCacheHeaders });
  } catch (error: any) {
    if (error instanceof ValidationError) return badRequest(error.message);
    console.error("Error fetching projects:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch projects" },
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
    const { name, description, color: color_, targetDate, milestones } = body;

    const cleanName = must(str(name, { max: 200, required: true }), "Project name is required (max 200 characters)");
    const cleanDescription = must(str(description, { max: 10000 }), "Description is too long");
    const cleanColor = must(color(color_), "Color must be a hex value like #3b82f6") ?? "#3b82f6";
    const cleanTarget = must(date(targetDate), "Target date is invalid");
    if (milestones !== undefined && !Array.isArray(milestones)) throw new ValidationError("Milestones must be a list");
    const cleanMilestones: { title: string; dueDate: Date | null }[] = [];
    for (const m of (milestones ?? []).slice(0, 50)) {
      const t = str(typeof m === "string" ? m : m?.title, { max: 300 });
      if (t === undefined) throw new ValidationError("Milestone title is invalid (max 300 characters)");
      const due = typeof m === "object" && m !== null ? must(date(m.dueDate), "Milestone due date is invalid") : null;
      if (t) cleanMilestones.push({ title: t, dueDate: due });
    }

    // 1. Create Entity node
    const entity = await prisma.entity.create({
      data: {
        userId: user.id,
        type: "PROJECT",
        title: cleanName,
        content: cleanDescription,
        status: "ACTIVE",
      },
    });

    // 2. Create Project
    const project = await prisma.project.create({
      data: {
        userId: user.id,
        entityId: entity.id,
        name: cleanName,
        description: cleanDescription,
        color: cleanColor,
        targetDate: cleanTarget,
      },
    });

    // 3. Create initial milestones if provided
    for (let i = 0; i < cleanMilestones.length; i++) {
      await prisma.milestone.create({
        data: { projectId: project.id, title: cleanMilestones[i].title, dueDate: cleanMilestones[i].dueDate, order: i },
      });
    }

    // 4. Log activity
    await prisma.activityLog.create({
      data: {
        entityId: entity.id,
        action: "CREATED",
        details: `Created project workspace: ${project.name}`,
      },
    });

    return NextResponse.json({ success: true, project });
  } catch (error: any) {
    if (error instanceof ValidationError) return badRequest(error.message);
    console.error("Error creating project:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create project" },
      { status: 500 }
    );
  }
}
