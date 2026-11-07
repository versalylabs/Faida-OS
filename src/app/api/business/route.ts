import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { purgeOldCompleted } from "@/lib/cleanup";
import { ValidationError, badRequest } from "@/lib/validate";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const noCacheHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401, headers: noCacheHeaders });
    }

    // Housekeeping: finished work deliverables are cleared 48 hours after completion
    await purgeOldCompleted(user.id);

    // Check if user has businesses
    let businesses = await prisma.business.findMany({
      where: { userId: user.id },
      include: {
        clients: {
          orderBy: { createdAt: "desc" },
          include: {
            deliverables: {
              orderBy: { createdAt: "desc" },
            },
          },
        },
        weeklyMetrics: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        deliverables: {
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    // First visit: create the two empty business workspaces. No sample clients, revenue or targets are invented;
    // everything you see after this is something you entered.
    if (businesses.length === 0) {
      await prisma.business.createMany({
        data: [
          {
            userId: user.id,
            name: "Versaly",
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
            type: "Digital Marketing Agency",
            description: "Brand identity, packaging design, performance marketing, social media retainers, and creative content.",
            color: "#f59e0b",
            mrr: 0,
            targetMrr: 0,
            currency: "KES",
            isActive: true,
          },
        ],
      });

      // Refetch with populated relations
      businesses = await prisma.business.findMany({
        where: { userId: user.id },
        include: {
          clients: {
            orderBy: { createdAt: "desc" },
            include: {
              deliverables: {
                orderBy: { createdAt: "desc" },
              },
            },
          },
          weeklyMetrics: {
            orderBy: { createdAt: "desc" },
            take: 10,
          },
          deliverables: {
            orderBy: { createdAt: "desc" },
          },
        },
        orderBy: { createdAt: "asc" },
      });
    }

    // Calculate aggregated portfolio totals
    const allClients = businesses.flatMap((b) => b.clients);
    const allDeliverables = businesses.flatMap((b) => b.deliverables);
    const activeClientsCount = allClients.filter((c) => c.status === "ACTIVE").length;
    const totalContractValue = allClients.reduce((acc, c) => acc + (c.contractValue || 0), 0);
    const totalMrr = businesses.reduce((acc, b) => acc + (b.mrr || 0), 0);

    return NextResponse.json(
      {
        success: true,
        businesses,
        portfolioSummary: {
          totalBusinesses: businesses.length,
          activeClientsCount,
          totalContractValue,
          totalMrr,
          totalDeliverablesCount: allDeliverables.length,
          pendingDeliverablesCount: allDeliverables.filter((d) => d.status !== "COMPLETED").length,
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
