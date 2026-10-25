import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

function inferFileType(filename: string, mimeType?: string): string {
  const ext = path.extname(filename).toLowerCase();
  if ([".png", ".jpg", ".jpeg", ".webp", ".svg", ".gif", ".ico"].includes(ext) || mimeType?.startsWith("image/")) {
    return "IMAGE";
  }
  if (ext === ".pdf" || mimeType === "application/pdf") {
    return "PDF";
  }
  if ([".ts", ".tsx", ".js", ".jsx", ".py", ".json", ".sql", ".html", ".css", ".rs", ".go", ".sh", ".yaml", ".yml"].includes(ext)) {
    return "CODE";
  }
  if ([".xlsx", ".xls", ".csv"].includes(ext)) {
    return "SPREADSHEET";
  }
  if ([".zip", ".tar", ".gz", ".7z", ".rar"].includes(ext)) {
    return "ARCHIVE";
  }
  if ([".mp4", ".mov", ".avi", ".mkv", ".mp3", ".wav", ".m4a"].includes(ext) || mimeType?.startsWith("video/") || mimeType?.startsWith("audio/")) {
    return "MEDIA";
  }
  return "DOCUMENT";
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 });
    }

    const category = (formData.get("category") as string) || "PROJECT_ASSET";
    const projectId = (formData.get("projectId") as string) || null;
    const tags = (formData.get("tags") as string) || null;
    const description = (formData.get("description") as string) || null;
    const customName = (formData.get("name") as string) || file.name;

    // Convert file to buffer and save in public/uploads/
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const cleanBaseName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const uniqueFileName = `${Date.now()}_${cleanBaseName}`;
    const destinationPath = path.join(uploadsDir, uniqueFileName);

    fs.writeFileSync(destinationPath, buffer);

    const publicFilePath = `/uploads/${uniqueFileName}`;
    const fileType = inferFileType(file.name, file.type);

    const created = await prisma.fileAsset.create({
      data: {
        userId: user.id,
        name: customName.trim(),
        filePath: publicFilePath,
        fileType,
        fileSize: file.size,
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

    return NextResponse.json({
      success: true,
      file: created,
      message: `File "${file.name}" uploaded successfully (${Math.round(file.size / 1024)} KB).`,
    });
  } catch (error: any) {
    console.error("Error uploading file asset:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to upload file" },
      { status: 500 }
    );
  }
}
