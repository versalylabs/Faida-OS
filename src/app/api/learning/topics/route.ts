import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ValidationError, badRequest, idOf, must, oneOf, readBody, str } from "@/lib/validate";

// POST /api/learning/topics - Create a new lesson/topic under a subject
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await readBody(req);
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
    if (error instanceof ValidationError) return badRequest(error.message);
    console.error("Error creating learning topic:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create lesson" },
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

    const body = await readBody(req);
    const { id, title, description, status, subjectId } = body;

    const topicId = must(idOf(id), "Topic ID is required");
    const patchTitle = title !== undefined ? must(str(title, { max: 300, required: true }), "Title is required (max 300 characters)") : undefined;
    const patchDescription = description !== undefined ? must(str(description, { max: 10000 }), "Description is too long") : undefined;
    const patchStatus = status !== undefined ? must(oneOf(status, ["NOT_STARTED", "IN_PROGRESS", "COMPLETED"] as const, { required: true }), "Invalid status") : undefined;
    if (subjectId !== undefined && subjectId !== null && subjectId !== "") must(idOf(subjectId), "Invalid subjectId");

    // Verify the topic exists and belongs to a subject owned by this user
    const existing = await prisma.learningTopic.findFirst({
      where: {
        id: topicId,
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
      where: { id: topicId },
      data: {
        ...(patchTitle !== undefined && { title: patchTitle }),
        ...(patchDescription !== undefined && { description: patchDescription }),
        ...(patchStatus !== undefined && { status: patchStatus }),
        ...(subjectId && { subjectId }),
      },
      include: {
        sessions: {
          orderBy: { studiedAt: "desc" },
        },
      },
    });

    return NextResponse.json({ success: true, topic: updated });
  } catch (error: any) {
    if (error instanceof ValidationError) return badRequest(error.message);
    console.error("Error updating learning topic:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update lesson" },
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
        const body = await readBody(req);
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
    if (error instanceof ValidationError) return badRequest(error.message);
    console.error("Error deleting learning topic:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete lesson" },
      { status: 500 }
    );
  }
}
