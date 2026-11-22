import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ownedId } from "@/lib/validate";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const noCache = { "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate", Pragma: "no-cache", Expires: "0" };

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401, headers: noCache });
    const businessId = await ownedId("business", user.id, new URL(req.url).searchParams.get("businessId"));
    if (!businessId) return NextResponse.json({ success: false, error: "Business not found" }, { status: 404, headers: noCache });
    const row = await prisma.businessPrivatePlan.findFirst({ where: { userId: user.id, businessId } });
    let config = null;
    if (row) {
      try { config = JSON.parse(row.data); } catch { return NextResponse.json({ success: false, error: "Saved business plan data is invalid" }, { status: 500, headers: noCache }); }
    }
    return NextResponse.json({ success: true, config }, { headers: noCache });
  } catch (error) {
    console.error("Error loading private business plan:", error);
    return NextResponse.json({ success: false, error: "Failed to load business plan" }, { status: 500, headers: noCache });
  }
}
