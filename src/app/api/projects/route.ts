import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

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
        totalMilestones: proj.milestones.length,
        completedMilestones: proj.milestones.filter((m) => m.isDone).length,
      };
    });

    return NextResponse.json({ success: true, projects: enrichedProjects }, { headers: noCacheHeaders });
  } catch (error: any) {
    console.error("Error fetching projects:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch projects" },
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

    const body = await req.json();
    const { name, description, color, targetDate, milestones } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ success: false, error: "Project name is required" }, { status: 400 });
    }

    // 1. Create Entity node
    const entity = await prisma.entity.create({
      data: {
        userId: user.id,
        type: "PROJECT",
        title: name.trim(),
        content: description,
        status: "ACTIVE",
      },
    });

    // 2. Create Project
    const project = await prisma.project.create({
      data: {
        userId: user.id,
        entityId: entity.id,
        name: name.trim(),
        description,
        color: color || "#3b82f6",
        targetDate: targetDate ? new Date(targetDate) : null,
      },
    });

    // 3. Create initial milestones if provided
    if (Array.isArray(milestones) && milestones.length > 0) {
      for (let i = 0; i < milestones.length; i++) {
        const mTitle = typeof milestones[i] === "string" ? milestones[i] : milestones[i].title;
        if (mTitle && mTitle.trim()) {
          await prisma.milestone.create({
            data: {
              projectId: project.id,
              title: mTitle.trim(),
              order: i,
            },
          });
        }
      }
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
    console.error("Error creating project:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create project" },
      { status: 500 }
    );
  }
}
