import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ValidationError, badRequest } from "@/lib/validate";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 86400000);

    // All five reads are independent, so run them together (one database round trip, not five).
    const twoWeeksAgo = new Date(now.getTime() - 14 * 86400000);
    const [completedTasksWeek, activeTasksCount, studySessions, projects, transactions, completedPrevWeek, workedMinutes] = await Promise.all([
      prisma.task.count({
        where: { userId: user.id, status: "DONE", updatedAt: { gte: oneWeekAgo } },
      }),
      prisma.task.count({
        where: { userId: user.id, status: { not: "DONE" } },
      }),
      prisma.studySession.findMany({
        where: { topic: { subject: { userId: user.id } } },
        include: { topic: { include: { subject: true } } },
      }),
      prisma.project.findMany({
        where: { userId: user.id },
        include: {
          tasks: { where: { userId: user.id } },
          milestones: true,
        },
      }),
      prisma.financeTransaction.findMany({
        where: { userId: user.id },
        select: { amount: true },
      }),
      prisma.task.count({
        where: { userId: user.id, status: "DONE", updatedAt: { gte: twoWeeksAgo, lt: oneWeekAgo } },
      }),
      prisma.task.aggregate({
        _sum: { actualMinutes: true },
        where: { userId: user.id, status: "DONE", updatedAt: { gte: oneWeekAgo } },
      }),
    ]);

    // Real week-on-week change and time actually logged on finished tasks (nothing invented)
    const weekChange =
      completedPrevWeek > 0
        ? `${completedTasksWeek >= completedPrevWeek ? "+" : ""}${Math.round(((completedTasksWeek - completedPrevWeek) / completedPrevWeek) * 100)}%`
        : completedTasksWeek > 0
        ? "New"
        : "0%";
    const workedTotal = workedMinutes._sum.actualMinutes ?? 0;
    const deepWork = `${Math.floor(workedTotal / 60)}h ${workedTotal % 60}m`;

    // Study sessions & learning breakdown
    const subjectHours: Record<string, number> = {};
    let totalLearningMinutes = 0;

    studySessions.forEach((s) => {
      const subjName = s.topic.subject.name;
      subjectHours[subjName] = (subjectHours[subjName] || 0) + s.durationMinutes;
      totalLearningMinutes += s.durationMinutes;
    });

    // Projects progress
    const projectVelocity = projects.map((p) => {
      const doneMilestones = p.milestones.filter((m) => m.isDone).length;
      const doneTasks = p.tasks.filter((t) => t.status === "DONE").length;
      return {
        id: p.id,
        name: p.name,
        progressPercent: p.progressPercent,
        completedTasks: doneTasks,
        totalTasks: p.tasks.length,
        completedMilestones: doneMilestones,
        totalMilestones: p.milestones.length,
      };
    });

    // Financial totals in KES
    let totalSpentKES = 0;
    let totalEarnedKES = 0;
    transactions.forEach((tx) => {
      if (tx.amount < 0) totalSpentKES += Math.abs(tx.amount);
      else totalEarnedKES += tx.amount;
    });

    return NextResponse.json({
      success: true,
      analytics: {
        tasksCompletedWeek: completedTasksWeek,
        tasksWeekChange: weekChange,
        activeTasksCount,
        deepWorkHours: deepWork,
        totalLearningHours: `${Math.floor(totalLearningMinutes / 60)}h ${totalLearningMinutes % 60}m`,
        subjectHours,
        totalSpentKES,
        totalEarnedKES,
        projectVelocity,
      },
    });
  } catch (error: any) {
    if (error instanceof ValidationError) return badRequest(error.message);
    console.error("Error generating analytics:", error);
    return NextResponse.json(
      { success: false, error: "Failed to generate analytics" },
      { status: 500 }
    );
  }
}
