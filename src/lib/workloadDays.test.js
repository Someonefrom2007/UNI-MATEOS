import { describe, expect, it } from "vitest";
import { defaultDuration, tasksByDay, tasksDueThisWeek } from "./workloadDays";

const MONDAY = "2026-09-21";

const task = (over) => ({
  id: "t",
  status: "pending",
  due_date: MONDAY,
  estimated_duration: 45,
  ...over,
});

describe("defaultDuration", () => {
  it("uses the task estimate", () => {
    expect(defaultDuration({ estimated_duration: 90 })).toBe(90);
  });

  it("falls back to 30 when missing", () => {
    expect(defaultDuration({})).toBe(30);
    expect(defaultDuration(undefined)).toBe(30);
  });
});

describe("tasksByDay", () => {
  it("returns 7 buckets indexed Monday-first", () => {
    const days = tasksByDay([], MONDAY);
    expect(days).toHaveLength(7);
    expect(days).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });

  it("buckets a task by its weekday offset from Monday", () => {
    const days = tasksByDay([task({ due_date: MONDAY }), task({ id: "wed", due_date: "2026-09-23" })], MONDAY);
    expect(days[0]).toBe(45);
    expect(days[2]).toBe(45);
  });

  it("stacks multiple tasks on the same day", () => {
    const days = tasksByDay([task(), task({ id: "b", estimated_duration: 45 })], MONDAY);
    expect(days[0]).toBe(90);
  });

  it("skips completed tasks", () => {
    const days = tasksByDay([task({ status: "completed" })], MONDAY);
    expect(days[0]).toBe(0);
  });

  it("skips tasks without a due date", () => {
    const days = tasksByDay([task({ due_date: null })], MONDAY);
    expect(days[0]).toBe(0);
  });

  it("ignores tasks outside the week", () => {
    const days = tasksByDay([task({ due_date: "2026-09-20" }), task({ id: "next", due_date: "2026-09-28" })], MONDAY);
    expect(days).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });

  it("defaults to 30 minutes when no estimate is set", () => {
    const days = tasksByDay([task({ estimated_duration: null })], MONDAY);
    expect(days[0]).toBe(30);
  });

  it("handles missing weekStart or non-array tasks", () => {
    expect(tasksByDay(undefined, MONDAY)).toEqual([0, 0, 0, 0, 0, 0, 0]);
    expect(tasksByDay([task()], undefined)).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });
});

describe("tasksDueThisWeek", () => {
  it("sums the week totals", () => {
    expect(tasksDueThisWeek([task({ due_date: MONDAY }), task({ id: "wed", due_date: "2026-09-25" })], MONDAY)).toBe(90);
  });

  it("returns 0 for empty weeks", () => {
    expect(tasksDueThisWeek([], MONDAY)).toBe(0);
  });
});