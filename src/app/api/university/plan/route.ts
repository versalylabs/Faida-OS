import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, isAuthRateLimited, recordAuthFailure } from "@/lib/auth";
import { createPlan } from "@/lib/ai/assignmentPlan";
import { ValidationError, badRequest, idOf, must, readBody, serverError } from "@/lib/validate";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const noStore = { "Cache-Control": "no-store" };

/** Builds a dated step plan for one assignment: { taskId, replace?: boolean } */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401, headers: noStore });

    const body = await readBody(req);
    const taskId = must(idOf(body.taskId), "Assignment is required");

    // The planner can use a free AI engine, so keep one account from using it all up.
    const key = `plan:${user.id}`;
    if (await isAuthRateLimited(key)) {
      return NextResponse.json({ success: false, error: "You have planned a lot of assignments just now. Try again in a few minutes." }, { status: 429, headers: noStore });
    }
    await recordAuthFailure(key, 25);

    const result = await createPlan(user.id, taskId, { replace: body.replace === true });
    if (!result.ok) return NextResponse.json({ success: false, error: result.error }, { status: 400, headers: noStore });
    return NextResponse.json({ success: true, steps: result.steps, totalMinutes: result.totalMinutes, usedAi: result.usedAi }, { headers: noStore });
  } catch (error) {
    if (error instanceof ValidationError) return badRequest(error.message, noStore);
    return serverError("Failed to plan the assignment", error, noStore);
  }
}
