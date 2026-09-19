import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_AUTOMATIONS } from "@/lib/automations/engine";

// In-memory / persisted state for rules
let activeRules = [...DEFAULT_AUTOMATIONS];

export async function GET() {
  return NextResponse.json({
    success: true,
    automations: activeRules,
  });
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, isActive } = body;

    activeRules = activeRules.map((r) =>
      r.id === id ? { ...r, isActive: isActive ?? !r.isActive } : r
    );

    return NextResponse.json({ success: true, automations: activeRules });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
