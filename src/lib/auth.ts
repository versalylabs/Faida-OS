import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import crypto from "crypto";

export const SESSION_COOKIE_NAME = "faida_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days in seconds

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSession(userId: string) {
  const token = crypto.randomUUID() + "-" + crypto.randomBytes(16).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE * 1000);

  const session = await prisma.session.create({
    data: {
      token,
      userId,
      expiresAt,
    },
  });

  return session;
}

export async function validateSessionToken(token: string) {
  if (!token) return null;

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

  // Check if session has expired
  if (session.expiresAt.getTime() < Date.now()) {
    await prisma.session.delete({ where: { token } }).catch(() => {});
    return null;
  }

  return { session, user: session.user };
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
  } catch {
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
    });
  } catch (error) {
    console.error("Error deleting session:", error);
  }
}
