import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ValidationError, badRequest, idOf, must, readBody, str, tagsOf } from "@/lib/validate";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.slice(0, 200) ?? null;
    const category = searchParams.get("category");

    const where: any = { userId: user.id };
    if (category && category !== "ALL") {
      where.category = category;
    }
    if (q && q.trim()) {
      const query = q.trim();
      where.AND = [
        {
          OR: [
            { title: { contains: query } },
            { content: { contains: query } },
            { tags: { contains: query } },
            { category: { contains: query } },
          ],
        },
      ];
    }

    const notes = await prisma.note.findMany({
      where,
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({ success: true, notes });
  } catch (error: any) {
    if (error instanceof ValidationError) return badRequest(error.message);
    console.error("Error fetching knowledge notes:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch notes" },
      { status: 500 }
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
    const { title, content, category, tags } = body;

    const cleanTitle = must(str(title, { max: 300, required: true }), "Title is required (max 300 characters)");
    const cleanContent = must(str(content, { max: 200000 }), "Content is too long") ?? "";
    const cleanCategory = must(str(category, { max: 80 }), "Category is too long") ?? "General";
    const cleanTags = must(tagsOf(tags), "Tags are invalid") ?? "";

    // 1. Create Entity node
    const entity = await prisma.entity.create({
      data: {
        userId: user.id,
        type: "NOTE",
        title: cleanTitle,
        content: cleanContent,
        status: "ACTIVE",
      },
    });

    // 2. Create Note
    const note = await prisma.note.create({
      data: {
        userId: user.id,
        entityId: entity.id,
        title: cleanTitle,
        content: cleanContent,
        category: cleanCategory,
        tags: cleanTags,
      },
    });

    // 3. Log activity
    await prisma.activityLog.create({
      data: {
        entityId: entity.id,
        action: "CREATED",
        details: `Saved knowledge note: ${note.title}`,
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

export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, error: "Note ID required" }, { status: 400 });
    }

    const existing = await prisma.note.findFirst({
      where: { id, userId: user.id },
    });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Note not found" }, { status: 404 });
    }

    const note = await prisma.note.delete({ where: { id } });
    if (note.entityId) {
      await prisma.entity.delete({ where: { id: note.entityId } }).catch(() => {});
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error instanceof ValidationError) return badRequest(error.message);
    console.error("Error deleting note:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete note" },
      { status: 500 }
    );
  }
}
