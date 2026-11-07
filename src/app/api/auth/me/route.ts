import { NextResponse } from "next/server";
import { AuthUnavailableError, getCurrentUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getCurrentUser(undefined, { strict: true });
    if (!user) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    if (error instanceof AuthUnavailableError) {
      // The database was briefly unreachable: this says nothing about the session, so do not sign the user out.
      return NextResponse.json({ error: "Service temporarily unavailable." }, { status: 503 });
    }
    console.error("Auth me check error:", error);
    return NextResponse.json({ error: "Failed to fetch user profile." }, { status: 500 });
  }
}
