import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

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
    console.error("Error fetching academic materials:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch materials" },
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

    const body = await req.json();
    const { courseId, title, type, content, fileUrl, weekNumber, summary, createSecondBrainNote } = body;

    if (!courseId || !title) {
      return NextResponse.json(
        { success: false, error: "Course and title are required" },
        { status: 400 }
      );
    }

    const course = await prisma.universityCourse.findFirst({
      where: { id: courseId, userId: user.id },
    });
    if (!course) {
      return NextResponse.json({ success: false, error: "Course not found" }, { status: 404 });
    }

    const material = await prisma.academicMaterial.create({
      data: {
        userId: user.id,
        courseId,
        title: title.trim(),
        type: type || "NOTES",
        content: content || null,
        fileUrl: fileUrl || null,
        weekNumber: weekNumber ? parseInt(weekNumber, 10) : null,
        summary: summary || null,
      },
      include: {
        course: { select: { id: true, code: true, name: true, color: true } },
      },
    });

    // Optionally create a connected Note in Second Brain
    if (createSecondBrainNote && content) {
      const entity = await prisma.entity.create({
        data: {
          userId: user.id,
          type: "NOTE",
          title: `${course.code}: ${material.title}`,
          content: content,
          status: "ACTIVE",
        },
      });

      await prisma.note.create({
        data: {
          userId: user.id,
          entityId: entity.id,
          courseId: course.id,
          title: `${course.code}: ${material.title}`,
          content: content,
          category: "University",
          tags: `${course.code}, academic, week-${weekNumber || 1}`,
        },
      });
    }

    return NextResponse.json({ success: true, material });
  } catch (error: any) {
    console.error("Error creating academic material:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create material" },
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
    console.error("Error deleting academic material:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to delete material" },
      { status: 500 }
    );
  }
}
