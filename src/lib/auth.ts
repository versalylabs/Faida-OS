import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import crypto from "crypto";

export const SESSION_COOKIE_NAME = "faida_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days in seconds
const AUTH_SECRET = process.env.AUTH_SECRET || "faida_secret_master_session_key_2026_salt_v1";

export interface SessionPayload {
  userId: string;
  email: string;
  name?: string | null;
  expiresAt: number;
}

export function signToken(payload: SessionPayload): string {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const hmac = crypto.createHmac("sha256", AUTH_SECRET).update(data).digest("base64url");
  return `${data}.${hmac}`;
}

export function verifySignedToken(token: string): SessionPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [data, signature] = parts;
    const expected = crypto.createHmac("sha256", AUTH_SECRET).update(data).digest("base64url");
    if (signature !== expected) {
      return null;
    }
    const payload: SessionPayload = JSON.parse(Buffer.from(data, "base64url").toString("utf8"));
    if (payload.expiresAt < Date.now()) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSession(userId: string, email?: string, name?: string | null) {
  const expiresAtMs = Date.now() + SESSION_MAX_AGE * 1000;
  const token = signToken({
    userId,
    email: email || "user@faida.os",
    name: name || null,
    expiresAt: expiresAtMs,
  });

  // Also persist in database if available
  try {
    await prisma.session.create({
      data: {
        token,
        userId,
        expiresAt: new Date(expiresAtMs),
      },
    }).catch(() => {});
  } catch {}

  return { token, expiresAt: new Date(expiresAtMs) };
}

export async function validateSessionToken(token: string) {
  if (!token) return null;

  // 1. Check stateless cryptographic signature first (100% resilient across serverless lambdas)
  const signed = verifySignedToken(token);
  if (signed) {
    return {
      session: {
        id: signed.userId,
        token,
        userId: signed.userId,
        expiresAt: new Date(signed.expiresAt),
      },
      user: {
        id: signed.userId,
        email: signed.email,
        name: signed.name ?? null,
      },
    };
  }

  // 2. Fallback to database lookup
  try {
    const session = await prisma.session.findUnique({
      where: { token },
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
  try {
    await prisma.session.deleteMany({
      where: { token },
    }).catch(() => {});
  } catch (error) {
    console.error("Error deleting session:", error);
  }
}
