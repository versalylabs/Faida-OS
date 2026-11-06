import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "crypto";

export const SESSION_COOKIE_NAME = "faida_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days in seconds

const AUTH_RATE_LIMIT = 10;
const AUTH_RATE_WINDOW_MINUTES = 15;

function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSession(userId: string, email?: string, name?: string | null) {
  const expiresAtMs = Date.now() + SESSION_MAX_AGE * 1000;
  const token = randomBytes(32).toString("base64url");

  await prisma.session.create({
    data: {
      token: hashSessionToken(token),
      userId,
      expiresAt: new Date(expiresAtMs),
    },
  });

  return { token, expiresAt: new Date(expiresAtMs) };
}

export async function updatePasswordAndRotateSessions(userId: string, password: string) {
  const passwordHash = await hashPassword(password);
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE * 1000);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { passwordHash } });
    await tx.session.deleteMany({ where: { userId } });
    await tx.session.create({
      data: { token: hashSessionToken(token), userId, expiresAt },
    });
  });

  return { token, expiresAt };
}

export async function validateSessionToken(token: string) {
  if (!token) return null;

  try {
    const session = await prisma.session.findUnique({
      where: { token: hashSessionToken(token) },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            createdAt: true,
          },
        },
      },
    });

    if (!session) return null;

    if (session.expiresAt.getTime() < Date.now()) {
      await prisma.session.delete({ where: { token } }).catch(() => {});
      return null;
    }

    return { session, user: session.user };
  } catch (error) {
    console.error("[Auth] Database session validation error:", error);
    return null;
  }
}

export async function getCurrentUser(req?: Request | NextRequest) {
  try {
    let token: string | undefined;

    if (req && "cookies" in req && typeof (req as any).cookies?.get === "function") {
      token = (req as any).cookies.get(SESSION_COOKIE_NAME)?.value;
    }

    if (!token) {
      const cookieStore = await cookies();
      token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    }

    if (!token) return null;

    const auth = await validateSessionToken(token);
    return auth?.user ?? null;
  } catch (error) {
    console.error("[Auth] Error in getCurrentUser:", error);
    return null;
  }
}

export async function requireAuth(req?: Request | NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}

export async function deleteSession(token: string) {
  await prisma.session.deleteMany({
    where: { token: hashSessionToken(token) },
  });
}

function hashRateLimitKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export async function isAuthRateLimited(key: string): Promise<boolean> {
  const record = await prisma.authRateLimit.findUnique({
    where: { key: hashRateLimitKey(key) },
    select: { blockedUntil: true },
  });
  return Boolean(record?.blockedUntil && record.blockedUntil.getTime() > Date.now());
}

export async function recordAuthFailure(key: string): Promise<void> {
  const hashedKey = hashRateLimitKey(key);
  await prisma.$executeRaw`
    INSERT INTO "AuthRateLimit" ("key", "count", "windowStartedAt", "blockedUntil", "createdAt", "updatedAt")
    VALUES (${hashedKey}, 1, NOW(), NULL, NOW(), NOW())
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN "AuthRateLimit"."windowStartedAt" <= NOW() - (${AUTH_RATE_WINDOW_MINUTES} * INTERVAL '1 minute') THEN 1
        ELSE "AuthRateLimit"."count" + 1
      END,
      "windowStartedAt" = CASE
        WHEN "AuthRateLimit"."windowStartedAt" <= NOW() - (${AUTH_RATE_WINDOW_MINUTES} * INTERVAL '1 minute') THEN NOW()
        ELSE "AuthRateLimit"."windowStartedAt"
      END,
      "blockedUntil" = CASE
        WHEN "AuthRateLimit"."windowStartedAt" <= NOW() - (${AUTH_RATE_WINDOW_MINUTES} * INTERVAL '1 minute') THEN NULL
        WHEN "AuthRateLimit"."count" + 1 >= ${AUTH_RATE_LIMIT} THEN NOW() + (${AUTH_RATE_WINDOW_MINUTES} * INTERVAL '1 minute')
        ELSE "AuthRateLimit"."blockedUntil"
      END,
      "updatedAt" = NOW()
  `;
}

export async function clearAuthFailures(key: string): Promise<void> {
  await prisma.authRateLimit.deleteMany({ where: { key: hashRateLimitKey(key) } });
}

export async function isRegistrationRateLimited(ipAddress: string): Promise<boolean> {
  return isAuthRateLimited(`registration:${ipAddress}`);
}

export async function recordRegistrationAttempt(ipAddress: string): Promise<void> {
  await recordAuthFailure(`registration:${ipAddress}`);
}

export function getClientAddress(req: NextRequest): string {
  const address =
    req.headers.get("x-vercel-forwarded-for") ||
    req.headers.get("x-real-ip") ||
    req.headers.get("x-forwarded-for");
  return address?.split(",")[0]?.trim() || "unknown";
}
