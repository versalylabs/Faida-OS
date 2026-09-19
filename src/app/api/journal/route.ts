import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const todayStr = new Date().toISOString().split("T")[0];
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // 1. Fetch completed tasks today
    const completedTasksToday = await prisma.task.findMany({
      where: {
        userId: user.id,
        status: "DONE",
        updatedAt: { gte: todayStart },
      },
      include: { project: true },
    });

    // 2. Fetch study sessions today
    const studySessionsToday = await prisma.studySession.findMany({
      where: {
        topic: { subject: { userId: user.id } },
        studiedAt: { gte: todayStart },
      },
      include: { topic: { include: { subject: true } } },
    });

    // 3. Fetch activity log entries today
    const activitiesToday = await prisma.activityLog.findMany({
      where: {
        timestamp: { gte: todayStart },
        OR: [
          { entity: { userId: user.id } },
          { entityId: null },
        ],
      },
      orderBy: { timestamp: "desc" },
      take: 20,
    });

    // 4. Calculate metrics
    const completedTasksCount = completedTasksToday.length;
    const focusMinutes = completedTasksToday.reduce(
      (sum, t) => sum + (t.actualMinutes || t.estimatedMinutes || 30),
      0
    );
    const learningMinutes = studySessionsToday.reduce(
      (sum, s) => sum + s.durationMinutes,
      0
    );

    // Dynamic AI Daily Summary
    const focusHours = Math.floor(focusMinutes / 60);
    const focusRemainingMins = focusMinutes % 60;
    const learningHours = Math.floor(learningMinutes / 60);
    const learningRemainingMins = learningMinutes % 60;

    let dynamicSummary = `Today you accomplished ${completedTasksCount} key task${
      completedTasksCount === 1 ? "" : "s"
    }, investing ${focusHours}h ${focusRemainingMins}m in focused execution.`;

    if (learningMinutes > 0) {
      dynamicSummary += ` You dedicated ${learningHours}h ${learningRemainingMins}m to deep learning across ${studySessionsToday.length} topic session${
        studySessionsToday.length === 1 ? "" : "s"
      }.`;
    }

    // Historical journal entries scoped to user
    const historicalEntries = await prisma.journalEntry.findMany({
      where: { userId: user.id },
      orderBy: { date: "desc" },
      take: 7,
    });

    return NextResponse.json({
      success: true,
      today: {
        date: todayStr,
        completedTasksCount,
        focusMinutes,
        learningMinutes,
        summary: dynamicSummary,
        completedTasks: completedTasksToday,
        studySessions: studySessionsToday,
        activities: activitiesToday,
      },
      history: historicalEntries,
    });
  } catch (error: any) {
    console.error("Error generating journal:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to generate journal" },
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
    const { date, summary, focusMinutes, learningMinutes, completedTasksCount } = body;
    const targetDate = date || new Date().toISOString().split("T")[0];

    const existing = await prisma.journalEntry.findFirst({
      where: { date: targetDate, userId: user.id },
    });

    let entry;
    if (existing) {
      entry = await prisma.journalEntry.update({
        where: { id: existing.id },
        data: {
          summary,
          focusMinutes: focusMinutes || 0,
          learningMinutes: learningMinutes || 0,
          completedTasksCount: completedTasksCount || 0,
        },
      });
    } else {
      entry = await prisma.journalEntry.create({
        data: {
          userId: user.id,
          date: targetDate,
          summary,
          focusMinutes: focusMinutes || 0,
          learningMinutes: learningMinutes || 0,
          completedTasksCount: completedTasksCount || 0,
        },
      });
    }

    return NextResponse.json({ success: true, entry });
  } catch (error: any) {
    console.error("Error saving journal entry:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to save journal" },
      { status: 500 }
    );
  }
}
