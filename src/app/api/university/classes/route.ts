import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ValidationError, badRequest, clockTime, idOf, must, num, ownedId, readBody, str } from "@/lib/validate";

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
    if (error instanceof ValidationError) return badRequest(error.message);
    console.error("Error fetching academic classes:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch classes" },
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

    const body = await readBody(req);
    const { courseId, title, dayOfWeek, startTime, endTime, location, lecturer } = body;

    const linkedCourseId = must(idOf(courseId), "Course is required");
    const cleanDay = must(num(dayOfWeek, { min: 0, max: 6, int: true, required: true }), "Day of week must be a number from 0 to 6");
    const cleanStart = must(clockTime(startTime), "Start time must look like 09:00") ?? (() => { throw new ValidationError("Start time is required"); })();
    const cleanEnd = must(clockTime(endTime), "End time must look like 11:00") ?? (() => { throw new ValidationError("End time is required"); })();
    const cleanTitle = must(str(title, { max: 200 }), "Title is too long") ?? "Lecture";
    const cleanLocation = must(str(location, { max: 200 }), "Location is too long");
    const cleanLecturer = must(str(lecturer, { max: 120 }), "Lecturer name is too long");

    const course = await prisma.universityCourse.findFirst({
      where: { id: linkedCourseId, userId: user.id },
    });
    if (!course) {
      return NextResponse.json({ success: false, error: "Course not found" }, { status: 404 });
    }

    const academicClass = await prisma.academicClass.create({
      data: {
        userId: user.id,
        courseId: linkedCourseId,
        title: cleanTitle,
        dayOfWeek: cleanDay,
        startTime: cleanStart,
        endTime: cleanEnd,
        location: cleanLocation,
        lecturer: cleanLecturer || course.lecturer || null,
      },
      include: {
        course: { select: { id: true, code: true, name: true, color: true } },
      },
    });

    return NextResponse.json({ success: true, classItem: academicClass });
  } catch (error: any) {
    if (error instanceof ValidationError) return badRequest(error.message);
    console.error("Error creating academic class:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create class" },
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

    const body = await readBody(req);
    const { id, title, dayOfWeek, startTime, endTime, location, lecturer, courseId } = body;

    const classId = must(idOf(id), "Class ID required");
    const pTitle = title !== undefined ? must(str(title, { max: 200, required: true }), "Title is required (max 200 characters)") : undefined;
    const pDay = dayOfWeek !== undefined ? must(num(dayOfWeek, { min: 0, max: 6, int: true, required: true }), "Day of week must be a number from 0 to 6") : undefined;
    const pStart = startTime !== undefined ? must(clockTime(startTime), "Start time must look like 09:00") : undefined;
    const pEnd = endTime !== undefined ? must(clockTime(endTime), "End time must look like 11:00") : undefined;
    const pLocation = location !== undefined ? must(str(location, { max: 200 }), "Location is too long") : undefined;
    const pLecturer = lecturer !== undefined ? must(str(lecturer, { max: 120 }), "Lecturer name is too long") : undefined;
    let pCourseId: string | null | undefined;
    if (courseId !== undefined) {
      pCourseId = await ownedId("universityCourse", user.id, courseId);
      if (!pCourseId) return NextResponse.json({ success: false, error: "Course not found" }, { status: 404 });
    }

    const existing = await prisma.academicClass.findFirst({
      where: { id: classId, userId: user.id },
    });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Class not found" }, { status: 404 });
    }

    const updated = await prisma.academicClass.update({
      where: { id: classId },
      data: {
        ...(pTitle !== undefined && { title: pTitle }),
        ...(pDay !== undefined && { dayOfWeek: pDay }),
        ...(pStart && { startTime: pStart }),
        ...(pEnd && { endTime: pEnd }),
        ...(pLocation !== undefined && { location: pLocation }),
        ...(pLecturer !== undefined && { lecturer: pLecturer }),
        ...(pCourseId && { courseId: pCourseId }),
      },
      include: {
        course: { select: { id: true, code: true, name: true, color: true } },
      },
    });

    return NextResponse.json({ success: true, classItem: updated });
  } catch (error: any) {
    if (error instanceof ValidationError) return badRequest(error.message);
    console.error("Error updating academic class:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update class" },
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
    if (error instanceof ValidationError) return badRequest(error.message);
    console.error("Error deleting academic class:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete class" },
      { status: 500 }
    );
  }
}
