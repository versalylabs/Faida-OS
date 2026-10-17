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
      weekStartDate = new Date().toISOString().slice(0, 10),
      outreachSent = 0,
      replyRateWarm = 0,
      replyRateCold = 0,
      auditsBooked = 0,
      showRate = 0,
      closeRate = 0,
      avgTimeToLiveDays = 0,
      mrr = 0,
      clientChurnCount = 0,
      referralsCount = 0,
      cac = 0,
      ltv = 0,
      notes,
    } = body;

    if (!businessId) {
      return NextResponse.json({ success: false, error: "Business ID is required" }, { status: 400, headers: noCacheHeaders });
    }

    // Verify business ownership
    const business = await prisma.business.findFirst({
      where: { id: businessId, userId: user.id },
    });

    if (!business) {
      return NextResponse.json({ success: false, error: "Business not found" }, { status: 404, headers: noCacheHeaders });
    }

    const parsedOutreach = parseInt(outreachSent, 10) || 0;
    const parsedReplyWarm = parseFloat(replyRateWarm) || 0;
    const parsedReplyCold = parseFloat(replyRateCold) || 0;
    const parsedAudits = parseInt(auditsBooked, 10) || 0;
    const parsedShowRate = parseFloat(showRate) || 0;
    const parsedCloseRate = parseFloat(closeRate) || 0;
    const parsedTimeToLive = parseFloat(avgTimeToLiveDays) || 0;
    const parsedMrr = parseFloat(mrr) || 0;
    const parsedChurn = parseInt(clientChurnCount, 10) || 0;
    const parsedReferrals = parseFloat(referralsCount) || 0;
    const parsedCac = parseFloat(cac) || 0;
    const parsedLtv = parseFloat(ltv) || 0;

    const metric = await prisma.businessWeeklyMetric.create({
      data: {
        userId: user.id,
        businessId,
        weekStartDate,
        outreachSent: parsedOutreach,
        replyRateWarm: parsedReplyWarm,
        replyRateCold: parsedReplyCold,
        auditsBooked: parsedAudits,
        showRate: parsedShowRate,
        closeRate: parsedCloseRate,
        avgTimeToLiveDays: parsedTimeToLive,
        mrr: parsedMrr,
        clientChurnCount: parsedChurn,
        referralsCount: parsedReferrals,
        cac: parsedCac,
        ltv: parsedLtv,
        notes: notes?.trim() || null,
      },
    });

    // Also update the business current MRR if specified
    if (parsedMrr > 0) {
      await prisma.business.update({
        where: { id: businessId },
        data: { mrr: parsedMrr },
      });
    }

    return NextResponse.json({ success: true, metric }, { headers: noCacheHeaders });
  } catch (error: any) {
    console.error("Error logging weekly metric:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to log weekly metric" },
      { status: 500, headers: noCacheHeaders }
    );
  }
}
