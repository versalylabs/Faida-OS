import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const project = await prisma.project.findFirst({
      where: { id, userId: user.id },
      include: {
        milestones: { orderBy: { order: "asc" } },
        tasks: {
          where: { userId: user.id },
          orderBy: [{ status: "asc" }, { priority: "desc" }],
        },
      },
    });

    if (!project) {
      return NextResponse.json({ success: false, error: "Project not found" }, { status: 404 });
    }

    // Find notes related to this project (scoped to user)
    const relatedNotes = await prisma.note.findMany({
      where: {
        userId: user.id,
        OR: [
          { category: { contains: project.name } },
          { title: { contains: project.name } },
          { tags: { contains: project.name } },
          { content: { contains: project.name } },
        ],
      },
      take: 10,
    });

    let progress = project.progressPercent;
    if (project.milestones.length > 0) {
      const doneCount = project.milestones.filter((m) => m.isDone).length;
      progress = Math.round((doneCount / project.milestones.length) * 100);
    }

    return NextResponse.json({
      success: true,
      project: {
        ...project,
        progressPercent: progress,
      },
      notes: relatedNotes,
    });
  } catch (error: any) {
    console.error("Error fetching project workspace:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch project" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const project = await prisma.project.findFirst({
      where: { id, userId: user.id },
    });

    if (!project) {
      return NextResponse.json({ success: false, error: "Project not found" }, { status: 404 });
    }

    const body = await req.json();
    const { milestoneId, milestoneDone, newMilestoneTitle, status } = body;

    // 1. Toggle milestone completion
    if (milestoneId) {
      await prisma.milestone.update({
        where: { id: milestoneId },
        data: { isDone: milestoneDone },
      });
    }

    // 2. Add new milestone
    if (newMilestoneTitle && newMilestoneTitle.trim()) {
      const highestOrder = await prisma.milestone.findFirst({
        where: { projectId: id },
        orderBy: { order: "desc" },
      });
      await prisma.milestone.create({
        data: {
          projectId: id,
          title: newMilestoneTitle.trim(),
          order: (highestOrder?.order ?? -1) + 1,
        },
      });
    }

    // 3. Update project status
    if (status) {
      await prisma.project.update({
        where: { id },
        data: { status },
      });
    }

    // Return updated project
    const updated = await prisma.project.findUnique({
      where: { id },
      include: {
        milestones: { orderBy: { order: "asc" } },
        tasks: {
          where: { userId: user.id },
          orderBy: [{ status: "asc" }, { priority: "desc" }],
        },
      },
    });

    return NextResponse.json({ success: true, project: updated });
  } catch (error: any) {
    console.error("Error updating project workspace:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update project" },
      { status: 500 }
    );
  }
}
