import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const projectId = searchParams.get("projectId");
    const query = searchParams.get("query");

    const where: any = { userId: user.id };
    if (category && category !== "ALL") where.category = category;
    if (projectId && projectId !== "ALL") where.projectId = projectId;
    if (query) {
      where.OR = [
        { name: { contains: query } },
        { description: { contains: query } },
        { tags: { contains: query } },
        { filePath: { contains: query } },
      ];
    }

    const files = await prisma.fileAsset.findMany({
      where,
      include: {
        project: {
          select: { id: true, name: true, color: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const projects = await prisma.project.findMany({
      where: { userId: user.id },
      select: { id: true, name: true, color: true },
      orderBy: { name: "asc" },
    });

    // Compute File Metrics scoped to user
    const allFiles = await prisma.fileAsset.findMany({
      where: { userId: user.id },
    });
    const totalBytes = allFiles.reduce((acc, f) => acc + (f.fileSize || 0), 0);
    const categoryCounts: { [cat: string]: number } = {};
    for (const f of allFiles) {
      categoryCounts[f.category] = (categoryCounts[f.category] || 0) + 1;
    }

    return NextResponse.json({
      success: true,
      files,
      projects,
      metrics: {
        totalFiles: allFiles.length,
        totalBytes,
        categoryCounts,
      },
    });
  } catch (error: any) {
    console.error("Error fetching file assets:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch files" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      name,
      filePath,
      fileType = "DOCUMENT",
      fileSize,
      category = "PROJECT_ASSET",
      projectId,
      tags,
      description,
    } = body;

    if (!name || !filePath) {
      return NextResponse.json(
        { success: false, error: "Name and file path are required" },
        { status: 400 }
      );
    }

    const created = await prisma.fileAsset.create({
      data: {
        userId: user.id,
        name: name.trim(),
        filePath: filePath.trim(),
        fileType: fileType.toUpperCase(),
        fileSize: fileSize ? parseInt(fileSize.toString(), 10) : null,
        category: category.toUpperCase(),
        projectId: projectId || null,
        tags: tags ? tags.trim() : null,
        description: description ? description.trim() : null,
      },
      include: {
        project: {
          select: { id: true, name: true, color: true },
        },
      },
    });

    return NextResponse.json({ success: true, file: created });
  } catch (error: any) {
    console.error("Error creating file asset:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create file asset" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "File ID is required" },
        { status: 400 }
      );
    }

    const existing = await prisma.fileAsset.findFirst({
      where: { id, userId: user.id },
    });
    if (!existing) {
      return NextResponse.json({ success: false, error: "File not found" }, { status: 404 });
    }

    await prisma.fileAsset.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting file asset:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to delete file asset" },
      { status: 500 }
    );
  }
}
