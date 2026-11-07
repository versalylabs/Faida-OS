import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ValidationError, badRequest, email, must, notFound, ownedId, readBody, safeFloat, str } from "@/lib/validate";

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

    const cleanName = must(str(name, { max: 200, required: true }), "Client name is required (max 200 characters)");
    const ownedBusinessId = await ownedId("business", user.id, businessId);
    if (!ownedBusinessId) {
      return notFound("Business not found", noCacheHeaders);
    }

    const client = await prisma.businessClient.create({
      data: {
        userId: user.id,
        businessId: ownedBusinessId,
        name: cleanName,
        industry: must(str(industry, { max: 120 }), "Industry is too long"),
        scope: must(str(scope, { max: 2000 }), "Scope is too long"),
        status: must(str(status, { max: 40 }), "Invalid status") ?? "ACTIVE",
        contractType: must(str(contractType, { max: 40 }), "Invalid contract type") ?? "RETAINER",
        contractValue: safeFloat(contractValue, 0, 0),
        billingCycle: must(str(billingCycle, { max: 40 }), "Invalid billing cycle") ?? "MONTHLY",
        contactPerson: must(str(contactPerson, { max: 120 }), "Contact person is too long"),
        contactEmail: must(email(contactEmail), "Contact email is invalid"),
        contactPhone: must(str(contactPhone, { max: 40 }), "Contact phone is too long"),
        health: must(str(health, { max: 40 }), "Invalid health value") ?? "HEALTHY",
        notes: must(str(notes, { max: 5000 }), "Notes are too long"),
        startDate: new Date(),
      },
    });

    return NextResponse.json({ success: true, client }, { headers: noCacheHeaders });
  } catch (error: any) {
    if (error instanceof ValidationError) return badRequest(error.message);
    console.error("Error creating business client:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create client" },
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
    const { id, ...data } = body;
    if (id !== undefined && (typeof id !== "string" || id.length > 100)) throw new ValidationError("Client ID is invalid");

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
    if (data.name !== undefined) updateData.name = must(str(data.name, { max: 200, required: true }), "Client name is required (max 200 characters)");
    if (data.industry !== undefined) updateData.industry = must(str(data.industry, { max: 120 }), "Industry is too long");
    if (data.scope !== undefined) updateData.scope = must(str(data.scope, { max: 2000 }), "Scope is too long");
    if (data.status !== undefined) updateData.status = must(str(data.status, { max: 40, required: true }), "Invalid status");
    if (data.contractType !== undefined) updateData.contractType = must(str(data.contractType, { max: 40, required: true }), "Invalid contract type");
    if (data.contractValue !== undefined) updateData.contractValue = safeFloat(data.contractValue, 0, 0);
    if (data.billingCycle !== undefined) updateData.billingCycle = must(str(data.billingCycle, { max: 40, required: true }), "Invalid billing cycle");
    if (data.contactPerson !== undefined) updateData.contactPerson = must(str(data.contactPerson, { max: 120 }), "Contact person is too long");
    if (data.contactEmail !== undefined) updateData.contactEmail = must(email(data.contactEmail), "Contact email is invalid");
    if (data.contactPhone !== undefined) updateData.contactPhone = must(str(data.contactPhone, { max: 40 }), "Contact phone is too long");
    if (data.health !== undefined) updateData.health = must(str(data.health, { max: 40, required: true }), "Invalid health value");
    if (data.notes !== undefined) updateData.notes = must(str(data.notes, { max: 5000 }), "Notes are too long");
    if (data.businessId !== undefined) {
      const owned = await ownedId("business", user.id, data.businessId);
      if (!owned) return notFound("Business not found", noCacheHeaders);
      updateData.businessId = owned;
    }

    const updated = await prisma.businessClient.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, client: updated }, { headers: noCacheHeaders });
  } catch (error: any) {
    if (error instanceof ValidationError) return badRequest(error.message);
    console.error("Error updating business client:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update client" },
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
    if (error instanceof ValidationError) return badRequest(error.message);
    console.error("Error deleting business client:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete client" },
      { status: 500, headers: noCacheHeaders }
    );
  }
}
