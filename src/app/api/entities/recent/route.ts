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
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    const entities = await prisma.entity.findMany({
      where: { userId: user.id },
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        task: true,
        reminder: true,
        note: true,
        project: true,
      },
    });

    return NextResponse.json({
      success: true,
      entities,
    });
  } catch (error: any) {
    console.error("Error fetching recent entities:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch entities" },
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
      return NextResponse.json({ success: false, error: "Missing entity id" }, { status: 400 });
    }

    const existing = await prisma.entity.findFirst({
      where: { id, userId: user.id },
    });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Entity not found" }, { status: 404 });
    }

    await prisma.entity.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting entity:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to delete entity" },
      { status: 500 }
    );
  }
}
