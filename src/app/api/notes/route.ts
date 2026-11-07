import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ValidationError, badRequest, idOf, must, notFound, ownedId, readBody, str, tagsOf } from "@/lib/validate";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const noCacheHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

// GET /api/notes - Fetch notes with optional search, project filter, category filter
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401, headers: noCacheHeaders });
    }

    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").slice(0, 200).toLowerCase();
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
    if (error instanceof ValidationError) return badRequest(error.message);
    console.error("Error fetching notes:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch notes" },
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

    const body = await readBody(req);
    const { title, content, projectId, category, tags } = body;

    const cleanTitle = must(str(title, { max: 300, required: true }), "Title is required (max 300 characters)");
    const cleanContent = must(str(content, { max: 200000 }), "Content is too long");
    const cleanCategory = must(str(category, { max: 80 }), "Category is too long") ?? "General";
    const cleanTags = must(tagsOf(tags), "Tags are invalid");

    // Verify project belongs to user if provided
    const linkedProjectId = await ownedId("project", user.id, projectId);
    if (linkedProjectId === undefined) {
      return NextResponse.json({ success: false, error: "Linked project not found" }, { status: 404 });
    }

    const entity = await prisma.entity.create({
      data: {
        userId: user.id,
        type: "NOTE",
        title: cleanTitle,
        content: cleanContent ?? "",
        status: "ACTIVE",
      },
    });

    const note = await prisma.note.create({
      data: {
        userId: user.id,
        entityId: entity.id,
        projectId: linkedProjectId,
        title: cleanTitle,
        content: cleanContent ?? "",
        category: cleanCategory,
        tags: cleanTags,
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
    if (error instanceof ValidationError) return badRequest(error.message);
    console.error("Error creating note:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create note" },
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

    const body = await readBody(req);
    const { id, title, content, projectId, category, tags } = body;

    const noteId = must(idOf(id), "Note ID is required");
    const patchTitle = title !== undefined ? must(str(title, { max: 300, required: true }), "Title is required (max 300 characters)") : undefined;
    const patchContent = content !== undefined ? must(str(content, { max: 200000 }), "Content is too long") ?? "" : undefined;
    const patchCategory = category !== undefined ? must(str(category, { max: 80 }), "Category is too long") ?? "General" : undefined;
    const patchTags = tags !== undefined ? must(tagsOf(tags), "Tags are invalid") : undefined;

    const existing = await prisma.note.findFirst({
      where: { id: noteId, userId: user.id },
    });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Note not found" }, { status: 404 });
    }

    let patchProjectId: string | null | undefined;
    if (projectId !== undefined) {
      patchProjectId = await ownedId("project", user.id, projectId);
      if (patchProjectId === undefined) {
        return NextResponse.json({ success: false, error: "Linked project not found" }, { status: 404 });
      }
    }

    const updated = await prisma.note.update({
      where: { id: noteId },
      data: {
        ...(patchTitle !== undefined && { title: patchTitle }),
        ...(patchContent !== undefined && { content: patchContent }),
        ...(patchProjectId !== undefined && { projectId: patchProjectId }),
        ...(patchCategory !== undefined && { category: patchCategory }),
        ...(patchTags !== undefined && { tags: patchTags }),
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

    if (existing.entityId && patchTitle !== undefined) {
      await prisma.entity.update({
        where: { id: existing.entityId },
        data: {
          title: patchTitle,
          content: patchContent,
        },
      }).catch(() => {});
    }

    return NextResponse.json({ success: true, note: updated });
  } catch (error: any) {
    if (error instanceof ValidationError) return badRequest(error.message);
    console.error("Error updating note:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update note" },
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
        const body = await readBody(req);
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
    if (error instanceof ValidationError) return badRequest(error.message);
    console.error("Error deleting note:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete note" },
      { status: 500 }
    );
  }
}
