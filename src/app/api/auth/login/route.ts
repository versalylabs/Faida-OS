import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  clearAuthFailures,
  createSession,
  getClientAddress,
  isAuthRateLimited,
  recordAuthFailure,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE,
  verifyPassword,
} from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body ?? {};

    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      !email.trim() ||
      !password ||
      email.length > 254 ||
      Buffer.byteLength(password, "utf8") > 256
    ) {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 }
      );
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const clientAddress = getClientAddress(req);
    const emailLimitKey = `login:${normalizedEmail}:${clientAddress}`;
    const ipLimitKey = `login-ip:${clientAddress}`;
    if (await isAuthRateLimited(emailLimitKey) || await isAuthRateLimited(ipLimitKey)) {
      return NextResponse.json(
        { error: "Too many attempts. Try again in 15 minutes." },
        { status: 429, headers: { "Retry-After": "900" } }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      await Promise.all([recordAuthFailure(emailLimitKey), recordAuthFailure(ipLimitKey)]);
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 }
      );
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      await Promise.all([recordAuthFailure(emailLimitKey), recordAuthFailure(ipLimitKey)]);
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 }
      );
    }

    await Promise.all([clearAuthFailures(emailLimitKey), clearAuthFailures(ipLimitKey)]);
    const session = await createSession(user.id, user.email, user.name);

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    });

    response.cookies.set(SESSION_COOKIE_NAME, session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE,
    });

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Internal server error during authentication." },
      { status: 500 }
    );
  }
}
