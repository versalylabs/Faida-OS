import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, SESSION_COOKIE_NAME, SESSION_MAX_AGE, updatePasswordAndRotateSessions, verifyPassword, isSecureRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { currentPassword, newPassword } = body ?? {};
    if (
      typeof currentPassword !== "string" ||
      typeof newPassword !== "string" ||
      Buffer.byteLength(currentPassword, "utf8") > 256 ||
      newPassword.length < 12 ||
      Buffer.byteLength(newPassword, "utf8") > 72
    ) {
      return NextResponse.json(
        { error: "Enter your current password and a new password of at least 12 characters (maximum 72 bytes)." },
        { status: 400 }
      );
    }

    const account = await prisma.user.findUnique({
      where: { id: user.id },
      select: { passwordHash: true },
    });
    if (!account || !(await verifyPassword(currentPassword, account.passwordHash))) {
      return NextResponse.json({ error: "Current password is incorrect." }, { status: 400 });
    }
    if (currentPassword === newPassword) {
      return NextResponse.json({ error: "Choose a different password." }, { status: 400 });
    }

    const session = await updatePasswordAndRotateSessions(user.id, newPassword);
    const response = NextResponse.json({ success: true, message: "Password changed successfully." });
    response.cookies.set(SESSION_COOKIE_NAME, session.token, {
      httpOnly: true,
      secure: isSecureRequest(req),
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE,
    });
    return response;
  } catch (error) {
    console.error("Password change error:", error);
    return NextResponse.json({ error: "Unable to change password." }, { status: 500 });
  }
}
