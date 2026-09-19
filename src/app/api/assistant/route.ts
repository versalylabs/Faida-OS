import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { askFaidaAssistant } from "@/lib/ai/assistant";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { message, history } = body;

    if (!message || typeof message !== "string" || !message.trim()) {
      return NextResponse.json({ success: false, error: "Message is required" }, { status: 400 });
    }

    const res = await askFaidaAssistant(message.trim(), history || [], user.id);

    return NextResponse.json({
      success: true,
      reply: res.reply,
      actionExecuted: res.actionExecuted,
    });
  } catch (error: any) {
    console.error("Error in Faida AI Assistant API:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Assistant error" },
      { status: 500 }
    );
  }
}
