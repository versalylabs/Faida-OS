import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { zonedNow } from "@/lib/tz";
import { ValidationError, badRequest } from "@/lib/validate";

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
    const { startOfDay: todayStart, endOfDay: todayEnd } = zonedNow(now);

    // 1. Urgent Count: Overdue reminders + Urgent priority uncompleted tasks + Overdue tasks
    // All eight counts are independent, so start them together: one database round trip, not three.
    const group1 = Promise.all([
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

    // 2. Due Today Count: Reminders due today + tasks due today + CATs today
    const group2 = Promise.all([
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

    // 3. Informational count: Active projects + unchecked shopping items
    const group3 = Promise.all([
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

    const [[overdueReminders, urgentTasks, overdueTasks], [dueTodayReminders, dueTodayTasks, dueTodayAssessments], [activeProjects, shoppingItems]] =
      await Promise.all([group1, group2, group3]);
    const urgentCount = overdueReminders + urgentTasks + overdueTasks;
    const dueTodayCount = dueTodayReminders + dueTodayTasks + dueTodayAssessments;
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
    if (error instanceof ValidationError) return badRequest(error.message);
    console.error("Error calculating attention counts:", error);
    return NextResponse.json(
      { success: false, urgentCount: 0, dueTodayCount: 0, informationalCount: 0 },
      { status: 500, headers: noCacheHeaders }
    );
  }
}
