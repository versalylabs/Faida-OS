import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const noCacheHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({
        success: false,
        urgentCount: 0,
        dueTodayCount: 0,
        informationalCount: 0,
      }, { status: 401, headers: noCacheHeaders });
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 86400000);

    // 1. Urgent Count: Overdue reminders + Urgent priority uncompleted tasks + Overdue tasks
    const [overdueReminders, urgentTasks, overdueTasks] = await Promise.all([
      prisma.reminder.count({
        where: {
          userId: user.id,
          isCompleted: false,
          dueAt: { lt: now },
        },
      }),
      prisma.task.count({
        where: {
          userId: user.id,
          status: { not: "DONE" },
          priority: "URGENT",
        },
      }),
      prisma.task.count({
        where: {
          userId: user.id,
          status: { not: "DONE" },
          dueDate: { lt: todayStart },
        },
      }),
    ]);

    const urgentCount = overdueReminders + urgentTasks + overdueTasks;

    // 2. Due Today Count: Reminders due today + tasks due today + CATs today
    const [dueTodayReminders, dueTodayTasks, dueTodayAssessments] = await Promise.all([
      prisma.reminder.count({
        where: {
          userId: user.id,
          isCompleted: false,
          dueAt: { gte: todayStart, lt: todayEnd },
        },
      }),
      prisma.task.count({
        where: {
          userId: user.id,
          status: { not: "DONE" },
          dueDate: { gte: todayStart, lt: todayEnd },
        },
      }),
      prisma.academicAssessment.count({
        where: {
          userId: user.id,
          isCompleted: false,
          date: { gte: todayStart, lt: todayEnd },
        },
      }),
    ]);

    const dueTodayCount = dueTodayReminders + dueTodayTasks + dueTodayAssessments;

    // 3. Informational count: Active projects + unchecked shopping items
    const [activeProjects, shoppingItems] = await Promise.all([
      prisma.project.count({
        where: {
          userId: user.id,
          status: "ACTIVE",
        },
      }),
      prisma.shoppingItem.count({
        where: {
          userId: user.id,
          isChecked: false,
        },
      }),
    ]);

    const informationalCount = activeProjects + shoppingItems;

    return NextResponse.json(
      {
        success: true,
        urgentCount,
        dueTodayCount,
        informationalCount,
      },
      { headers: noCacheHeaders }
    );
  } catch (error: any) {
    console.error("Error calculating attention counts:", error);
    return NextResponse.json(
      { success: false, urgentCount: 0, dueTodayCount: 0, informationalCount: 0 },
      { status: 500, headers: noCacheHeaders }
    );
  }
}
