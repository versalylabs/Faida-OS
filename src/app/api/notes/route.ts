import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// GET /api/notes - Fetch notes with optional search, project filter, category filter
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.toLowerCase() || "";
    const projectId = searchParams.get("projectId");
    const category = searchParams.get("category");

    const whereClause: any = {
      userId: user.id,
    };

    if (projectId && projectId !== "ALL") {
      whereClause.projectId = projectId;
    }

    if (category && category !== "ALL") {
      whereClause.category = category;
    }

    const notes = await prisma.note.findMany({
      where: whereClause,
      include: {
        project: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    const filtered = q
      ? notes.filter(
          (n) =>
            n.title.toLowerCase().includes(q) ||
            n.content.toLowerCase().includes(q) ||
            (n.tags && n.tags.toLowerCase().includes(q))
        )
      : notes;

    return NextResponse.json({ success: true, notes: filtered });
  } catch (error: any) {
    console.error("Error fetching notes:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch notes" },
      { status: 500 }
    );
  }
}

// POST /api/notes - Create a new note
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { title, content, projectId, category, tags } = body;

    if (!title || !title.trim()) {
      return NextResponse.json({ success: false, error: "Title is required" }, { status: 400 });
    }

    // Verify project belongs to user if provided
    if (projectId) {
      const project = await prisma.project.findFirst({
        where: { id: projectId, userId: user.id },
      });
      if (!project) {
        return NextResponse.json({ success: false, error: "Linked project not found" }, { status: 404 });
      }
    }

    const entity = await prisma.entity.create({
      data: {
        userId: user.id,
        type: "NOTE",
        title: title.trim(),
        content: content || "",
        status: "ACTIVE",
      },
    });

    const note = await prisma.note.create({
      data: {
        userId: user.id,
        entityId: entity.id,
        projectId: projectId || null,
        title: title.trim(),
        content: content || "",
        category: category || "General",
        tags: tags || null,
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
      },
    });

    return NextResponse.json({ success: true, note });
  } catch (error: any) {
    console.error("Error creating note:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create note" },
      { status: 500 }
    );
  }
}

// PATCH /api/notes - Edit note
export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { id, title, content, projectId, category, tags } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: "Note ID is required" }, { status: 400 });
    }

    const existing = await prisma.note.findFirst({
      where: { id, userId: user.id },
    });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Note not found" }, { status: 404 });
    }

    if (projectId) {
      const project = await prisma.project.findFirst({
        where: { id: projectId, userId: user.id },
      });
      if (!project) {
        return NextResponse.json({ success: false, error: "Linked project not found" }, { status: 404 });
      }
    }

    const updated = await prisma.note.update({
      where: { id },
      data: {
        ...(title !== undefined && { title: title.trim() }),
        ...(content !== undefined && { content }),
        ...(projectId !== undefined && { projectId: projectId || null }),
        ...(category !== undefined && { category }),
        ...(tags !== undefined && { tags }),
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
      },
    });

    if (existing.entityId && title !== undefined) {
      await prisma.entity.update({
        where: { id: existing.entityId },
        data: {
          title: title.trim(),
          content,
        },
      }).catch(() => {});
    }

    return NextResponse.json({ success: true, note: updated });
  } catch (error: any) {
    console.error("Error updating note:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update note" },
      { status: 500 }
    );
  }
}

// DELETE /api/notes - Delete note
export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    let id = searchParams.get("id");
    if (!id) {
      try {
        const body = await req.json();
        id = body.id;
      } catch {}
    }

    if (!id) {
      return NextResponse.json({ success: false, error: "Note ID is required" }, { status: 400 });
    }

    const existing = await prisma.note.findFirst({
      where: { id, userId: user.id },
    });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Note not found" }, { status: 404 });
    }

    await prisma.note.delete({
      where: { id },
    });

    if (existing.entityId) {
      await prisma.entity.delete({
        where: { id: existing.entityId },
      }).catch(() => {});
    }

    return NextResponse.json({ success: true, message: "Note deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting note:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to delete note" },
      { status: 500 }
    );
  }
}
