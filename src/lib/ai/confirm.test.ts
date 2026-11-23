import { beforeAll, describe, expect, it } from "vitest";
import { CONFIRM_TOOLS, describeAction, signAction, verifyAction } from "@/lib/ai/confirm";

beforeAll(() => {
  process.env.APP_SECRET = "test-secret-for-confirmations";
});

describe("AI confirmations", () => {
  const args = { description: "Lunch", amount: 500, type: "expense", category: "Food" };

  it("describes the change in plain words", () => {
    expect(describeAction("log_transaction", args)).toBe("Log an expense of KES 500: Lunch (Food)");
    expect(describeAction("complete_task", { title: "Essay draft" })).toBe('Mark the task "Essay draft" as done');
  });

  it("round-trips a genuine token for the same user", () => {
    const { token } = signAction("user-1", "log_transaction", args);
    expect(verifyAction(token, "user-1")).toEqual({ tool: "log_transaction", args });
  });

  it("rejects another user, a changed amount and an expired token", () => {
    const now = Date.now();
    const { token } = signAction("user-1", "log_transaction", args, now);
    expect(verifyAction(token, "user-2")).toBeNull();

    const [body, sig] = token.split(".");
    const tampered = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    tampered.a.amount = 50000;
    expect(verifyAction(`${Buffer.from(JSON.stringify(tampered)).toString("base64url")}.${sig}`, "user-1")).toBeNull();

    expect(verifyAction(token, "user-1", now + 31 * 60 * 1000)).toBeNull();
  });

  it("only holds money and done changes", () => {
    expect([...CONFIRM_TOOLS].sort()).toEqual(["complete_task", "log_business_money", "log_transaction", "update_deliverable"]);
  });
});
