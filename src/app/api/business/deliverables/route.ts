import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const noCacheHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
};

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401, headers: noCacheHeaders });
    }

    const body = await req.json();
    const { businessId, clientId, title, description, priority = "MEDIUM", dueDate } = body;

    if (!businessId || !title) {
      return NextResponse.json(
        { success: false, error: "Business ID and deliverable title are required" },
        { status: 400, headers: noCacheHeaders }
      );
    }

    const deliverable = await prisma.businessDeliverable.create({
      data: {
        userId: user.id,
        businessId,
        clientId: clientId || null,
        title: title.trim(),
        description: description?.trim() || null,
        status: "PENDING",
        priority,
        dueDate: dueDate ? new Date(dueDate) : null,
      },
    });

    return NextResponse.json({ success: true, deliverable }, { headers: noCacheHeaders });
  } catch (error: any) {
    console.error("Error creating deliverable:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create deliverable" },
      { status: 500, headers: noCacheHeaders }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401, headers: noCacheHeaders });
    }

    const body = await req.json();
    const { id, status, title, description, priority, dueDate } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: "Deliverable ID is required" }, { status: 400, headers: noCacheHeaders });
    }

    const existing = await prisma.businessDeliverable.findFirst({
      where: { id, userId: user.id },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: "Deliverable not found" }, { status: 404, headers: noCacheHeaders });
    }

    const updateData: any = {};
    if (status !== undefined) {
      updateData.status = status;
      if (status === "COMPLETED") {
        updateData.completedAt = new Date();
      } else {
        updateData.completedAt = null;
      }
    }
    if (title !== undefined) updateData.title = title.trim();
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (priority !== undefined) updateData.priority = priority;
    if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;

    const updated = await prisma.businessDeliverable.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, deliverable: updated }, { headers: noCacheHeaders });
  } catch (error: any) {
    console.error("Error updating deliverable:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update deliverable" },
      { status: 500, headers: noCacheHeaders }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401, headers: noCacheHeaders });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, error: "Deliverable ID is required" }, { status: 400, headers: noCacheHeaders });
    }

    const existing = await prisma.businessDeliverable.findFirst({
      where: { id, userId: user.id },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: "Deliverable not found" }, { status: 404, headers: noCacheHeaders });
    }

    await prisma.businessDeliverable.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: "Deliverable deleted" }, { headers: noCacheHeaders });
  } catch (error: any) {
    console.error("Error deleting deliverable:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to delete deliverable" },
      { status: 500, headers: noCacheHeaders }
    );
  }
}
