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

  // Opportunistic cleanup of this user's expired sessions.
  await prisma.session
    .deleteMany({ where: { userId, expiresAt: { lt: new Date() } } })
    .catch(() => {});

  return { token, expiresAt: new Date(expiresAtMs) };
}

export async function updatePasswordAndRotateSessions(userId: string, password: string) {
  const passwordHash = await hashPassword(password);
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE * 1000);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { passwordHash } });
    forgetSessionsFor(userId);
    await tx.session.deleteMany({ where: { userId } });
    await tx.session.create({
      data: { token: hashSessionToken(token), userId, expiresAt },
    });
  });

  return { token, expiresAt };
}

// A session lookup is a database round trip on every API call. Remember a verified session for a few
// seconds per server instance. Logout and password changes clear it, and other instances catch up
// within the TTL, so a revoked session stops working within ~20 seconds at most.
const SESSION_CACHE_TTL_MS = 20_000;
const sessionCache = new Map<string, { until: number; value: { session: any; user: any } }>();

function rememberSession(tokenHash: string, value: { session: any; user: any }) {
  if (sessionCache.size > 500) sessionCache.clear();
  sessionCache.set(tokenHash, { until: Math.min(Date.now() + SESSION_CACHE_TTL_MS, value.session.expiresAt.getTime()), value });
}

function forgetSessionsFor(userId: string) {
  for (const [key, entry] of sessionCache) {
    if (entry.value.user?.id === userId) sessionCache.delete(key);
  }
}

/** Thrown (in strict mode) when the session store itself is unreachable, as opposed to the session being invalid. */
export class AuthUnavailableError extends Error {}

export async function validateSessionToken(token: string, opts: { strict?: boolean } = {}) {
  if (!token) return null;

  const tokenHash = hashSessionToken(token);
  const hit = sessionCache.get(tokenHash);
  if (hit && hit.until > Date.now()) return hit.value;

  try {
    const session = await prisma.session.findUnique({
      where: { token: tokenHash },
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
      // Sessions are stored by token hash, so delete by the hash (not the raw cookie value).
      await prisma.session.deleteMany({ where: { id: session.id } }).catch(() => {});
      return null;
    }

    const value = { session, user: session.user };
    rememberSession(tokenHash, value);
    return value;
  } catch (error) {
    console.error("[Auth] Database session validation error:", error);
    if (opts.strict) throw new AuthUnavailableError("Session store unavailable");
    return null;
  }
}

export async function getCurrentUser(req?: Request | NextRequest, opts: { strict?: boolean } = {}) {
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

    const auth = await validateSessionToken(token, opts);
    return auth?.user ?? null;
  } catch (error) {
    if (error instanceof AuthUnavailableError) throw error;
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
  const tokenHash = hashSessionToken(token);
  sessionCache.delete(tokenHash);
  await prisma.session.deleteMany({
    where: { token: tokenHash },
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

export async function recordAuthFailure(key: string, limit: number = AUTH_RATE_LIMIT): Promise<void> {
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
        WHEN "AuthRateLimit"."count" + 1 >= ${limit} THEN NOW() + (${AUTH_RATE_WINDOW_MINUTES} * INTERVAL '1 minute')
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

/**
 * Whether the cookie should be marked Secure. True for anything served over HTTPS (all of production),
 * false for plain-HTTP local/LAN testing, where a Secure cookie would be silently dropped by the browser.
 */
export function isSecureRequest(req: NextRequest): boolean {
  const proto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || req.nextUrl.protocol.replace(":", "");
  return proto === "https";
}
