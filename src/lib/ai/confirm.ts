import { createHmac, timingSafeEqual } from "crypto";

/**
 * Faida AI asks before it moves money or finishes things. When the model calls one of these tools the change is
 * not made: the chat shows what it would do with Confirm / Cancel, and Confirm sends back a signed token that
 * carries exactly that change (so nothing can be swapped in between). Tokens last 30 minutes.
 */

export const CONFIRM_TOOLS = new Set(["log_transaction", "log_business_money", "complete_task", "update_deliverable"]);

export interface PendingAction {
  token: string;
  summary: string;
}

const TTL_MS = 30 * 60 * 1000;

function secrets(): string[] {
  const all = [process.env.APP_SECRET, process.env.LMS_TOKEN_SECRET, process.env.DATABASE_URL];
  return [...new Set(all.filter((s): s is string => Boolean(s)))];
}

const mac = (secret: string, body: string) => createHmac("sha256", secret).update(`faida-ai-confirm:${body}`).digest("base64url");

const kes = (n: unknown) => `KES ${Math.round(Number(n) || 0).toLocaleString("en-KE")}`;
const text = (v: unknown, max = 80) => String(v ?? "").trim().slice(0, max);

/** What the change will do, in plain words, for the Confirm card. */
export function describeAction(tool: string, args: Record<string, any>): string {
  switch (tool) {
    case "log_transaction":
      return `Log ${args.type === "income" ? "income" : "an expense"} of ${kes(args.amount)}: ${text(args.description)}${args.category ? ` (${text(args.category, 40)})` : ""}`;
    case "log_business_money":
      return `Log ${args.type === "EXPENSE" ? "a business expense" : "business income"} of ${kes(args.amount)} for ${text(args.business, 40)}: ${text(args.description)}`;
    case "complete_task":
      return `Mark the task "${text(args.title)}" as done`;
    case "update_deliverable":
      return `Set the client job "${text(args.title)}" to ${text(args.status, 20).replace("_", " ").toLowerCase()}`;
    default:
      return `Run ${tool}`;
  }
}

export function signAction(userId: string, tool: string, args: Record<string, any>, now = Date.now()): PendingAction {
  const body = Buffer.from(JSON.stringify({ u: userId, t: tool, a: args, e: now + TTL_MS })).toString("base64url");
  const secret = secrets()[0];
  if (!secret) throw new Error("No server secret to sign the confirmation");
  return { token: `${body}.${mac(secret, body)}`, summary: describeAction(tool, args) };
}

/** The confirmed change, if the token is genuine, unexpired and belongs to this user. */
export function verifyAction(token: string, userId: string, now = Date.now()): { tool: string; args: Record<string, any> } | null {
  const [body, sig] = String(token || "").split(".");
  if (!body || !sig) return null;
  const given = Buffer.from(sig);
  const ok = secrets().some((s) => {
    const expected = Buffer.from(mac(s, body));
    return expected.length === given.length && timingSafeEqual(expected, given);
  });
  if (!ok) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (p.u !== userId || typeof p.t !== "string" || !CONFIRM_TOOLS.has(p.t) || typeof p.e !== "number" || p.e < now) return null;
    return { tool: p.t, args: p.a && typeof p.a === "object" ? p.a : {} };
  } catch {
    return null;
  }
}
