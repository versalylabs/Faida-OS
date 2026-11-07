import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ValidationError, badRequest, idOf, must, num, readBody, str } from "@/lib/validate";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await readBody(req);
    const { topicId, durationMinutes, notes, markCompleted } = body;

    const cleanTopicId = must(idOf(topicId), "topicId is required");
    const duration = must(num(durationMinutes, { min: 1, max: 1440, int: true, required: true }), "durationMinutes must be a whole number between 1 and 1440");
    const cleanNotes = must(str(notes, { max: 50000 }), "Notes are too long");

    // 1. Fetch topic and parent subject (verify belongs to user)
    const topic = await prisma.learningTopic.findFirst({
      where: {
        id: cleanTopicId,
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
        topicId: cleanTopicId,
        durationMinutes: duration,
        notes: cleanNotes,
      },
    });

    // 3. Update topic status
    const newStatus = markCompleted ? "COMPLETED" : "IN_PROGRESS";
    await prisma.learningTopic.update({
      where: { id: cleanTopicId },
      data: { status: newStatus },
    });

    // 4. If notes provided, automatically link to Knowledge Base!
    if (cleanNotes) {
      const entity = await prisma.entity.create({
        data: {
          userId: user.id,
          type: "NOTE",
          title: `Study Notes: ${topic.title}`,
          content: cleanNotes,
          status: "ACTIVE",
        },
      });

      await prisma.note.create({
        data: {
          userId: user.id,
          entityId: entity.id,
          title: `Study Notes: ${topic.title}`,
          content: cleanNotes,
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
    if (error instanceof ValidationError) return badRequest(error.message);
    console.error("Error logging study session:", error);
    return NextResponse.json(
      { success: false, error: "Failed to log study session" },
      { status: 500 }
    );
  }
}
