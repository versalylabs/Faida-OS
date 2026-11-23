import { describe, expect, it } from "vitest";
import type { AgendaItem } from "@/lib/agenda";
import { DEFAULT_PREFS, planBills, planNotifications, planReview, weeklyReviewWindow } from "@/lib/notifyPlan";
import { dueAt } from "@/lib/bills";

const item = (o: Partial<AgendaItem>): AgendaItem => ({
  key: "TASK:1",
  id: "1",
  source: "TASK",
  category: "TASK",
  title: "T",
  subtitle: null,
  start: "2026-11-24T07:00:00Z",
  end: null,
  allDay: false,
  done: false,
  priority: null,
  color: null,
  href: "/tasks",
  url: null,
  canToggle: true,
  canEdit: true,
  ...o,
});

// Times below are UTC; Nairobi is UTC+3.
describe("planNotifications", () => {
  it("sends one morning summary instead of a ping per all-day item", () => {
    const items = [
      item({ key: "TASK:a", title: "Essay draft", start: "2026-11-23T21:00:00Z", allDay: true }),
      item({ key: "CAT:b", source: "CAT", category: "ACADEMIC", title: "CAT: DS", start: "2026-11-24T07:00:00Z" }),
    ];
    const out = planNotifications(items, DEFAULT_PREFS, new Date("2026-11-24T05:10:00Z"), new Set());
    expect(out.map((n) => n.kind)).toEqual(["digest"]);
    expect(out[0].title).toBe("Today: 1 scheduled · 1 due");
  });

  it("gives own items Done/Snooze and the evening before Done/Tomorrow", () => {
    const soon = planNotifications([item({ key: "DELIVERABLE:d", source: "DELIVERABLE", category: "BUSINESS", title: "Logo", start: "2026-11-24T06:00:00Z" })], DEFAULT_PREFS, new Date("2026-11-24T05:10:00Z"), new Set(["digest:2026-11-24"]));
    expect(soon[0].actions).toEqual(["done", "snooze"]);
    const evening = planNotifications([item({ title: "Essay", start: "2026-11-24T21:00:00Z", allDay: true })], DEFAULT_PREFS, new Date("2026-11-24T17:30:00Z"), new Set());
    expect(evening[0]).toMatchObject({ kind: "night", actions: ["done", "tomorrow"] });
  });

  it("offers Join for a meeting with a link, and nothing for a class in a room", () => {
    const items = [
      item({ key: "EVENT:m", source: "EVENT", category: "EVENT", title: "Client call", url: "https://meet.google.com/abc", href: null }),
      item({ key: "CLASS:c", source: "CLASS", category: "CLASS", title: "Lecture" }),
    ];
    const out = planNotifications(items, { ...DEFAULT_PREFS, classes: true }, new Date("2026-11-24T06:50:00Z"), new Set(["digest:2026-11-24"]));
    expect(out.find((n) => n.title.startsWith("Client"))).toMatchObject({ actions: ["join"], link: "https://meet.google.com/abc" });
    expect(out.find((n) => n.title.startsWith("Lecture"))?.actions).toEqual([]);
  });

  it("reminds a locked-plan block around its start, once", () => {
    const block = item({ key: "PLAN:t:600", source: "PLAN", title: "Essay draft", subtitle: "50 min" });
    const at = (utc: string) => planNotifications([block], DEFAULT_PREFS, new Date(utc), new Set(["digest:2026-11-24"]));
    expect(at("2026-11-24T06:45:00Z")).toHaveLength(0);
    expect(at("2026-11-24T06:52:00Z")[0].title).toBe("Time to start: Essay draft");
    expect(at("2026-11-24T07:12:00Z")).toHaveLength(0);
  });

  it("never repeats something already sent", () => {
    const r = item({ key: "REMINDER:r", source: "REMINDER", category: "REMINDER", start: "2026-11-24T05:00:00Z" });
    const first = planNotifications([r], DEFAULT_PREFS, new Date("2026-11-24T05:05:00Z"), new Set(["digest:2026-11-24"]));
    expect(first).toHaveLength(1);
    expect(planNotifications([r], DEFAULT_PREFS, new Date("2026-11-24T05:05:00Z"), new Set(["digest:2026-11-24", first[0].key]))).toHaveLength(0);
  });
});

