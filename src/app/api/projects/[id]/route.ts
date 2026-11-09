import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ValidationError, badRequest, color, date, must, readBody, str } from "@/lib/validate";

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
    if (error instanceof ValidationError) return badRequest(error.message);
    console.error("Error fetching project workspace:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch project workspace" },
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

    const body = await readBody(req);
    const {
      milestoneId,
      milestoneDone,
      newMilestoneTitle,
      milestoneTitle,
      milestoneDueDate,
      newMilestoneDueDate,
      deleteMilestoneId,
      name,
      description,
      status,
      color: color_,
      targetDate,
    } = body;

    // Validate everything before changing anything.
    const updateData: any = {};
    if (name !== undefined) updateData.name = must(str(name, { max: 200, required: true }), "Project name is required (max 200 characters)");
    if (description !== undefined) updateData.description = must(str(description, { max: 10000 }), "Description is too long");
    if (status !== undefined) updateData.status = must(str(status, { max: 40, required: true }), "Invalid status");
    if (color_ !== undefined) updateData.color = must(color(color_), "Color must be a hex value like #3b82f6") ?? "#3b82f6";
    if (targetDate !== undefined) updateData.targetDate = must(date(targetDate), "Target date is invalid");
    const cleanMilestoneTitle = newMilestoneTitle !== undefined ? must(str(newMilestoneTitle, { max: 300 }), "Milestone title is invalid (max 300 characters)") : null;
    if (milestoneId !== undefined && (typeof milestoneId !== "string" || milestoneId.length > 100)) {
      throw new ValidationError("Milestone ID is invalid");
    }

    const cleanMilestoneRename =
      milestoneTitle !== undefined
        ? must(str(milestoneTitle, { max: 300, required: true }), "Milestone title is required (max 300 characters)")
        : null;
    // undefined = leave the date alone, empty/null = clear it
    const cleanMilestoneDue =
      milestoneDueDate !== undefined ? must(date(milestoneDueDate), "Milestone due date is invalid") : undefined;
    const cleanNewMilestoneDue =
      newMilestoneDueDate !== undefined ? must(date(newMilestoneDueDate), "Milestone due date is invalid") : null;
    if (deleteMilestoneId !== undefined && (typeof deleteMilestoneId !== "string" || deleteMilestoneId.length > 100)) {
      throw new ValidationError("Milestone ID is invalid");
    }

    // 1. Toggle completion and/or rename a milestone (scoped to this project)
    if (milestoneId) {
      const data: { isDone?: boolean; title?: string; dueDate?: Date | null } = {};
      if (milestoneDone !== undefined) data.isDone = Boolean(milestoneDone);
      if (cleanMilestoneRename) data.title = cleanMilestoneRename;
      if (cleanMilestoneDue !== undefined) data.dueDate = cleanMilestoneDue;
      if (Object.keys(data).length > 0) {
        await prisma.milestone.updateMany({ where: { id: milestoneId, projectId: id }, data });
      }
    }

    // 1b. Delete a milestone (scoped to this project)
    if (deleteMilestoneId) {
      await prisma.milestone.deleteMany({ where: { id: deleteMilestoneId, projectId: id } });
    }

    // 2. Add new milestone
    if (cleanMilestoneTitle) {
      const highestOrder = await prisma.milestone.findFirst({
        where: { projectId: id },
        orderBy: { order: "desc" },
      });
      await prisma.milestone.create({
        data: {
          projectId: id,
          title: cleanMilestoneTitle,
          dueDate: cleanNewMilestoneDue,
          order: (highestOrder?.order ?? -1) + 1,
        },
      });
    }

    // 3. Update project details if provided
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
    if (error instanceof ValidationError) return badRequest(error.message);
    console.error("Error updating project workspace:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update project" },
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
    if (error instanceof ValidationError) return badRequest(error.message);
    console.error("Error deleting project:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete project" },
      { status: 500 }
    );
  }
}
