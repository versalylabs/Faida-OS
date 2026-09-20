import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// GET /api/university/classes - Fetch timetable classes
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const day = searchParams.get("day"); // 1-7

    const where: any = { userId: user.id };
    if (day) where.dayOfWeek = parseInt(day, 10);

    const classes = await prisma.academicClass.findMany({
      where,
      include: {
        course: { select: { id: true, code: true, name: true, color: true } },
      },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    });

    return NextResponse.json({ success: true, classes });
  } catch (error: any) {
    console.error("Error fetching academic classes:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch classes" },
      { status: 500 }
    );
  }
}

// POST /api/university/classes - Create a class schedule item
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { courseId, title, dayOfWeek, startTime, endTime, location, lecturer } = body;

    if (!courseId || dayOfWeek === undefined || !startTime || !endTime) {
      return NextResponse.json(
        { success: false, error: "Course, day of week, start time, and end time are required" },
        { status: 400 }
      );
    }

    const course = await prisma.universityCourse.findFirst({
      where: { id: courseId, userId: user.id },
    });
    if (!course) {
      return NextResponse.json({ success: false, error: "Course not found" }, { status: 404 });
    }

    const academicClass = await prisma.academicClass.create({
      data: {
        userId: user.id,
        courseId,
        title: title?.trim() || "Lecture",
        dayOfWeek: parseInt(dayOfWeek, 10),
        startTime: startTime.trim(),
        endTime: endTime.trim(),
        location: location?.trim() || null,
        lecturer: lecturer?.trim() || course.lecturer || null,
      },
      include: {
        course: { select: { id: true, code: true, name: true, color: true } },
      },
    });

    return NextResponse.json({ success: true, classItem: academicClass });
  } catch (error: any) {
    console.error("Error creating academic class:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create class" },
      { status: 500 }
    );
  }
}

// PATCH /api/university/classes - Edit class schedule item
export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { id, title, dayOfWeek, startTime, endTime, location, lecturer, courseId } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: "Class ID required" }, { status: 400 });
    }

    const existing = await prisma.academicClass.findFirst({
      where: { id, userId: user.id },
    });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Class not found" }, { status: 404 });
    }

    const updated = await prisma.academicClass.update({
      where: { id },
      data: {
        ...(title !== undefined && { title: title.trim() }),
        ...(dayOfWeek !== undefined && { dayOfWeek: parseInt(dayOfWeek, 10) }),
        ...(startTime !== undefined && { startTime }),
        ...(endTime !== undefined && { endTime }),
        ...(location !== undefined && { location }),
        ...(lecturer !== undefined && { lecturer }),
        ...(courseId !== undefined && { courseId }),
      },
      include: {
        course: { select: { id: true, code: true, name: true, color: true } },
      },
    });

    return NextResponse.json({ success: true, classItem: updated });
  } catch (error: any) {
    console.error("Error updating academic class:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update class" },
      { status: 500 }
    );
  }
}

// DELETE /api/university/classes - Delete class
export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, error: "Class ID required" }, { status: 400 });
    }

    const existing = await prisma.academicClass.findFirst({
      where: { id, userId: user.id },
    });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Class not found" }, { status: 404 });
    }

    await prisma.academicClass.delete({ where: { id } });

    return NextResponse.json({ success: true, message: "Class deleted" });
  } catch (error: any) {
    console.error("Error deleting academic class:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to delete class" },
      { status: 500 }
    );
  }
}
