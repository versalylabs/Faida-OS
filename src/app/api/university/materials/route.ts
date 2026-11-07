import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ValidationError, badRequest, httpUrl, idOf, must, num, readBody, str } from "@/lib/validate";

// GET /api/university/materials - Fetch course materials
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const courseId = searchParams.get("courseId");

    const where: any = { userId: user.id };
    if (courseId && courseId !== "ALL") where.courseId = courseId;

    const materials = await prisma.academicMaterial.findMany({
      where,
      include: {
        course: { select: { id: true, code: true, name: true, color: true } },
      },
      orderBy: [{ weekNumber: "desc" }, { createdAt: "desc" }],
    });

    return NextResponse.json({ success: true, materials });
  } catch (error: any) {
    if (error instanceof ValidationError) return badRequest(error.message);
    console.error("Error fetching academic materials:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch materials" },
      { status: 500 }
    );
  }
}

// POST /api/university/materials - Add course material or lecture note
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await readBody(req);
    const { courseId, title, type, content, fileUrl, weekNumber, summary, createSecondBrainNote } = body;

    const linkedCourseId = must(idOf(courseId), "Course is required");
    const cleanTitle = must(str(title, { max: 300, required: true }), "Title is required (max 300 characters)");
    const cleanType = must(str(type, { max: 40 }), "Invalid type") ?? "NOTES";
    const cleanContent = must(str(content, { max: 200000 }), "Content is too long");
    const cleanFileUrl = must(httpUrl(fileUrl), "File URL must start with http:// or https://");
    const cleanWeek = must(num(weekNumber, { min: 0, max: 60, int: true }), "Week number must be between 0 and 60");
    const cleanSummary = must(str(summary, { max: 20000 }), "Summary is too long");

    const course = await prisma.universityCourse.findFirst({
      where: { id: linkedCourseId, userId: user.id },
    });
    if (!course) {
      return NextResponse.json({ success: false, error: "Course not found" }, { status: 404 });
    }

    const material = await prisma.academicMaterial.create({
      data: {
        userId: user.id,
        courseId: linkedCourseId,
        title: cleanTitle,
        type: cleanType,
        content: cleanContent,
        fileUrl: cleanFileUrl,
        weekNumber: cleanWeek,
        summary: cleanSummary,
      },
      include: {
        course: { select: { id: true, code: true, name: true, color: true } },
      },
    });

    // Optionally create a connected Note in Second Brain
    if (createSecondBrainNote && cleanContent) {
      const entity = await prisma.entity.create({
        data: {
          userId: user.id,
          type: "NOTE",
          title: `${course.code}: ${material.title}`,
          content: cleanContent,
          status: "ACTIVE",
        },
      });

      await prisma.note.create({
        data: {
          userId: user.id,
          entityId: entity.id,
          courseId: course.id,
          title: `${course.code}: ${material.title}`,
          content: cleanContent,
          category: "University",
          tags: `${course.code}, academic, week-${cleanWeek || 1}`,
        },
      });
    }

    return NextResponse.json({ success: true, material });
  } catch (error: any) {
    if (error instanceof ValidationError) return badRequest(error.message);
    console.error("Error creating academic material:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create material" },
      { status: 500 }
    );
  }
}

// DELETE /api/university/materials - Delete material
export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, error: "Material ID required" }, { status: 400 });
    }

    const existing = await prisma.academicMaterial.findFirst({
      where: { id, userId: user.id },
    });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Material not found" }, { status: 404 });
    }

    await prisma.academicMaterial.delete({ where: { id } });

    return NextResponse.json({ success: true, message: "Material deleted" });
  } catch (error: any) {
    if (error instanceof ValidationError) return badRequest(error.message);
    console.error("Error deleting academic material:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete material" },
      { status: 500 }
    );
  }
}
