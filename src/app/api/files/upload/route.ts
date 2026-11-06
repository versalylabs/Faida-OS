import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import {
  cleanText,
  FILE_CATEGORIES,
  inferFileType,
  MAX_UPLOAD_BYTES,
  normalizeEnum,
  resolveOwnedProjectId,
} from "@/lib/files";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const declaredLength = Number(req.headers.get("content-length") || 0);
    if (declaredLength > MAX_UPLOAD_BYTES + 64 * 1024) {
      return NextResponse.json(
        { success: false, error: `File is too large. The limit is ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB.` },
        { status: 413 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 });
    }
    if (file.size === 0) {
      return NextResponse.json({ success: false, error: "The file is empty" }, { status: 400 });
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { success: false, error: `File is too large. The limit is ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB.` },
        { status: 413 }
      );
    }

    const projectId = await resolveOwnedProjectId(user.id, formData.get("projectId"));
    if (projectId === undefined) {
      return NextResponse.json({ success: false, error: "Project not found" }, { status: 404 });
    }

    const originalName = file.name.slice(0, 200) || "upload";
    const displayName = cleanText(formData.get("name"), 200) ?? originalName;
    const category = normalizeEnum(formData.get("category"), FILE_CATEGORIES, "PROJECT_ASSET");
    const tags = cleanText(formData.get("tags"), 300);
    const description = cleanText(formData.get("description"), 1000);
    const mimeType = (file.type || "application/octet-stream").slice(0, 100);

    const buffer = Buffer.from(await file.arrayBuffer());
    const id = randomUUID();

    const created = await prisma.fileAsset.create({
      data: {
        id,
        userId: user.id,
        name: displayName,
        // Served only through the authenticated content route.
        filePath: `/api/files/${id}/content`,
        fileType: inferFileType(originalName, file.type),
        fileSize: file.size,
        category,
        projectId,
        tags,
        description,
        blob: { create: { data: buffer, mimeType } },
      },
      include: {
        project: { select: { id: true, name: true, color: true } },
      },
    });

    return NextResponse.json({
      success: true,
      file: created,
      message: `File "${originalName}" uploaded successfully (${Math.round(file.size / 1024)} KB).`,
    });
  } catch (error) {
    console.error("Error uploading file asset:", error);
    return NextResponse.json({ success: false, error: "Failed to upload file" }, { status: 500 });
  }
}
