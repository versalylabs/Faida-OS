import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const subjects = await prisma.learningSubject.findMany({
      where: { userId: user.id },
      include: {
        topics: {
          orderBy: { createdAt: "asc" },
          include: {
            sessions: {
              orderBy: { studiedAt: "desc" },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const enrichedSubjects = subjects.map((subj) => {
      let totalMinutes = 0;
      let completedTopics = 0;

      subj.topics.forEach((t) => {
        if (t.status === "COMPLETED") completedTopics++;
        t.sessions.forEach((s) => {
          totalMinutes += s.durationMinutes;
        });
      });

      const progress = subj.topics.length > 0
        ? Math.round((completedTopics / subj.topics.length) * 100)
        : subj.progress;

      const hours = Math.floor(totalMinutes / 60);
      const mins = totalMinutes % 60;

      return {
        ...subj,
        progress,
        totalMinutes,
        formattedStudyTime: `${hours}h ${mins}m`,
        totalTopics: subj.topics.length,
        completedTopics,
      };
    });

    return NextResponse.json({ success: true, subjects: enrichedSubjects });
  } catch (error: any) {
    console.error("Error fetching learning subjects:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch learning subjects" },
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
    const { name, description, icon, topicTitles } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ success: false, error: "Subject name is required" }, { status: 400 });
    }

    const subject = await prisma.learningSubject.create({
      data: {
        userId: user.id,
        name: name.trim(),
        description: description?.trim() || null,
        icon: icon || "GraduationCap",
      },
    });

    if (Array.isArray(topicTitles) && topicTitles.length > 0) {
      for (const t of topicTitles) {
        if (typeof t === "string" && t.trim()) {
          await prisma.learningTopic.create({
            data: {
              subjectId: subject.id,
              title: t.trim(),
            },
          });
        }
      }
    }

    return NextResponse.json({ success: true, subject });
  } catch (error: any) {
    console.error("Error creating learning subject:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create subject" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { id, name, description, icon } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: "Subject ID is required" }, { status: 400 });
    }

    const existing = await prisma.learningSubject.findFirst({
      where: { id, userId: user.id },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: "Subject not found" }, { status: 404 });
    }

    const updated = await prisma.learningSubject.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
        ...(icon !== undefined && { icon }),
      },
    });

    return NextResponse.json({ success: true, subject: updated });
  } catch (error: any) {
    console.error("Error updating learning subject:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update subject" },
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
    let id = searchParams.get("id");

    if (!id) {
      try {
        const body = await req.json();
        id = body.id;
      } catch {}
    }

    if (!id) {
      return NextResponse.json({ success: false, error: "Subject ID is required" }, { status: 400 });
    }

    const existing = await prisma.learningSubject.findFirst({
      where: { id, userId: user.id },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: "Subject not found" }, { status: 404 });
    }

    await prisma.learningSubject.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: "Subject deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting learning subject:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to delete subject" },
      { status: 500 }
    );
  }
}
