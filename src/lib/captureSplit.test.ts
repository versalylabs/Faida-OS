import { describe, expect, it, vi, afterEach } from "vitest";
import { splitCapture } from "@/lib/captureSplit";
import { parseWithHeuristics } from "@/lib/ai/classifier";

const nairobiTime = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleTimeString("en-GB", { timeZone: "Africa/Nairobi", hour: "2-digit", minute: "2-digit" }) : null;

afterEach(() => vi.useRealTimers());

describe("splitCapture", () => {
  it("splits mixed items", () => {
    expect(splitCapture("Buy milk, call John 3pm, paid 500 lunch")).toEqual(["Buy milk", "call John 3pm", "paid 500 lunch"]);
  });

  it("keeps a shopping list together", () => {
    expect(splitCapture("Buy milk, eggs and bread, call mum tomorrow")).toEqual(["Buy milk, eggs and bread", "call mum tomorrow"]);
  });

  it("never breaks an amount, an idea, an M-Pesa SMS or a single sentence with 'and'", () => {
    expect(splitCapture("Spent KES 2,500 on groceries and fruit")).toHaveLength(1);
    expect(splitCapture("Idea: inventory, forecasting, alerts")).toHaveLength(1);
    expect(splitCapture("QH12AB3CD6 Confirmed. Ksh500.00 paid to JAVA HOUSE. on 23/11/26 at 1:05 PM.New M-PESA balance is Ksh734.00. Transaction cost, Ksh0.00.")).toHaveLength(1);
    expect(splitCapture("Meeting with James and Mary tomorrow at 3pm")).toHaveLength(1);
  });

  it("splits on semicolons, new lines and 'then'", () => {
    expect(splitCapture("finish essay; submit form\nspent 300 on matatu then email Brian")).toHaveLength(4);
  });
});

describe("parseWithHeuristics times", () => {
  it("turns 'call John 3pm' into a 15:00 reminder in Nairobi", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-24T05:00:00Z")); // 08:00 Nairobi
    const r = parseWithHeuristics("call John 3pm");
    expect(r.type).toBe("REMINDER");
    expect(r.title).toBe("Call John");
    expect(nairobiTime(r.dueDate)).toBe("15:00");
  });

  it("uses sensible times for tonight and this evening", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-24T05:00:00Z"));
    expect(nairobiTime(parseWithHeuristics("Call mum tonight").dueDate)).toBe("20:00");
    expect(nairobiTime(parseWithHeuristics("text Brian this evening").dueDate)).toBe("18:00");
  });

  it("drops when-words from reminder titles", () => {
    expect(parseWithHeuristics("remind me to submit CAT form tomorrow at 9am").title).toBe("Submit CAT form");
  });
});
