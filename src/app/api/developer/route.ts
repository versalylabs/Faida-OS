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
    const projectId = searchParams.get("projectId");
    const environment = searchParams.get("environment");

    const where: any = { userId: user.id };
    if (projectId) where.projectId = projectId;
    if (environment) where.environment = environment;

    const credentials = await prisma.devCredential.findMany({
      where,
      include: {
        project: {
          select: { id: true, name: true, color: true },
        },
      },
      orderBy: [{ environment: "asc" }, { serviceName: "asc" }],
    });

    const projects = await prisma.project.findMany({
      where: { userId: user.id },
      select: { id: true, name: true, color: true },
      orderBy: { name: "asc" },
    });

    // Detect Port Allocations & Conflicts
    const portMap: { [port: number]: string[] } = {};
    for (const cred of credentials) {
      if (cred.port) {
        if (!portMap[cred.port]) portMap[cred.port] = [];
        portMap[cred.port].push(`${cred.serviceName} (${cred.environment})`);
      }
    }

    const portAllocations = Object.entries(portMap).map(([port, services]) => ({
      port: parseInt(port),
      services,
      hasConflict: services.length > 1,
    }));

    return NextResponse.json({
      success: true,
      credentials,
      projects,
      portAllocations,
    });
  } catch (error: any) {
    console.error("Error fetching developer credentials:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch credentials" },
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
      serviceName,
      keyName,
      keyValue,
      environment = "development",
      isSecret = true,
      port,
      url,
      notes,
      projectId,
    } = body;

    if (!serviceName || !keyName || !keyValue) {
      return NextResponse.json(
        { success: false, error: "Service name, key name, and value are required" },
        { status: 400 }
      );
    }

    const created = await prisma.devCredential.create({
      data: {
        userId: user.id,
        serviceName: serviceName.trim(),
        keyName: keyName.trim().toUpperCase(),
        keyValue: keyValue.trim(),
        environment: environment.toLowerCase(),
        isSecret: Boolean(isSecret),
        port: port ? parseInt(port.toString(), 10) : null,
        url: url ? url.trim() : null,
        notes: notes ? notes.trim() : null,
        projectId: projectId || null,
      },
      include: {
        project: {
          select: { id: true, name: true, color: true },
        },
      },
    });

    return NextResponse.json({ success: true, credential: created });
  } catch (error: any) {
    console.error("Error creating developer credential:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create credential" },
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
        { success: false, error: "Credential ID is required" },
        { status: 400 }
      );
    }

    const existing = await prisma.devCredential.findFirst({
      where: { id, userId: user.id },
    });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Credential not found" }, { status: 404 });
    }

    await prisma.devCredential.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting developer credential:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to delete credential" },
      { status: 500 }
    );
  }
}
