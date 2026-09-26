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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401, headers: noCacheHeaders });
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
      return NextResponse.json({ success: false, error: "Project not found" }, { status: 404, headers: noCacheHeaders });
    }

    // Find notes related to this project (scoped to user)
    // Checks direct projectId foreign key relation as well as matching names
    const relatedNotes = await prisma.note.findMany({
      where: {
        userId: user.id,
        OR: [
          { projectId: id },
          { category: { contains: project.name, mode: "insensitive" } },
          { title: { contains: project.name, mode: "insensitive" } },
          { tags: { contains: project.name, mode: "insensitive" } },
          { content: { contains: project.name, mode: "insensitive" } },
        ],
      },
      orderBy: { updatedAt: "desc" },
    });

    let progress = project.progressPercent;
    if (project.milestones.length > 0) {
      const doneCount = project.milestones.filter((m) => m.isDone).length;
      progress = Math.round((doneCount / project.milestones.length) * 100);
    }

    return NextResponse.json(
      {
        success: true,
        project: {
          ...project,
          progressPercent: progress,
        },
        notes: relatedNotes,
      },
      { headers: noCacheHeaders }
    );
  } catch (error: any) {
    console.error("Error fetching project workspace:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch project workspace" },
      { status: 500, headers: noCacheHeaders }
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
    const {
      milestoneId,
      milestoneDone,
      newMilestoneTitle,
      name,
      description,
      status,
      color,
      targetDate,
    } = body;

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

    // 3. Update project details if provided
    const updateData: any = {};
    if (name !== undefined) {
      if (!name.trim()) {
        return NextResponse.json(
          { success: false, error: "Project name cannot be empty" },
          { status: 400 }
        );
      }
      updateData.name = name.trim();
    }
    if (description !== undefined) {
      updateData.description = description ? description.trim() : null;
    }
    if (status !== undefined) {
      updateData.status = status;
    }
    if (color !== undefined) {
      updateData.color = color;
    }
    if (targetDate !== undefined) {
      updateData.targetDate = targetDate ? new Date(targetDate) : null;
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.project.update({
        where: { id },
        data: updateData,
      });

      // Also sync title and description with Entity graph node if available
      if (project.entityId && (updateData.name || updateData.description !== undefined)) {
        await prisma.entity
          .update({
            where: { id: project.entityId },
            data: {
              ...(updateData.name && { title: updateData.name }),
              ...(updateData.description !== undefined && { content: updateData.description }),
              ...(updateData.status && { status: updateData.status }),
            },
          })
          .catch(() => {});
      }
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

    return NextResponse.json({ success: true, project: updated }, { headers: noCacheHeaders });
  } catch (error: any) {
    console.error("Error updating project workspace:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update project" },
      { status: 500 }
    );
  }
}

export async function DELETE(
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

    // Delete project (milestones cascade delete; tasks, notes, files, credentials have projectId set to null)
    await prisma.project.delete({
      where: { id },
    });

    // Clean up entity node from the entity graph if present
    if (project.entityId) {
      await prisma.entity.deleteMany({
        where: { id: project.entityId },
      });
    }

    return NextResponse.json(
      { success: true, message: "Project deleted successfully" },
      { headers: noCacheHeaders }
    );
  } catch (error: any) {
    console.error("Error deleting project:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to delete project" },
      { status: 500 }
    );
  }
}
