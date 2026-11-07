import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ValidationError, badRequest, must, num, readBody, str } from "@/lib/validate";

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
    if (error instanceof ValidationError) return badRequest(error.message);
    console.error("Error generating journal:", error);
    return NextResponse.json(
      { success: false, error: "Failed to generate journal" },
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
    const { date, summary: summaryIn, focusMinutes: focusIn, learningMinutes: learningIn, completedTasksCount: completedIn } = body;

    const targetDate = must(str(date, { max: 10 }), "date must be YYYY-MM-DD") ?? new Date().toISOString().split("T")[0];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate) || Number.isNaN(Date.parse(targetDate))) {
      throw new ValidationError("date must be YYYY-MM-DD");
    }
    const summary = must(str(summaryIn, { max: 20000 }), "Summary is too long");
    const focusMinutes = must(num(focusIn, { min: 0, max: 100000, int: true }), "focusMinutes is invalid") ?? 0;
    const learningMinutes = must(num(learningIn, { min: 0, max: 100000, int: true }), "learningMinutes is invalid") ?? 0;
    const completedTasksCount = must(num(completedIn, { min: 0, max: 100000, int: true }), "completedTasksCount is invalid") ?? 0;
    const existing = await prisma.journalEntry.findFirst({
      where: { date: targetDate, userId: user.id },
    });

    let entry;
    if (existing) {
      entry = await prisma.journalEntry.update({
        where: { id: existing.id },
        data: {
          summary,
          focusMinutes,
          learningMinutes,
          completedTasksCount,
        },
      });
    } else {
      entry = await prisma.journalEntry.create({
        data: {
          userId: user.id,
          date: targetDate,
          summary,
          focusMinutes,
          learningMinutes,
          completedTasksCount,
        },
      });
    }

    return NextResponse.json({ success: true, entry });
  } catch (error: any) {
    if (error instanceof ValidationError) return badRequest(error.message);
    console.error("Error saving journal entry:", error);
    return NextResponse.json(
      { success: false, error: "Failed to save journal" },
      { status: 500 }
    );
  }
}
