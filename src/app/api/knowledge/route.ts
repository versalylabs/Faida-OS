import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q");
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
    console.error("Error fetching knowledge notes:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch notes" },
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

    const body = await req.json();
    const { title, content, category, tags } = body;

    if (!title || !title.trim()) {
      return NextResponse.json({ success: false, error: "Title is required" }, { status: 400 });
    }

    // 1. Create Entity node
    const entity = await prisma.entity.create({
      data: {
        userId: user.id,
        type: "NOTE",
        title: title.trim(),
        content: content || "",
        status: "ACTIVE",
      },
    });

    // 2. Create Note
    const note = await prisma.note.create({
      data: {
        userId: user.id,
        entityId: entity.id,
        title: title.trim(),
        content: content || "",
        category: category || "General",
        tags: Array.isArray(tags) ? tags.join(", ") : tags || "",
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
    console.error("Error creating note:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create note" },
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
    console.error("Error deleting note:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to delete note" },
      { status: 500 }
    );
  }
}
