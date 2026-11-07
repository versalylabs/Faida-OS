import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ValidationError, badRequest, must, notFound, num, ownedId, readBody, str } from "@/lib/validate";

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
    if (error instanceof ValidationError) return badRequest(error.message);
    console.error("Error fetching developer credentials:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch credentials" },
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

    const body = await readBody(req);
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

    const cleanService = must(str(serviceName, { max: 120, required: true }), "Service name is required (max 120 characters)");
    const cleanKeyName = must(str(keyName, { max: 120, required: true }), "Key name is required (max 120 characters)");
    const cleanKeyValue = must(str(keyValue, { max: 10000, required: true }), "Value is required (max 10000 characters)");
    const cleanEnv = must(str(environment, { max: 40 }), "Environment is invalid") ?? "development";
    const cleanPort = must(num(port, { min: 1, max: 65535, int: true }), "Port must be a whole number between 1 and 65535");
    const cleanUrl = must(str(url, { max: 2000 }), "URL is too long");
    const cleanNotes = must(str(notes, { max: 5000 }), "Notes are too long");
    const linkedProjectId = await ownedId("project", user.id, projectId);
    if (linkedProjectId === undefined) return notFound("Project not found");

    const created = await prisma.devCredential.create({
      data: {
        userId: user.id,
        serviceName: cleanService,
        keyName: cleanKeyName.toUpperCase(),
        keyValue: cleanKeyValue,
        environment: cleanEnv.toLowerCase(),
        isSecret: Boolean(isSecret),
        port: cleanPort,
        url: cleanUrl,
        notes: cleanNotes,
        projectId: linkedProjectId,
      },
      include: {
        project: {
          select: { id: true, name: true, color: true },
        },
      },
    });

    return NextResponse.json({ success: true, credential: created });
  } catch (error: any) {
    if (error instanceof ValidationError) return badRequest(error.message);
    console.error("Error creating developer credential:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create credential" },
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
    if (error instanceof ValidationError) return badRequest(error.message);
    console.error("Error deleting developer credential:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete credential" },
      { status: 500 }
    );
  }
}
