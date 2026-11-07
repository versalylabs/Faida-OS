import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Tables that belong to the user through a parent record instead of carrying userId themselves
const VIA_PARENT: { model: string; where: (userId: string) => object }[] = [
  { model: "subtask", where: (userId) => ({ task: { userId } }) },
  { model: "milestone", where: (userId) => ({ project: { userId } }) },
  { model: "learningTopic", where: (userId) => ({ subject: { userId } }) },
  { model: "studySession", where: (userId) => ({ topic: { subject: { userId } } }) },
];

// Never exported: login sessions, rate-limit counters, and raw file bytes (files list their details only)
const SKIP = new Set(["Session", "AuthRateLimit", "FileBlob", "User"]);

/**
 * GET /api/export: everything that belongs to the signed-in user as one JSON file, a personal backup you can
 * keep. Note that Developer Hub credentials are included exactly as stored, so keep the file private.
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const lowerFirst = (name: string) => name[0].toLowerCase() + name.slice(1);
  const data: Record<string, unknown[]> = {};

  const owned = Prisma.dmmf.datamodel.models.filter(
    (m) => !SKIP.has(m.name) && m.fields.some((f) => f.name === "userId")
  );
  await Promise.all(
    owned.map(async (m) => {
      const delegate = (prisma as any)[lowerFirst(m.name)];
      data[lowerFirst(m.name)] = await delegate.findMany({ where: { userId: user.id } });
    })
  );
  await Promise.all(
    VIA_PARENT.map(async ({ model, where }) => {
      data[model] = await (prisma as any)[model].findMany({ where: where(user.id) });
    })
  );

  const stamp = new Date().toISOString().slice(0, 10);
  const body = JSON.stringify(
    { app: "Faida OS", exportedAt: new Date().toISOString(), account: { email: user.email, name: user.name }, data },
    null,
    2
  );

  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="faida-os-backup-${stamp}.json"`,
      "Cache-Control": "private, no-store",
    },
  });
}
