import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { encryptToken } from "@/lib/lms/crypto";
import { MoodleError, MoodleLoginError, MoodleTokenError, createMoodleClient, normalizeBaseUrl, requestTokenWithPassword } from "@/lib/lms/moodle";
import { clearAuthFailures, isAuthRateLimited, recordAuthFailure } from "@/lib/auth";
import { syncUser } from "@/lib/lms/sync";
import { extractMoodleToken } from "@/lib/lms/ssoToken";
import { ValidationError, badRequest, must, readBody, serverError, str } from "@/lib/validate";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const noStore = { "Cache-Control": "no-store" };

/** Connects the student's LMS with their own access key, then runs the first sync. */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401, headers: noStore });

    const body = await readBody(req);
    const base = await normalizeBaseUrl(body.baseUrl);
    let token: string;
    if (typeof body.password === "string" && body.password.length > 0) {
      // Sign in with the LMS login once to obtain a key. The password is never stored or logged.
      const username = must(str(body.username, { max: 100, required: true }), "Enter your LMS username");
      if (body.password.length > 200) throw new ValidationError("That password is too long");
      const limiterKeys = [`lms-login:user:${user.id}`, `lms-login:site:${new URL(base).host}:${username.toLowerCase()}`];
      for (const k of limiterKeys) {
        if (await isAuthRateLimited(k)) {
          return NextResponse.json(
            { success: false, error: "Too many failed sign-ins. Wait 15 minutes before trying again." },
            { status: 429, headers: { ...noStore, "Retry-After": "900" } }
          );
        }
      }
      try {
        token = await requestTokenWithPassword(base, username, body.password);
      } catch (err) {
        if (err instanceof MoodleLoginError) {
          // Stricter than app sign-in: this endpoint forwards guesses to another organisation's login.
          await Promise.all(limiterKeys.map((k) => recordAuthFailure(k, 5)));
          throw new ValidationError("The LMS did not accept that username and password. If you sign in to your LMS through a university account (single sign-on), use the key method instead.");
        }
        if (err instanceof MoodleError) throw new ValidationError("The LMS did not hand out a key for that login. It may need the key method instead.");
        throw new ValidationError("Could not reach that LMS address. Check it and try again.");
      }
      await Promise.all(limiterKeys.map((k) => clearAuthFailures(k)));
    } else {
      // Accepts the bare key, the whole address the LMS redirected to, or its encoded part.
      const pasted = must(str(body.token, { max: 1000, min: 10, required: true }), "Paste the access key or the link you were given");
      const found = extractMoodleToken(pasted);
      if (!found) throw new ValidationError("I could not find an access key in that text. Paste the whole address that starts with moodlemobile:// or web+faida://, or the 32-character key.");
      token = found;
    }
    if (!/^[A-Za-z0-9]+$/.test(token)) throw new ValidationError("That does not look like an LMS access key");

    // Prove the key works before saving anything.
    let studentName: string | null = null;
    let lmsUserId: number | null = null;
    try {
      const info = await createMoodleClient(base, token, Date.now() + 20_000).call("core_webservice_get_site_info");
      lmsUserId = typeof info?.userid === "number" ? info.userid : null;
      studentName = String(info?.fullname || info?.username || "").slice(0, 120) || null;
      if (!lmsUserId) throw new ValidationError("The LMS did not recognise this key");
    } catch (err) {
      if (err instanceof ValidationError) throw err;
      if (err instanceof MoodleTokenError) throw new ValidationError("The LMS did not accept that key. Copy it again and check it is the mobile service key.");
      if (err instanceof MoodleError) throw new ValidationError("The LMS answered, but web access is not available for this key.");
      throw new ValidationError("Could not reach that LMS address. Check it and try again.");
    }

    const tokenEnc = encryptToken(token);
    const existing = await prisma.lmsConnection.findUnique({ where: { userId: user.id } });
    // A different LMS site starts a fresh baseline so old items do not flood the activity feed.
    const sameSite = existing?.baseUrl === base;
    await prisma.lmsConnection.upsert({
      where: { userId: user.id },
      create: { userId: user.id, baseUrl: base, tokenEnc, lmsUserId, lmsUserName: studentName },
      update: {
        baseUrl: base,
        tokenEnc,
        lmsUserId,
        lmsUserName: studentName,
        status: "ACTIVE",
        lastError: null,
        syncingSince: null,
        ...(sameSite ? {} : { baselineDone: false }),
      },
    });

    let summary;
    try {
      summary = await syncUser(user.id, { force: true });
    } catch {
      return NextResponse.json(
        { success: true, connected: true, studentName, message: "Connected, but the first sync did not finish. Try Sync now in a moment." },
        { headers: noStore }
      );
    }
    return NextResponse.json({ success: true, connected: true, studentName, summary }, { headers: noStore });
  } catch (error) {
    if (error instanceof ValidationError) return badRequest(error.message, noStore);
    return serverError("Failed to connect the LMS", error, noStore);
  }
}
