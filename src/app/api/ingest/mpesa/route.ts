import { NextRequest, NextResponse } from "next/server";
import { importMpesa, userForKey } from "@/lib/mpesaImport";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * POST /api/ingest/mpesa
 * Your phone (MacroDroid or Tasker) forwards each M-Pesa SMS here. No sign-in: it carries your private key
 * (Settings > M-Pesa auto-import) in the header  Authorization: Bearer fk_...
 * Body: the SMS as plain text, or JSON { "text": "..." }.
 */
export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const key = auth.replace(/^Bearer\s+/i, "").trim() || req.headers.get("x-faida-key") || "";
  const userId = key ? await userForKey(key) : null;
  if (!userId) return NextResponse.json({ ok: false, error: "Unknown or missing key" }, { status: 401, headers: NO_STORE });

  let text = "";
  try {
    const raw = (await req.text()).slice(0, 5000);
    if (raw.trim().startsWith("{")) {
      const body = JSON.parse(raw);
      text = String(body.text ?? body.message ?? body.sms ?? body.body ?? "");
    } else {
      text = raw;
    }
  } catch {
    return NextResponse.json({ ok: false, error: "Send the SMS text as the request body" }, { status: 400, headers: NO_STORE });
  }
  if (!text.trim()) return NextResponse.json({ ok: false, error: "Empty message" }, { status: 400, headers: NO_STORE });

  try {
    const result = await importMpesa(userId, text);
    return NextResponse.json({ ok: true, ...result }, { headers: NO_STORE });
  } catch (error) {
    console.error("M-Pesa import failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ ok: false, error: "Could not log that message" }, { status: 500, headers: NO_STORE });
  }
}
