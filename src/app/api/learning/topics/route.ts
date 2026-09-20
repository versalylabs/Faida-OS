import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// POST /api/learning/topics - Create a new lesson/topic under a subject
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { subjectId, title, description, status } = body;

    if (!subjectId || !title || !title.trim()) {
      return NextResponse.json(
        { success: false, error: "subjectId and title are required" },
        { status: 400 }
      );
    }

    // Verify the subject belongs to the current user
    const subject = await prisma.learningSubject.findFirst({
      where: {
        id: subjectId,
        userId: user.id,
      },
    });

    if (!subject) {
      return NextResponse.json({ success: false, error: "Subject not found" }, { status: 404 });
    }

    const topic = await prisma.learningTopic.create({
      data: {
        subjectId,
        title: title.trim(),
        description: description?.trim() || null,
        status: status || "NOT_STARTED",
      },
      include: {
        sessions: true,
      },
    });

    return NextResponse.json({ success: true, topic });
  } catch (error: any) {
    console.error("Error creating learning topic:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create lesson" },
      { status: 500 }
    );
  }
}

// PATCH /api/learning/topics - Update a lesson/topic
export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { id, title, description, status, subjectId } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: "Topic ID is required" }, { status: 400 });
    }

    // Verify the topic exists and belongs to a subject owned by this user
    const existing = await prisma.learningTopic.findFirst({
      where: {
        id,
        subject: { userId: user.id },
      },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: "Lesson not found" }, { status: 404 });
    }

    // If subjectId is changing, verify the target subject also belongs to this user
    if (subjectId && subjectId !== existing.subjectId) {
      const targetSubject = await prisma.learningSubject.findFirst({
        where: { id: subjectId, userId: user.id },
      });
      if (!targetSubject) {
        return NextResponse.json({ success: false, error: "Target subject not found" }, { status: 404 });
      }
    }

    const updated = await prisma.learningTopic.update({
      where: { id },
      data: {
        ...(title !== undefined && { title: title.trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
        ...(status !== undefined && { status }),
        ...(subjectId !== undefined && { subjectId }),
      },
      include: {
        sessions: {
          orderBy: { studiedAt: "desc" },
        },
      },
    });

    return NextResponse.json({ success: true, topic: updated });
  } catch (error: any) {
    console.error("Error updating learning topic:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update lesson" },
      { status: 500 }
    );
  }
}

// DELETE /api/learning/topics - Delete a lesson/topic
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
      return NextResponse.json({ success: false, error: "Topic ID is required" }, { status: 400 });
    }

    // Verify ownership
    const existing = await prisma.learningTopic.findFirst({
      where: {
        id,
        subject: { userId: user.id },
      },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: "Lesson not found" }, { status: 404 });
    }

    await prisma.learningTopic.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: "Lesson deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting learning topic:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to delete lesson" },
      { status: 500 }
    );
  }
}
