import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getPrefs, isPushConfigured } from "@/lib/notify";
import { isKnownPushEndpoint } from "@/lib/pushEndpoint";
import { ValidationError, badRequest, must, num, readBody, serverError, str } from "@/lib/validate";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };

const BOOLS = ["enabled", "nightBefore", "hourBefore", "events", "academic", "business", "reminders", "tasks", "maintenance", "classes"] as const;

/** Notification status and settings for the signed-in student. */
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401, headers: noStore });
    const [devices, prefs] = await Promise.all([prisma.pushSubscription.count({ where: { userId: user.id } }), getPrefs(user.id)]);
    return NextResponse.json(
      { success: true, configured: isPushConfigured(), publicKey: process.env.VAPID_PUBLIC_KEY || null, devices, prefs },
      { headers: noStore }
    );
  } catch (error) {
    return serverError("Failed to load notification settings", error, noStore);
  }
}

/** Registers this browser/device: { subscription: { endpoint, keys: { p256dh, auth } } } */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401, headers: noStore });

    const body = await readBody(req);
    const sub = body.subscription;
    if (!sub || typeof sub !== "object") throw new ValidationError("Subscription is required");
    const endpoint = must(str(sub.endpoint, { max: 1000, required: true }), "Subscription endpoint is required");
    const p256dh = must(str(sub.keys?.p256dh, { max: 200, required: true }), "Subscription key is required");
    const auth = must(str(sub.keys?.auth, { max: 100, required: true }), "Subscription key is required");
    if (!isKnownPushEndpoint(endpoint)) throw new ValidationError("This browser's push service is not supported");
    const userAgent = str(req.headers.get("user-agent"), { max: 300 });

    const existing = await prisma.pushSubscription.count({ where: { userId: user.id } });
    const mine = await prisma.pushSubscription.findUnique({ where: { endpoint }, select: { userId: true } });
    if (existing >= 10 && mine?.userId !== user.id) throw new ValidationError("You already have 10 devices registered. Remove one first.");

    await prisma.pushSubscription.upsert({
      where: { endpoint },
      create: { userId: user.id, endpoint, p256dh, auth, userAgent },
      update: { userId: user.id, p256dh, auth, userAgent, failureCount: 0 },
    });
    // Make sure there is a settings row so the defaults are visible and editable.
    await prisma.notificationPref.upsert({ where: { userId: user.id }, create: { userId: user.id }, update: {} });
    return NextResponse.json({ success: true }, { headers: noStore });
  } catch (error) {
    if (error instanceof ValidationError) return badRequest(error.message, noStore);
    return serverError("Failed to register this device", error, noStore);
  }
}

/** Updates reminder settings. Any subset of: enabled, nightBefore, nightHour, hourBefore, leadMinutes, ... */
export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401, headers: noStore });

    const body = await readBody(req);
    const data: Record<string, boolean | number> = {};
    for (const k of BOOLS) {
      if (body[k] === undefined) continue;
      if (typeof body[k] !== "boolean") throw new ValidationError(`${k} must be true or false`);
      data[k] = body[k];
    }
    for (const [k, min, max] of [
      ["nightHour", 0, 23],
      ["morningHour", 0, 23],
      ["quietStart", 0, 23],
      ["quietEnd", 0, 23],
      ["leadMinutes", 10, 240],
    ] as const) {
      if (body[k] === undefined) continue;
      data[k] = must(num(body[k], { min, max, int: true, required: true }), `${k} must be a whole number from ${min} to ${max}`);
    }
    await prisma.notificationPref.upsert({ where: { userId: user.id }, create: { userId: user.id, ...data }, update: data });
    return NextResponse.json({ success: true, prefs: await getPrefs(user.id) }, { headers: noStore });
  } catch (error) {
    if (error instanceof ValidationError) return badRequest(error.message, noStore);
    return serverError("Failed to save notification settings", error, noStore);
  }
}

/** Forgets one device: { endpoint } */
export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401, headers: noStore });
    const body = await readBody(req);
    const endpoint = must(str(body.endpoint, { max: 1000, required: true }), "Endpoint is required");
    await prisma.pushSubscription.deleteMany({ where: { userId: user.id, endpoint } });
    return NextResponse.json({ success: true }, { headers: noStore });
  } catch (error) {
    if (error instanceof ValidationError) return badRequest(error.message, noStore);
    return serverError("Failed to remove this device", error, noStore);
  }
}
