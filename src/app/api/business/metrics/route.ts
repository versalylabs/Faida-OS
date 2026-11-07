import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ValidationError, badRequest, must, readBody, safeFloat, safeInt, str } from "@/lib/validate";

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

    const weekStart = must(str(weekStartDate, { max: 10, min: 10, required: true }), "weekStartDate must be YYYY-MM-DD");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart) || Number.isNaN(Date.parse(weekStart))) {
      throw new ValidationError("weekStartDate must be YYYY-MM-DD");
    }
    if (typeof businessId !== "string" || !businessId) {
      return NextResponse.json({ success: false, error: "Business ID is required" }, { status: 400, headers: noCacheHeaders });
    }

    // Verify business ownership
    const business = await prisma.business.findFirst({
      where: { id: businessId, userId: user.id },
    });

    if (!business) {
      return NextResponse.json({ success: false, error: "Business not found" }, { status: 404, headers: noCacheHeaders });
    }

    const parsedOutreach = safeInt(outreachSent, 0, 0);
    const parsedReplyWarm = safeFloat(replyRateWarm, 0, 0);
    const parsedReplyCold = safeFloat(replyRateCold, 0, 0);
    const parsedAudits = safeInt(auditsBooked, 0, 0);
    const parsedShowRate = safeFloat(showRate, 0, 0);
    const parsedCloseRate = safeFloat(closeRate, 0, 0);
    const parsedTimeToLive = safeFloat(avgTimeToLiveDays, 0, 0);
    const parsedMrr = safeFloat(mrr, 0, 0);
    const parsedChurn = safeInt(clientChurnCount, 0, 0);
    const parsedReferrals = safeFloat(referralsCount, 0, 0);
    const parsedCac = safeFloat(cac, 0, 0);
    const parsedLtv = safeFloat(ltv, 0, 0);

    const metric = await prisma.businessWeeklyMetric.create({
      data: {
        userId: user.id,
        businessId,
        weekStartDate: weekStart,
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
        notes: must(str(notes, { max: 5000 }), "Notes are too long"),
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
    if (error instanceof ValidationError) return badRequest(error.message);
    console.error("Error logging weekly metric:", error);
    return NextResponse.json(
      { success: false, error: "Failed to log weekly metric" },
      { status: 500, headers: noCacheHeaders }
    );
  }
}
