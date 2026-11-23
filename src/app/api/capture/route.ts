import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { classifyUniversalInput } from "@/lib/ai/classifier";
import { splitCapture } from "@/lib/captureSplit";
import { saveCapture, undoCapture, type SavedCapture, type UndoRef } from "@/lib/captureSave";
import { ValidationError, badRequest, readBody } from "@/lib/validate";

/**
 * POST /api/capture  { input }
 * One capture can hold several things ("Buy milk, call John 3pm, paid 500 lunch"): each is classified and saved
 * on its own. The answer lists every item with what was created, so each one can be undone.
 *
 * POST /api/capture  { undo: { kind, ids, entityId } }  takes one captured item back out.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await readBody(req);

    if (body.undo && typeof body.undo === "object") {
      const u = body.undo as Partial<UndoRef>;
      const kinds = ["task", "reminder", "event", "shopping", "note", "finance", "none"];
      if (!u.kind || !kinds.includes(u.kind) || typeof u.entityId !== "string" || !Array.isArray(u.ids)) {
        return badRequest("Nothing to undo");
      }
      await undoCapture(user.id, { kind: u.kind, entityId: u.entityId, ids: u.ids.filter((x) => typeof x === "string") });
      return NextResponse.json({ success: true });
    }

    const { input } = body;
    if (!input || typeof input !== "string" || input.trim() === "") {
      return NextResponse.json({ success: false, error: "Input text is required" }, { status: 400 });
    }
    if (input.length > 5000) {
      return NextResponse.json({ success: false, error: "Input is too long (max 5000 characters)" }, { status: 400 });
    }

    const pieces = splitCapture(input);
    const parsedPieces = await Promise.all(pieces.map((p) => classifyUniversalInput(p)));
    const items: SavedCapture[] = [];
    for (let i = 0; i < pieces.length; i++) {
      items.push(await saveCapture(user.id, pieces[i], parsedPieces[i]));
    }

    return NextResponse.json({
      success: true,
      items,
      // Kept for older screens that read a single result
      parsed: parsedPieces[0],
      entityId: items[0]?.undo.entityId,
    });
  } catch (error: any) {
    if (error instanceof ValidationError) return badRequest(error.message);
    console.error("Error processing universal capture:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
