import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ValidationError, badRequest, color, email, idOf, must, num, readBody, str } from "@/lib/validate";

// GET /api/university/courses - List all university courses
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const courses = await prisma.universityCourse.findMany({
      where: { userId: user.id },
      include: {
        assignments: {
          where: { isAcademic: true },
          orderBy: { dueDate: "asc" },
        },
        assessments: {
          orderBy: { date: "asc" },
        },
        classes: {
          orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
        },
        materials: {
          orderBy: { weekNumber: "desc" },
        },
        announcements: {
          orderBy: { publishedAt: "desc" },
          take: 5,
        },
      },
      orderBy: { code: "asc" },
    });

    return NextResponse.json({ success: true, courses });
  } catch (error: any) {
    if (error instanceof ValidationError) return badRequest(error.message);
    console.error("Error fetching university courses:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch courses" },
      { status: 500 }
    );
  }
}

// POST /api/university/courses - Create a new university course
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await readBody(req);
    const { code, name, lecturer, lecturerEmail, semester, color: colorIn, credits } = body;

    const cleanCode = must(str(code, { max: 30, required: true }), "Course code is required (max 30 characters)").toUpperCase();
    const cleanName = must(str(name, { max: 200, required: true }), "Course name is required (max 200 characters)");
    const cleanLecturer = must(str(lecturer, { max: 120 }), "Lecturer name is too long");
    const cleanLecturerEmail = must(email(lecturerEmail), "Lecturer email is invalid");
    const cleanSemester = must(str(semester, { max: 80 }), "Semester is too long") ?? "Year 2 Sem 1";
    const cleanColor = must(color(colorIn), "Color must be a hex value like #3b82f6") ?? "#3b82f6";
    const cleanCredits = must(num(credits, { min: 0, max: 60, int: true }), "Credits must be a whole number between 0 and 60") ?? 3;

    const course = await prisma.universityCourse.create({
      data: {
        userId: user.id,
        code: cleanCode,
        name: cleanName,
        lecturer: cleanLecturer,
        lecturerEmail: cleanLecturerEmail,
        semester: cleanSemester,
        color: cleanColor,
        credits: cleanCredits,
        status: "ACTIVE",
        sourceSystem: "MANUAL",
      },
    });

    return NextResponse.json({ success: true, course });
  } catch (error: any) {
    if (error instanceof ValidationError) return badRequest(error.message);
    console.error("Error creating university course:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create course" },
      { status: 500 }
    );
  }
}

// PATCH /api/university/courses - Edit a course
export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await readBody(req);
    const { id, code, name, lecturer, lecturerEmail, semester, color: colorIn, credits, status } = body;

    const courseId = must(idOf(id), "Course ID is required");
    const pCode = code !== undefined ? must(str(code, { max: 30, required: true }), "Course code is required (max 30 characters)").toUpperCase() : undefined;
    const pName = name !== undefined ? must(str(name, { max: 200, required: true }), "Course name is required (max 200 characters)") : undefined;
    const pLecturer = lecturer !== undefined ? must(str(lecturer, { max: 120 }), "Lecturer name is too long") : undefined;
    const pLecturerEmail = lecturerEmail !== undefined ? must(email(lecturerEmail), "Lecturer email is invalid") : undefined;
    const pSemester = semester !== undefined ? must(str(semester, { max: 80 }), "Semester is too long") : undefined;
    const pColor = colorIn !== undefined ? must(color(colorIn), "Color must be a hex value like #3b82f6") : undefined;
    const pCredits = credits !== undefined ? must(num(credits, { min: 0, max: 60, int: true, required: true }), "Credits must be a whole number between 0 and 60") : undefined;
    const pStatus = status !== undefined ? must(str(status, { max: 40, required: true }), "Invalid status") : undefined;

    const existing = await prisma.universityCourse.findFirst({
      where: { id: courseId, userId: user.id },
    });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Course not found" }, { status: 404 });
    }

    const updated = await prisma.universityCourse.update({
      where: { id: courseId },
      data: {
        ...(pCode !== undefined && { code: pCode }),
        ...(pName !== undefined && { name: pName }),
        ...(pLecturer !== undefined && { lecturer: pLecturer }),
        ...(pLecturerEmail !== undefined && { lecturerEmail: pLecturerEmail }),
        ...(pSemester !== undefined && { semester: pSemester }),
        ...(pColor && { color: pColor }),
        ...(pCredits !== undefined && { credits: pCredits }),
        ...(pStatus !== undefined && { status: pStatus }),
      },
    });

    return NextResponse.json({ success: true, course: updated });
  } catch (error: any) {
    if (error instanceof ValidationError) return badRequest(error.message);
    console.error("Error updating university course:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update course" },
      { status: 500 }
    );
  }
}

// DELETE /api/university/courses - Delete a course
export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, error: "Course ID is required" }, { status: 400 });
    }

    const existing = await prisma.universityCourse.findFirst({
      where: { id, userId: user.id },
    });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Course not found" }, { status: 404 });
    }

    await prisma.universityCourse.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: "Course deleted successfully" });
  } catch (error: any) {
    if (error instanceof ValidationError) return badRequest(error.message);
    console.error("Error deleting university course:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete course" },
      { status: 500 }
    );
  }
}
