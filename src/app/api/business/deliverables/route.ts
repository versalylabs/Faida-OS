import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ValidationError, badRequest, date, must, notFound, ownedId, readBody, str } from "@/lib/validate";

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

    const body = await readBody(req);
    const { businessId, clientId, title, description, priority = "MEDIUM", dueDate } = body;

    const cleanTitle = must(str(title, { max: 200, required: true }), "Deliverable title is required (max 200 characters)");
    const ownedBusinessId = await ownedId("business", user.id, businessId);
    if (!ownedBusinessId) return notFound("Business not found", noCacheHeaders);
    const ownedClientId = await ownedId("businessClient", user.id, clientId);
    if (ownedClientId === undefined) return notFound("Client not found", noCacheHeaders);

    const deliverable = await prisma.businessDeliverable.create({
      data: {
        userId: user.id,
        businessId: ownedBusinessId,
        clientId: ownedClientId,
        title: cleanTitle,
        description: must(str(description, { max: 5000 }), "Description is too long"),
        status: "PENDING",
        priority: must(str(priority, { max: 40 }), "Invalid priority") ?? "MEDIUM",
        dueDate: must(date(dueDate), "Due date is invalid"),
      },
    });

    return NextResponse.json({ success: true, deliverable }, { headers: noCacheHeaders });
  } catch (error: any) {
    if (error instanceof ValidationError) return badRequest(error.message);
    console.error("Error creating deliverable:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create deliverable" },
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

    const body = await readBody(req);
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
      const cleanStatus = must(str(status, { max: 40, required: true }), "Invalid status");
      updateData.status = cleanStatus;
      if (cleanStatus === "COMPLETED") {
        updateData.completedAt = new Date();
      } else {
        updateData.completedAt = null;
      }
    }
    if (title !== undefined) updateData.title = must(str(title, { max: 200, required: true }), "Title is required (max 200 characters)");
    if (description !== undefined) updateData.description = must(str(description, { max: 5000 }), "Description is too long");
    if (priority !== undefined) updateData.priority = must(str(priority, { max: 40, required: true }), "Invalid priority");
    if (dueDate !== undefined) updateData.dueDate = must(date(dueDate), "Due date is invalid");

    const updated = await prisma.businessDeliverable.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, deliverable: updated }, { headers: noCacheHeaders });
  } catch (error: any) {
    if (error instanceof ValidationError) return badRequest(error.message);
    console.error("Error updating deliverable:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update deliverable" },
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
    if (error instanceof ValidationError) return badRequest(error.message);
    console.error("Error deleting deliverable:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete deliverable" },
      { status: 500, headers: noCacheHeaders }
    );
  }
}
