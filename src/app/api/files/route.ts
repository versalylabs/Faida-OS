import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { cleanText, FILE_CATEGORIES, FILE_TYPES, normalizeEnum, resolveOwnedProjectId } from "@/lib/files";

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

    const body = await req.json().catch(() => null);
    const name = cleanText(body?.name, 200);
    const filePath = cleanText(body?.filePath, 500);

    if (!name || !filePath) {
      return NextResponse.json(
        { success: false, error: "Name and file path are required" },
        { status: 400 }
      );
    }

    const projectId = await resolveOwnedProjectId(user.id, body?.projectId);
    if (projectId === undefined) {
      return NextResponse.json({ success: false, error: "Project not found" }, { status: 404 });
    }

    const rawSize = body?.fileSize === null || body?.fileSize === undefined || body?.fileSize === "" ? null : Number(body.fileSize);
    if (rawSize !== null && (!Number.isFinite(rawSize) || rawSize < 0 || rawSize > 2_000_000_000)) {
      return NextResponse.json({ success: false, error: "Invalid file size" }, { status: 400 });
    }

    const created = await prisma.fileAsset.create({
      data: {
        userId: user.id,
        name,
        filePath,
        fileType: normalizeEnum(body?.fileType, FILE_TYPES, "DOCUMENT"),
        fileSize: rawSize === null ? null : Math.round(rawSize),
        category: normalizeEnum(body?.category, FILE_CATEGORIES, "PROJECT_ASSET"),
        projectId,
        tags: cleanText(body?.tags, 300),
        description: cleanText(body?.description, 1000),
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
