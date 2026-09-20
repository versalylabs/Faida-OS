import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    // JavaScript getDay(): 0 is Sunday, 1 is Monday.
    // Convert to ISO 1 (Monday) to 7 (Sunday):
    const currentDayOfWeek = now.getDay() === 0 ? 7 : now.getDay();
    const currentHours = now.getHours();
    const currentMinutes = now.getMinutes();
    const currentTimeMinutes = currentHours * 60 + currentMinutes;

    const [courses, allWeeklyClasses, assignments, assessments, announcements] =
      await Promise.all([
        prisma.universityCourse.findMany({
          where: { userId: user.id, status: "ACTIVE" },
          include: {
            _count: {
              select: {
                assignments: true,
                assessments: true,
                classes: true,
                materials: true,
              },
            },
          },
          orderBy: { code: "asc" },
        }),
        prisma.academicClass.findMany({
          where: { userId: user.id },
          include: {
            course: { select: { id: true, code: true, name: true, color: true } },
          },
          orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
        }),
        prisma.task.findMany({
          where: {
            userId: user.id,
            isAcademic: true,
            status: { not: "DONE" },
          },
          include: {
            course: { select: { id: true, code: true, name: true, color: true } },
            subtasks: true,
          },
          orderBy: [{ dueDate: "asc" }, { priority: "desc" }],
        }),
        prisma.academicAssessment.findMany({
          where: {
            userId: user.id,
            isCompleted: false,
            date: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
          },
          include: {
            course: { select: { id: true, code: true, name: true, color: true } },
          },
          orderBy: { date: "asc" },
        }),
        prisma.academicAnnouncement.findMany({
          where: { userId: user.id },
          include: {
            course: { select: { id: true, code: true, name: true } },
          },
          orderBy: { publishedAt: "desc" },
          take: 5,
        }),
      ]);

    // 1. Today's Classes & Next Class
    const todayClasses = allWeeklyClasses.filter((c) => c.dayOfWeek === currentDayOfWeek);

    let nextClass: any = null;
    let nextClassMinutesRemaining: number | null = null;

    for (const c of todayClasses) {
      const [sh, sm] = c.startTime.split(":").map(Number);
      const classStartMinutes = sh * 60 + sm;
      if (classStartMinutes > currentTimeMinutes) {
        nextClass = c;
        nextClassMinutesRemaining = classStartMinutes - currentTimeMinutes;
        break;
      }
    }

    // 2. Due Soon Assignments (Sorted, calculated days left & subtask completion %)
    const dueSoonAssignments = assignments.slice(0, 6).map((a) => {
      let daysRemaining: number | null = null;
      let hoursRemaining: number | null = null;
      if (a.dueDate) {
        const diffMs = new Date(a.dueDate).getTime() - now.getTime();
        daysRemaining = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
        hoursRemaining = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60)));
      }

      const totalSubtasks = a.subtasks.length;
      const completedSubtasks = a.subtasks.filter((s) => s.isDone).length;
      const progressPercent =
        totalSubtasks > 0 ? Math.round((completedSubtasks / totalSubtasks) * 100) : 0;

      return {
        ...a,
        daysRemaining,
        hoursRemaining,
        progressPercent,
      };
    });

    // 3. Upcoming CATs & Exams
    const upcomingAssessments = assessments.slice(0, 5).map((ass) => {
      const diffMs = new Date(ass.date).getTime() - now.getTime();
      const daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
      return {
        ...ass,
        daysRemaining,
      };
    });

    // 4. Academic Workload & Spikes
    const totalWeeklyClassHours = allWeeklyClasses.reduce((acc, c) => {
      const [sh, sm] = c.startTime.split(":").map(Number);
      const [eh, em] = c.endTime.split(":").map(Number);
      const durationHours = (eh * 60 + em - (sh * 60 + sm)) / 60;
      return acc + Math.max(0, durationHours);
    }, 0);

    const totalAssignmentHours = assignments.reduce(
      (acc, a) => acc + (a.estimatedMinutes || 60) / 60,
      0
    );

    const totalCATPrepHours = assessments.reduce(
      (acc, ass) => acc + (ass.estimatedEffortHours || 4),
      0
    );

    const totalEstimatedWorkHours =
      Math.round((totalWeeklyClassHours + totalAssignmentHours + totalCATPrepHours) * 10) / 10;

    // Normal full-time workload capacity baseline ~35 hours/week
    const maxCapacityHours = 35;
    const workloadPercentage = Math.min(
      100,
      Math.round((totalEstimatedWorkHours / maxCapacityHours) * 100)
    );

    // Spike alert if 2+ assignments/CATs due in next 4 days
    const upcomingDeadlinesIn4Days = [
      ...assignments.filter(
        (a) =>
          a.dueDate &&
          new Date(a.dueDate).getTime() - now.getTime() < 4 * 24 * 60 * 60 * 1000 &&
          new Date(a.dueDate).getTime() > now.getTime()
      ),
      ...assessments.filter(
        (ass) =>
          new Date(ass.date).getTime() - now.getTime() < 4 * 24 * 60 * 60 * 1000 &&
          new Date(ass.date).getTime() > now.getTime()
      ),
    ];

    const hasWorkloadSpike = upcomingDeadlinesIn4Days.length >= 2;

    // 5. Low-Energy University Batch (Lightweight academic wins)
    const lowEnergyCandidates = assignments.filter(
      (a) => (a.estimatedMinutes || 30) <= 20 || a.title.toLowerCase().includes("read") || a.title.toLowerCase().includes("download")
    );

    const lowEnergyBatch = [
      ...lowEnergyCandidates.slice(0, 3).map((t) => ({
        id: t.id,
        title: t.title,
        durationMinutes: t.estimatedMinutes,
        courseCode: t.course?.code || "Academic",
        type: "TASK" as const,
      })),
      ...(todayClasses.length > 0
        ? [
            {
              id: "prep-" + todayClasses[0].id,
              title: `Review slides & notes for ${todayClasses[0].course.code}`,
              durationMinutes: 10,
              courseCode: todayClasses[0].course.code,
              type: "PREP" as const,
            },
          ]
        : []),
      {
        id: "organize-refs",
        title: "Organize academic references & downloads",
        durationMinutes: 8,
        courseCode: "BSc AC",
        type: "BATCH" as const,
      },
    ].slice(0, 4);

    return NextResponse.json({
      success: true,
      todayClasses,
      nextClass,
      nextClassMinutesRemaining,
      dueSoonAssignments,
      upcomingAssessments,
      workload: {
        totalWeeklyClassHours: Math.round(totalWeeklyClassHours * 10) / 10,
        totalAssignmentHours: Math.round(totalAssignmentHours * 10) / 10,
        totalCATPrepHours: Math.round(totalCATPrepHours * 10) / 10,
        totalEstimatedWorkHours,
        workloadPercentage,
        hasWorkloadSpike,
        upcomingDeadlinesIn4DaysCount: upcomingDeadlinesIn4Days.length,
      },
      lowEnergyBatch,
      courses,
      announcements,
    });
  } catch (error: any) {
    console.error("Error fetching academic dashboard:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch academic dashboard" },
      { status: 500 }
    );
  }
}
