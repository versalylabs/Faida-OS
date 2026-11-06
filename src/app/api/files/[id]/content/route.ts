import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { isInlineSafe } from "@/lib/files";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const asset = await prisma.fileAsset.findFirst({
      where: { id, userId: user.id },
      select: { name: true, blob: { select: { data: true, mimeType: true } } },
    });

    if (!asset || !asset.blob) {
      return NextResponse.json({ success: false, error: "File not found" }, { status: 404 });
    }

    const forceDownload = new URL(req.url).searchParams.get("download") === "1";
    const inline = !forceDownload && isInlineSafe(asset.blob.mimeType);
    const safeName = asset.name.replace(/[^\w.\- ]/g, "_").slice(0, 150) || "file";
    const contentType = inline ? asset.blob.mimeType : "application/octet-stream";

    return new NextResponse(new Uint8Array(asset.blob.data), {
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(asset.blob.data.length),
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${safeName}"`,
        "X-Content-Type-Options": "nosniff",
        // The PDF viewer breaks under a sandboxed CSP; every other type here is inert.
        "Content-Security-Policy":
          inline && contentType === "application/pdf"
            ? "default-src 'none'"
            : "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("Error serving file:", error);
    return NextResponse.json({ success: false, error: "Failed to load file" }, { status: 500 });
  }
}
