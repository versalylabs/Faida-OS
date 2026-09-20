import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

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
    console.error("Error fetching university courses:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch courses" },
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

    const body = await req.json();
    const { code, name, lecturer, lecturerEmail, semester, color, credits } = body;

    if (!code || !name) {
      return NextResponse.json(
        { success: false, error: "Course code and course name are required" },
        { status: 400 }
      );
    }

    const course = await prisma.universityCourse.create({
      data: {
        userId: user.id,
        code: code.trim().toUpperCase(),
        name: name.trim(),
        lecturer: lecturer?.trim() || null,
        lecturerEmail: lecturerEmail?.trim() || null,
        semester: semester?.trim() || "Year 2 Sem 1",
        color: color || "#3b82f6",
        credits: parseInt(credits, 10) || 3,
        status: "ACTIVE",
        sourceSystem: "MANUAL",
      },
    });

    return NextResponse.json({ success: true, course });
  } catch (error: any) {
    console.error("Error creating university course:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create course" },
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

    const body = await req.json();
    const { id, code, name, lecturer, lecturerEmail, semester, color, credits, status } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: "Course ID is required" }, { status: 400 });
    }

    const existing = await prisma.universityCourse.findFirst({
      where: { id, userId: user.id },
    });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Course not found" }, { status: 404 });
    }

    const updated = await prisma.universityCourse.update({
      where: { id },
      data: {
        ...(code !== undefined && { code: code.trim().toUpperCase() }),
        ...(name !== undefined && { name: name.trim() }),
        ...(lecturer !== undefined && { lecturer: lecturer?.trim() || null }),
        ...(lecturerEmail !== undefined && { lecturerEmail: lecturerEmail?.trim() || null }),
        ...(semester !== undefined && { semester: semester?.trim() || null }),
        ...(color !== undefined && { color }),
        ...(credits !== undefined && { credits: parseInt(credits, 10) }),
        ...(status !== undefined && { status }),
      },
    });

    return NextResponse.json({ success: true, course: updated });
  } catch (error: any) {
    console.error("Error updating university course:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update course" },
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
    console.error("Error deleting university course:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to delete course" },
      { status: 500 }
    );
  }
}
