import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ValidationError, badRequest, must, notFound, num, ownedId, readBody, str } from "@/lib/validate";
import { isSealed, open, seal } from "@/lib/secretBox";

// Values are stored encrypted. Lists only carry secret values masked; the plain value is sent only
// when asked for by id (?reveal=id1,id2), never cached.
const PURPOSE = "dev-credential-v1";
const NO_STORE = { "Cache-Control": "private, no-store" };

/** Plain value of a stored keyValue. Rows saved before encryption (plain text) are sealed on sight. */
async function plainValue(id: string, stored: string): Promise<string> {
  if (!isSealed(stored)) {
    await prisma.devCredential.update({ where: { id }, data: { keyValue: seal(stored, PURPOSE) } });
    return stored;
  }
  const { value, current } = open(stored, PURPOSE);
  // Sealed with an older server secret: move it to the preferred one.
  if (!current) await prisma.devCredential.update({ where: { id }, data: { keyValue: seal(value, PURPOSE) } });
  return value;
}

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);

    const reveal = searchParams.get("reveal");
    if (reveal) {
      const ids = reveal.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 200);
      const rows = await prisma.devCredential.findMany({
        where: { userId: user.id, id: { in: ids } },
        select: { id: true, keyValue: true },
      });
      const values: Record<string, string> = {};
      for (const row of rows) {
        try {
          values[row.id] = await plainValue(row.id, row.keyValue);
        } catch (e) {
          console.error("Developer credential cannot be opened:", row.id, e);
        }
      }
      return NextResponse.json({ success: true, values }, { headers: NO_STORE });
    }

    const projectId = searchParams.get("projectId");
    const environment = searchParams.get("environment");

    const where: any = { userId: user.id };
    if (projectId) where.projectId = projectId;
    if (environment) where.environment = environment;

    const stored = await prisma.devCredential.findMany({
      where,
      include: {
        project: {
          select: { id: true, name: true, color: true },
        },
      },
      orderBy: [{ environment: "asc" }, { serviceName: "asc" }],
    });

    const credentials = [];
    for (const c of stored) {
      let value = "";
      let unreadable = false;
      try {
        value = await plainValue(c.id, c.keyValue);
      } catch (e) {
        // Sealed with a server secret that is no longer configured.
        console.error("Developer credential cannot be opened:", c.id, e);
        unreadable = true;
      }
      credentials.push({ ...c, keyValue: c.isSecret ? "" : value, masked: c.isSecret, unreadable });
    }

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
    }, { headers: NO_STORE });
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
        keyValue: seal(cleanKeyValue, PURPOSE),
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

    return NextResponse.json({
      success: true,
      credential: { ...created, keyValue: created.isSecret ? "" : cleanKeyValue, masked: created.isSecret },
    });
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
