import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { askFaidaAssistant } from "@/lib/ai/assistant";
import { ValidationError, badRequest, readBody } from "@/lib/validate";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await readBody(req);
    const { message, history } = body;

    if (!message || typeof message !== "string" || !message.trim()) {
      return NextResponse.json({ success: false, error: "Message is required" }, { status: 400 });
    }

    if (message.length > 4000) {
      return NextResponse.json({ success: false, error: "Message is too long (max 4000 characters)" }, { status: 400 });
    }
    // Keep only well-formed chat turns and cap how much history is forwarded to the model.
    const safeHistory = Array.isArray(history)
      ? history
          .filter((h: any) => h && typeof h === "object" && typeof h.content === "string" && h.content.length <= 4000)
          .slice(-20)
      : [];

    const res = await askFaidaAssistant(message.trim(), safeHistory, user.id);

    return NextResponse.json({
      success: true,
      reply: res.reply,
      actionExecuted: res.actionExecuted,
    });
  } catch (error: any) {
    if (error instanceof ValidationError) return badRequest(error.message);
    console.error("Error in Faida AI Assistant API:", error);
    return NextResponse.json(
      { success: false, error: "Assistant error" },
      { status: 500 }
    );
  }
}
