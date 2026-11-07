import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { DEFAULT_AUTOMATIONS } from "@/lib/automations/engine";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };

type StoredPayload = {
  description?: string;
  timesTriggered?: number;
};

function parsePayload(raw: string | null): StoredPayload {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * Rules are stored per user in the AutomationRule table. A user's first request
 * seeds their copy from the defaults; `conditions` holds the default rule key
 * (e.g. "rule-1") so duplicate seeds from concurrent requests can be ignored.
 */
async function loadRulesForUser(userId: string) {
  let rows = await prisma.automationRule.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });

  if (rows.length === 0) {
    await prisma.automationRule.createMany({
      data: DEFAULT_AUTOMATIONS.map((rule) => ({
        userId,
        name: rule.name,
        triggerType: rule.trigger,
        conditions: rule.id,
        actionType: rule.action,
        actionPayload: JSON.stringify({
          description: rule.description,
          timesTriggered: rule.timesTriggered,
        }),
        isActive: rule.isActive,
      })),
    });
    rows = await prisma.automationRule.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
    });
  }

  const seen = new Set<string>();
  return [...rows]
    .sort((a, b) => (a.conditions ?? "").localeCompare(b.conditions ?? "") || a.createdAt.getTime() - b.createdAt.getTime())
    .filter((row) => {
      const key = row.conditions ?? row.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((row) => {
      const payload = parsePayload(row.actionPayload);
      return {
        id: row.id,
        name: row.name,
        trigger: row.triggerType,
        description: payload.description ?? "",
        action: row.actionType,
        isActive: row.isActive,
        timesTriggered: 0, // nothing runs these rules yet, so never show an invented count
      };
    });
}

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401, headers: noStore });
    }

    const automations = await loadRulesForUser(user.id);
    return NextResponse.json({ success: true, automations }, { headers: noStore });
  } catch (error) {
    console.error("Error loading automations:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load automations" },
      { status: 500, headers: noStore }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401, headers: noStore });
    }

    const body = await req.json().catch(() => null);
    const id = body?.id;
    const isActive = body?.isActive;

    if (typeof id !== "string" || !id || id.length > 100 || (isActive !== undefined && typeof isActive !== "boolean")) {
      return NextResponse.json({ success: false, error: "Invalid request" }, { status: 400, headers: noStore });
    }

    const existing = await prisma.automationRule.findFirst({ where: { id, userId: user.id } });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Rule not found" }, { status: 404, headers: noStore });
    }

    await prisma.automationRule.update({
      where: { id },
      data: { isActive: isActive ?? !existing.isActive },
    });

    const automations = await loadRulesForUser(user.id);
    return NextResponse.json({ success: true, automations }, { headers: noStore });
  } catch (error) {
    console.error("Error updating automation:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update automation" },
      { status: 500, headers: noStore }
    );
  }
}
