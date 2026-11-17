import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { purgeOldCompleted } from "@/lib/cleanup";
import { computeMrr, projectValue } from "@/lib/businessMath";
import { zonedNow } from "@/lib/tz";
import { ValidationError, badRequest, color, must, num, readBody, str } from "@/lib/validate";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const noCacheHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

const businessInclude = {
  clients: {
    orderBy: { createdAt: "desc" as const },
    include: { deliverables: { orderBy: { createdAt: "desc" as const } } },
  },
  weeklyMetrics: { orderBy: { createdAt: "desc" as const }, take: 10 },
  deliverables: { orderBy: { createdAt: "desc" as const } },
  purchases: { orderBy: { createdAt: "desc" as const } },
};

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401, headers: noCacheHeaders });
    }

    // Housekeeping: finished work deliverables are cleared 24 hours after completion
    await purgeOldCompleted(user.id);

    let businesses = await prisma.business.findMany({
      where: { userId: user.id },
      include: businessInclude,
      orderBy: { createdAt: "asc" },
    });

    // First visit: create the two empty business workspaces. No sample clients, revenue or targets are invented;
    // everything you see after this is something you entered.
    if (businesses.length === 0) {
      await prisma.business.createMany({
        data: [
          {
            userId: user.id,
            name: "VersalyLabs",
            slug: "versaly",
            type: "Software Development Company",
            description: "Custom software development, web applications, cloud architecture, and digital engineering.",
            color: "#3b82f6",
            mrr: 0,
            targetMrr: 0,
            currency: "KES",
            isActive: true,
          },
          {
            userId: user.id,
            name: "Straten",
            slug: "straten",
            type: "Business Growth & Digital Solutions Company",
            description:
              "Helps businesses turn their ideas, products and services into professional, marketable and digitally enabled businesses: branding, marketing, websites and business technology.",
            color: "#f59e0b",
            mrr: 0,
            targetMrr: 0,
            currency: "KES",
            isActive: true,
          },
        ],
      });
      businesses = await prisma.business.findMany({
        where: { userId: user.id },
        include: businessInclude,
        orderBy: { createdAt: "asc" },
      });
    }

    // Money this month, per business (every transaction tagged to a business, in the user's time zone)
    const monthStart = zonedNow().startOfMonth;
    const monthTx = await prisma.financeTransaction.findMany({
      where: { userId: user.id, businessId: { not: null }, date: { gte: monthStart } },
      select: { businessId: true, amount: true },
    });
    const money = new Map<string, { income: number; expense: number }>();
    for (const t of monthTx) {
      if (!t.businessId) continue;
      const m = money.get(t.businessId) ?? { income: 0, expense: 0 };
      if (t.amount > 0) m.income += t.amount;
      else m.expense += Math.abs(t.amount);
      money.set(t.businessId, m);
    }

    // MRR is worked out from the active recurring clients, so it always matches them and a figure
    // can never be stuck on an old typed-in value.
    const enriched = businesses.map((b) => {
      const m = money.get(b.id) ?? { income: 0, expense: 0 };
      return {
        ...b,
        mrr: computeMrr(b.clients),
        projectValue: projectValue(b.clients),
        monthIncome: Math.round(m.income),
        monthExpense: Math.round(m.expense),
        monthNet: Math.round(m.income - m.expense),
      };
    });

    const allClients = enriched.flatMap((b) => b.clients);
    const allDeliverables = enriched.flatMap((b) => b.deliverables);
    const activeClientsCount = allClients.filter((c) => c.status === "ACTIVE").length;
    const totalContractValue = allClients.reduce((acc, c) => acc + (c.contractValue || 0), 0);
    const totalMrr = enriched.reduce((acc, b) => acc + b.mrr, 0);
    const monthIncome = enriched.reduce((a, b) => a + b.monthIncome, 0);
    const monthExpense = enriched.reduce((a, b) => a + b.monthExpense, 0);

    return NextResponse.json(
      {
        success: true,
        businesses: enriched,
        portfolioSummary: {
          totalBusinesses: enriched.length,
          activeClientsCount,
          totalContractValue,
          totalMrr,
          totalDeliverablesCount: allDeliverables.length,
          pendingDeliverablesCount: allDeliverables.filter((d) => d.status !== "COMPLETED").length,
          monthIncome,
          monthExpense,
          monthNet: monthIncome - monthExpense,
        },
      },
      { headers: noCacheHeaders }
    );
  } catch (error: any) {
    if (error instanceof ValidationError) return badRequest(error.message);
    console.error("Error fetching business data:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load business section" },
      { status: 500, headers: noCacheHeaders }
    );
  }
}

/** Edit a business: name, what it is, description, colour and the monthly revenue target. */
export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401, headers: noCacheHeaders });
    }

    const body = await readBody(req);
    const { id, name, type, description, targetMrr, color: colorIn } = body;
    if (typeof id !== "string" || !id || id.length > 100) throw new ValidationError("Business ID is required");

    const existing = await prisma.business.findFirst({ where: { id, userId: user.id } });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Business not found" }, { status: 404, headers: noCacheHeaders });
    }

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = must(str(name, { max: 120, required: true }), "Name is required (max 120 characters)");
    if (type !== undefined) data.type = must(str(type, { max: 160, required: true }), "Type is required (max 160 characters)");
    if (description !== undefined) data.description = must(str(description, { max: 3000 }), "Description is too long");
    if (targetMrr !== undefined) data.targetMrr = must(num(targetMrr, { min: 0, max: 1e12, required: true }), "Target must be a number, 0 or more");
    if (colorIn !== undefined) data.color = must(color(colorIn), "Color must be a hex value like #3b82f6") ?? existing.color;

    const business = await prisma.business.update({ where: { id }, data });
    return NextResponse.json({ success: true, business }, { headers: noCacheHeaders });
  } catch (error: any) {
    if (error instanceof ValidationError) return badRequest(error.message);
    console.error("Error updating business:", error);
    return NextResponse.json({ success: false, error: "Failed to update business" }, { status: 500, headers: noCacheHeaders });
  }
}
