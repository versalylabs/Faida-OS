import { describe, expect, it } from "vitest";
import { daysUntil, dueAt, nextDue } from "@/lib/bills";
import { zonedDateKey } from "@/lib/tz";

const key = (d: Date | null) => (d ? zonedDateKey(d) : null);

describe("bill due dates", () => {
  it("is due at 09:00 Nairobi", () => {
    expect(dueAt("2026-11-26").toISOString()).toBe("2026-11-26T06:00:00.000Z");
  });

  it("keeps a month-end bill at month end", () => {
    let d: Date | null = dueAt("2026-01-31");
    const seen: (string | null)[] = [];
    for (let i = 0; i < 4; i++) {
      d = nextDue(d!, "MONTHLY", 31);
      seen.push(key(d));
    }
    expect(seen).toEqual(["2026-02-28", "2026-03-31", "2026-04-30", "2026-05-31"]);
  });

  it("handles weekly, quarterly, yearly and one-off bills", () => {
    expect(key(nextDue(dueAt("2026-11-28"), "WEEKLY", null))).toBe("2026-12-05");
    expect(key(nextDue(dueAt("2026-11-30"), "QUARTERLY", 30))).toBe("2027-02-28");
    expect(key(nextDue(dueAt("2028-02-29"), "YEARLY", 29))).toBe("2029-02-28");
    expect(nextDue(dueAt("2026-11-30"), "ONCE", null)).toBeNull();
  });

  it("counts days in Nairobi", () => {
    const now = new Date("2026-11-24T10:00:00Z");
    expect(daysUntil(dueAt("2026-11-26"), now)).toBe(2);
    expect(daysUntil(dueAt("2026-11-24"), now)).toBe(0);
    expect(daysUntil(dueAt("2026-11-20"), now)).toBe(-4);
  });
});
