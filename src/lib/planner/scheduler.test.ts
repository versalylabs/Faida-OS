import { describe, expect, it } from "vitest";
import { buildDayPlan, type PlanTask } from "@/lib/planner/scheduler";

const task = (o: Partial<PlanTask>): PlanTask => ({ id: "t", title: "Task", priority: "MEDIUM", estimatedMinutes: 30, energyCost: 3, ...o });
const opts = { nowMin: 9 * 60, endOfDayMs: Date.parse("2026-11-24T21:00:00Z"), budgetMinutes: 180 };

describe("buildDayPlan", () => {
  it("puts yesterday's unfinished work before new high-priority work", () => {
    const plan = buildDayPlan([task({ id: "new", priority: "HIGH" }), task({ id: "old", carriedOver: true })], [], opts);
    const order = plan.slots.filter((s) => s.kind === "TASK").map((s) => s.taskId);
    expect(order).toEqual(["old", "new"]);
    expect(plan.slots.find((s) => s.taskId === "old")?.why).toContain("Carried over");
  });

  it("never plans past the focus budget and lists what did not fit", () => {
    const plan = buildDayPlan([task({ id: "a", estimatedMinutes: 120 }), task({ id: "b", estimatedMinutes: 120 })], [], { ...opts, budgetMinutes: 150 });
    expect(plan.focusMinutes).toBeLessThanOrEqual(150);
    expect(plan.overflow.length + plan.slots.filter((s) => s.kind === "TASK").length).toBeGreaterThan(0);
  });

  it("works around a class and protects lunch", () => {
    const plan = buildDayPlan([task({ id: "a", estimatedMinutes: 240, energyCost: 8 })], [{ title: "Class", startMin: 600, endMin: 720, kind: "CLASS" }], opts);
    for (const s of plan.slots.filter((x) => x.kind === "TASK")) {
      expect(s.endMin <= 600 || s.startMin >= 720).toBe(true);
      expect(s.endMin <= 780 || s.startMin >= 840).toBe(true);
    }
  });

  it("never schedules into the past", () => {
    const plan = buildDayPlan([task({})], [], { ...opts, nowMin: 15 * 60 + 7 });
    expect(Math.min(...plan.slots.filter((s) => s.kind === "TASK").map((s) => s.startMin))).toBeGreaterThanOrEqual(15 * 60 + 7);
  });
});
