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
    const {
      businessId,
      name,
      industry,
      scope,
      status = "ACTIVE",
      contractType = "RETAINER",
      contractValue = 0,
      billingCycle = "MONTHLY",
      contactPerson,
      contactEmail,
      contactPhone,
      health = "HEALTHY",
      notes,
    } = body;

    if (!businessId || !name) {
      return NextResponse.json(
        { success: false, error: "Business ID and client name are required" },
        { status: 400, headers: noCacheHeaders }
      );
    }

    const client = await prisma.businessClient.create({
      data: {
        userId: user.id,
        businessId,
        name: name.trim(),
        industry: industry?.trim() || null,
        scope: scope?.trim() || null,
        status,
        contractType,
        contractValue: parseFloat(contractValue) || 0,
        billingCycle,
        contactPerson: contactPerson?.trim() || null,
        contactEmail: contactEmail?.trim() || null,
        contactPhone: contactPhone?.trim() || null,
        health,
        notes: notes?.trim() || null,
        startDate: new Date(),
      },
    });

    return NextResponse.json({ success: true, client }, { headers: noCacheHeaders });
  } catch (error: any) {
    console.error("Error creating business client:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create client" },
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
    const { id, ...data } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: "Client ID is required" }, { status: 400, headers: noCacheHeaders });
    }

    // Ensure ownership
    const existing = await prisma.businessClient.findFirst({
      where: { id, userId: user.id },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: "Client not found" }, { status: 404, headers: noCacheHeaders });
    }

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name.trim();
    if (data.industry !== undefined) updateData.industry = data.industry?.trim() || null;
    if (data.scope !== undefined) updateData.scope = data.scope?.trim() || null;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.contractType !== undefined) updateData.contractType = data.contractType;
    if (data.contractValue !== undefined) updateData.contractValue = parseFloat(data.contractValue) || 0;
    if (data.billingCycle !== undefined) updateData.billingCycle = data.billingCycle;
    if (data.contactPerson !== undefined) updateData.contactPerson = data.contactPerson?.trim() || null;
    if (data.contactEmail !== undefined) updateData.contactEmail = data.contactEmail?.trim() || null;
    if (data.contactPhone !== undefined) updateData.contactPhone = data.contactPhone?.trim() || null;
    if (data.health !== undefined) updateData.health = data.health;
    if (data.notes !== undefined) updateData.notes = data.notes?.trim() || null;
    if (data.businessId !== undefined) updateData.businessId = data.businessId;

    const updated = await prisma.businessClient.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, client: updated }, { headers: noCacheHeaders });
  } catch (error: any) {
    console.error("Error updating business client:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update client" },
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
      return NextResponse.json({ success: false, error: "Client ID is required" }, { status: 400, headers: noCacheHeaders });
    }

    // Ensure ownership
    const existing = await prisma.businessClient.findFirst({
      where: { id, userId: user.id },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: "Client not found" }, { status: 404, headers: noCacheHeaders });
    }

    await prisma.businessClient.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: "Client deleted successfully" }, { headers: noCacheHeaders });
  } catch (error: any) {
    console.error("Error deleting business client:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to delete client" },
      { status: 500, headers: noCacheHeaders }
    );
  }
}