describe("planBills", () => {
  const bills = [
    { id: "rent", name: "Rent", amount: 15000, paybill: "522522", accountNo: "HSE12", nextDueAt: dueAt("2026-11-26"), remindDaysBefore: 2 },
    { id: "kplc", name: "KPLC", amount: null, paybill: "888880", accountNo: "371", nextDueAt: dueAt("2026-11-24"), remindDaysBefore: 0 },
    { id: "wifi", name: "Wi-Fi", amount: 2999, paybill: null, accountNo: null, nextDueAt: dueAt("2026-11-21"), remindDaysBefore: 3 },
    { id: "netflix", name: "Netflix", amount: 1100, paybill: null, accountNo: null, nextDueAt: dueAt("2026-12-10"), remindDaysBefore: 2 },
  ];

  it("reminds before, on the day and while overdue, at the morning hour only", () => {
    const out = planBills(bills, DEFAULT_PREFS, new Date("2026-11-24T05:15:00Z"), new Set());
    expect(out.map((n) => n.title)).toEqual(["Rent due in 2 days · KES 15,000", "Due today: KPLC", "Overdue: Wi-Fi · KES 2,999 (3 days)"]);
    expect(out.map((n) => n.actions)).toEqual([["paid"], [], ["paid"]]);
    expect(planBills(bills, DEFAULT_PREFS, new Date("2026-11-24T03:30:00Z"), new Set())).toHaveLength(0);
  });
});

describe("evening and weekly windows", () => {
  it("sends the M-Pesa check once in the evening window", () => {
    const p = { count: 2, out: 800, in: 0 };
    expect(planReview(p, DEFAULT_PREFS, new Date("2026-11-24T16:30:00Z"), new Set())).toBeNull();
    expect(planReview(p, DEFAULT_PREFS, new Date("2026-11-24T17:10:00Z"), new Set())?.actions).toEqual(["confirm"]);
    expect(planReview(p, DEFAULT_PREFS, new Date("2026-11-24T17:10:00Z"), new Set(["review:2026-11-24"]))).toBeNull();
  });

  it("sends the weekly review on Sunday 18:00-21:00 only", () => {
    expect(weeklyReviewWindow(DEFAULT_PREFS, new Date("2026-11-29T15:10:00Z"))).toBe(true);
    expect(weeklyReviewWindow(DEFAULT_PREFS, new Date("2026-11-29T18:10:00Z"))).toBe(false);
    expect(weeklyReviewWindow(DEFAULT_PREFS, new Date("2026-11-28T15:30:00Z"))).toBe(false);
  });
});

describe("close the day", () => {
  it("is sent 21:00-23:00 Nairobi by default, not before and not in quiet hours", async () => {
    const { closeDayWindow } = await import("@/lib/notifyPlan");
    expect(closeDayWindow(DEFAULT_PREFS, new Date("2026-11-24T17:50:00Z"))).toBe(false); // 20:50
    expect(closeDayWindow(DEFAULT_PREFS, new Date("2026-11-24T18:05:00Z"))).toBe(true); // 21:05
    expect(closeDayWindow(DEFAULT_PREFS, new Date("2026-11-24T19:55:00Z"))).toBe(true); // 22:55
    expect(closeDayWindow(DEFAULT_PREFS, new Date("2026-11-24T20:05:00Z"))).toBe(false); // 23:05, quiet
    expect(closeDayWindow({ ...DEFAULT_PREFS, tasks: false }, new Date("2026-11-24T18:05:00Z"))).toBe(false);
  });

  it("offers Roll to tomorrow only when something is still open, once a day", async () => {
    const { planCloseDay } = await import("@/lib/notifyPlan");
    const now = new Date("2026-11-24T18:05:00Z");
    const open = planCloseDay({ done: 4, open: [{ title: "Essay" }, { title: "Call bank" }] }, now, new Set())!;
    expect(open.title).toBe("Close the day: 4 done, 2 still open");
    expect(open.body).toBe("Essay, Call bank. Roll them to tomorrow morning?");
    expect(open.actions).toEqual(["rollover"]);
    expect(planCloseDay({ done: 5, open: [] }, now, new Set())).toMatchObject({ title: "Day closed: 5 done, nothing left open", actions: [] });
    expect(planCloseDay({ done: 0, open: [] }, now, new Set())).toBeNull();
    expect(planCloseDay({ done: 4, open: [{ title: "Essay" }] }, now, new Set(["closeday:2026-11-24"]))).toBeNull();
  });
});
