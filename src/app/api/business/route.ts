import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

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

    // Auto-seed default businesses and clients if none exist
    if (businesses.length === 0) {
      // 1. Versaly (Software Development)
      const versaly = await prisma.business.create({
        data: {
          userId: user.id,
          name: "Versaly",
          slug: "versaly",
          type: "Software Development Company",
          description: "Custom software development, web applications, cloud architecture, and digital engineering.",
          color: "#3b82f6",
          mrr: 165000,
          targetMrr: 500000,
          currency: "KES",
          isActive: true,
        },
      });

      // 2. Straten (Digital Marketing Agency)
      const straten = await prisma.business.create({
        data: {
          userId: user.id,
          name: "Straten",
          slug: "straten",
          type: "Digital Marketing Agency",
          description: "Brand identity, packaging design, performance marketing, social media retainers, and creative content.",
          color: "#f59e0b",
          mrr: 165000,
          targetMrr: 350000,
          currency: "KES",
          isActive: true,
        },
      });

      // 3. Client: Highland Gardens Limited under Straten
      const highland = await prisma.businessClient.create({
        data: {
          userId: user.id,
          businessId: straten.id,
          name: "Highland Gardens Limited",
          industry: "Food Production (Hibiscus & Chamomile)",
          scope: "Branding and Package Designing",
          status: "ACTIVE",
          contractType: "MILESTONE",
          contractValue: 120000,
          billingCycle: "PROJECT",
          health: "HEALTHY",
          notes: "Packaging design for premium organic Hibiscus and Chamomile tea lines, dieline prep, label regulatory compliance, and brand visual guidelines.",
          startDate: new Date(),
        },
      });

      // 4. Client: Linux Learning Centre under Straten
      const linuxLearning = await prisma.businessClient.create({
        data: {
          userId: user.id,
          businessId: straten.id,
          name: "Linux Learning Centre",
          industry: "ICT Training Institution",
          scope: "Graphic Design and Social Media Management",
          status: "ACTIVE",
          contractType: "RETAINER",
          contractValue: 45000,
          billingCycle: "MONTHLY",
          health: "HEALTHY",
          notes: "Monthly creative retainer for ICT training programs, social media management, enrollment flyers, course promo graphics, and brand engagement.",
          startDate: new Date(),
        },
      });

      // 5. Seed blueprint weekly metrics for Versaly
      await prisma.businessWeeklyMetric.create({
        data: {
          userId: user.id,
          businessId: versaly.id,
          weekStartDate: "2026-W42",
          weekNumber: 42,
          year: 2026,
          outreachSent: 500, // Target: 500/week (Effort)
          replyRateWarm: 12.0, // Target: 10%+ warm (Message quality)
          replyRateCold: 3.8, // Target: 3-5% cold
          auditsBooked: 7, // Target: 5-10/week (Lead magnet strength)
          showRate: 75.0, // Target: 70%+ (Lead quality & reminders)
          closeRate: 33.3, // Target: 25-40% (Offer and sales strength)
          avgTimeToLiveDays: 22.0, // Target: <= 30 days (Delivery speed)
          mrr: 165000, // Monthly recurring revenue (Business health)
          clientChurnCount: 0, // Target: 0 in first 6 months (Retention)
          referralsCount: 1.2, // Target: 1+ (Word of mouth)
          cac: 15000, // Customer acquisition cost
          ltv: 75000, // Lifetime value (5x CAC vs target 3x)
          notes: "Software audit campaign yielding high response from B2B retail and logistics leads.",
        },
      });

      // 6. Seed weekly metrics for Straten
      await prisma.businessWeeklyMetric.create({
        data: {
          userId: user.id,
          businessId: straten.id,
          weekStartDate: "2026-W42",
          weekNumber: 42,
          year: 2026,
          outreachSent: 350,
          replyRateWarm: 14.5,
          replyRateCold: 4.2,
          auditsBooked: 6,
          showRate: 80.0,
          closeRate: 35.0,
          avgTimeToLiveDays: 14.0,
          mrr: 45000,
          clientChurnCount: 0,
          referralsCount: 1.0,
          cac: 7500,
          ltv: 45000,
          notes: "Brand design & retainer outreach generating strong organic interest in agribusiness & tech training.",
        },
      });

      // 7. Seed Deliverables for Clients
      await prisma.businessDeliverable.createMany({
        data: [
          {
            userId: user.id,
            businessId: straten.id,
            clientId: highland.id,
            title: "Hibiscus Tea Box Packaging Mockups & Dieline",
            description: "Finalize dielines and print test mockups for carton box packaging.",
            status: "IN_PROGRESS",
            priority: "HIGH",
            dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
          },
          {
            userId: user.id,
            businessId: straten.id,
            clientId: highland.id,
            title: "Chamomile Pouch Label & Regulatory Nutrition Specs",
            description: "Print-ready pouches with compliance typography and barcode placement.",
            status: "REVIEW",
            priority: "HIGH",
            dueDate: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000),
          },
          {
            userId: user.id,
            businessId: straten.id,
            clientId: highland.id,
            title: "Brand Identity Guide & Color Palettes",
            description: "Primary and secondary color palettes, botanical iconography, and typography rules.",
            status: "COMPLETED",
            priority: "MEDIUM",
            completedAt: new Date(),
          },
          {
            userId: user.id,
            businessId: straten.id,
            clientId: linuxLearning.id,
            title: "October Social Media Content Calendar & Copy",
            description: "20 scheduled carousel posts and banners for LinkedIn, Facebook, and Instagram.",
            status: "IN_PROGRESS",
            priority: "MEDIUM",
            dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
          },
          {
            userId: user.id,
            businessId: straten.id,
            clientId: linuxLearning.id,
            title: "Linux System Administrator Cohort Promo Flyer",
            description: "High-conversion admission banner for upcoming RHCSA & Debian certification track.",
            status: "COMPLETED",
            priority: "HIGH",
            completedAt: new Date(),
          },
          {
            userId: user.id,
            businessId: straten.id,
            clientId: linuxLearning.id,
            title: "Alumni Testimonial Reel & Graphics Kit",
            description: "Visual assets showcasing recent graduate job placements in DevOps and IT Support.",
            status: "PENDING",
            priority: "LOW",
            dueDate: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000),
          },
          {
            userId: user.id,
            businessId: versaly.id,
            title: "Lead Magnet Architecture Audit Template v2",
            description: "Standardized 15-point software & cloud architecture review deck.",
            status: "COMPLETED",
            priority: "HIGH",
            completedAt: new Date(),
          },
          {
            userId: user.id,
            businessId: versaly.id,
            title: "Custom SaaS Client MVP - Sprint 1 Go-Live",
            description: "Initial user authentication, database layer, and dashboard delivery.",
            status: "IN_PROGRESS",
            priority: "HIGH",
            dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
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
    console.error("Error fetching business data:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load business section" },
      { status: 500, headers: noCacheHeaders }
    );
  }
}
