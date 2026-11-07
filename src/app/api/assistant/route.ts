import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, isAuthRateLimited, recordAuthFailure } from "@/lib/auth";
import { askFaida } from "@/lib/ai/agent";
import { configuredProviders } from "@/lib/ai/llm";
import { ValidationError, badRequest, readBody } from "@/lib/validate";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const noStore = { "Cache-Control": "no-store" };

/** Which AI engine is available (names only: keys and models never leave the server). */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401, headers: noStore });
  const providers = configuredProviders().map((p) => p.name);
  return NextResponse.json({ success: true, ai: providers.length > 0, providers }, { headers: noStore });
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401, headers: noStore });
    }

    const body = await readBody(req);
    const { message, history } = body;

    if (!message || typeof message !== "string" || !message.trim()) {
      return NextResponse.json({ success: false, error: "Message is required" }, { status: 400, headers: noStore });
    }
    if (message.length > 4000) {
      return NextResponse.json({ success: false, error: "Message is too long (max 4000 characters)" }, { status: 400, headers: noStore });
    }

    // Free AI models have small limits shared by everything on this app: keep one person from using them all.
    const limiterKey = `ai-chat:${user.id}`;
    if (await isAuthRateLimited(limiterKey)) {
      return NextResponse.json(
        { success: false, error: "You're sending messages very quickly. Give Faida a few minutes to catch up." },
        { status: 429, headers: { ...noStore, "Retry-After": "300" } }
      );
    }
    await recordAuthFailure(limiterKey, 40);

    // Keep only well-formed chat turns and cap how much history is forwarded to the model.
    const safeHistory = Array.isArray(history)
      ? history
          .filter((h: any) => h && typeof h === "object" && (h.role === "user" || h.role === "assistant") && typeof h.content === "string" && h.content.length <= 4000)
          .slice(-20)
      : [];

    const res = await askFaida(user.id, message.trim(), safeHistory);

    return NextResponse.json(
      {
        success: true,
        reply: res.reply,
        actionExecuted: res.actionExecuted,
        toolsUsed: res.toolsUsed,
        engine: res.engine,
        notice: res.notice,
      },
      { headers: noStore }
    );
  } catch (error: any) {
    if (error instanceof ValidationError) return badRequest(error.message, noStore);
    console.error("Error in Faida AI Assistant API:", error instanceof Error ? error.message : error);
    return NextResponse.json({ success: false, error: "Assistant error" }, { status: 500, headers: noStore });
  }
}
