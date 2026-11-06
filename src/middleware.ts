import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SESSION_COOKIE = "faida_session";
// Session tokens are 32 random bytes encoded as base64url (43 chars). This is only a
// cheap shape check; the real session lookup happens in route handlers (the edge
// runtime cannot reach the database).
const TOKEN_SHAPE = /^[A-Za-z0-9_-]{43}$/;

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow static assets, Next.js internal files, favicon, manifest, and auth API endpoints
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/auth") ||
    pathname === "/favicon.ico" ||
    pathname === "/icon.svg" ||
    pathname === "/sw.js" ||
    pathname === "/manifest.webmanifest" ||
    pathname.startsWith("/icons")
  ) {
    return NextResponse.next();
  }

  const rawToken = request.cookies.get(SESSION_COOKIE)?.value;
  const sessionToken = rawToken && TOKEN_SHAPE.test(rawToken) ? rawToken : undefined;
  const isLoginPage = pathname === "/login";
  const isApi = pathname.startsWith("/api/");

  if (!sessionToken && !isLoginPage) {
    if (isApi) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const response = NextResponse.redirect(new URL("/login", request.url));
    if (rawToken) response.cookies.delete(SESSION_COOKIE); // malformed cookie
    return response;
  }

  // If already authenticated and navigating to /login, redirect to /
  if (sessionToken && isLoginPage) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
