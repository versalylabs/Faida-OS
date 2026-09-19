import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { topicId, durationMinutes, notes, markCompleted } = body;

    if (!topicId || !durationMinutes) {
      return NextResponse.json(
        { success: false, error: "topicId and durationMinutes are required" },
        { status: 400 }
      );
    }

    const duration = parseInt(durationMinutes, 10);

    // 1. Fetch topic and parent subject (verify belongs to user)
    const topic = await prisma.learningTopic.findFirst({
      where: {
        id: topicId,
        subject: { userId: user.id },
      },
      include: { subject: true },
    });

    if (!topic) {
      return NextResponse.json({ success: false, error: "Topic not found" }, { status: 404 });
    }

    // 2. Create StudySession record
    const session = await prisma.studySession.create({
      data: {
        topicId,
        durationMinutes: duration,
        notes,
      },
    });

    // 3. Update topic status
    const newStatus = markCompleted ? "COMPLETED" : "IN_PROGRESS";
    await prisma.learningTopic.update({
      where: { id: topicId },
      data: { status: newStatus },
    });

    // 4. If notes provided, automatically link to Knowledge Base!
    if (notes && notes.trim()) {
      const entity = await prisma.entity.create({
        data: {
          userId: user.id,
          type: "NOTE",
          title: `Study Notes: ${topic.title}`,
          content: notes,
          status: "ACTIVE",
        },
      });

      await prisma.note.create({
        data: {
          userId: user.id,
          entityId: entity.id,
          title: `Study Notes: ${topic.title}`,
          content: notes,
          category: topic.subject.name,
          tags: `study, ${topic.title.toLowerCase()}, ${topic.subject.name.toLowerCase()}`,
        },
      });
    }

    // 5. Log activity for Work Journal & Analytics
    await prisma.activityLog.create({
      data: {
        action: "STUDIED",
        details: `Studied ${topic.title} (${topic.subject.name}) for ${duration} minutes`,
      },
    });

    return NextResponse.json({ success: true, session });
  } catch (error: any) {
    console.error("Error logging study session:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to log study session" },
      { status: 500 }
    );
  }
}
