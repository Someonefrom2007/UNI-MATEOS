import { describe, it, expect } from "vitest";
import { classifyIntensity, burnoutScore, last7Days, weeklyVelocity } from "@/lib/burnout";

describe("classifyIntensity", () => {
  it("flags overdrive at high hours or completions", () => {
    expect(classifyIntensity(30, 0)).toBe("overdrive");
    expect(classifyIntensity(0, 25)).toBe("overdrive");
    expect(classifyIntensity(18, 14)).toBe("overdrive");
  });
  it("flags low when both are quiet", () => {
    expect(classifyIntensity(4, 2)).toBe("low");
    expect(classifyIntensity(7.9, 4)).toBe("low");
  });
  it("everything between is balanced", () => {
    expect(classifyIntensity(10, 6)).toBe("balanced");
    expect(classifyIntensity(16, 8)).toBe("balanced");
    expect(classifyIntensity(14.9, 11)).toBe("balanced");
  });
});

describe("burnoutScore", () => {
  it("clamps 0-100", () => {
    expect(burnoutScore(0, 0)).toBe(0);
    expect(burnoutScore(60, 50)).toBe(100);
  });
  it("scales hours and completions", () => {
    expect(burnoutScore(15, 0)).toBe(25);
    expect(burnoutScore(0, 12.5)).toBe(25);
    expect(burnoutScore(30, 25)).toBe(100);
  });
});

describe("last7Days", () => {
  it("returns 7 consecutive inclusive local days ending today", () => {
    const days = last7Days("2026-03-15");
    expect(days).toHaveLength(7);
    expect(days[0]).toBe("2026-03-09");
    expect(days[6]).toBe("2026-03-15");
  });
});

describe("weeklyVelocity", () => {
  const tasks = [
    { id: "a", status: "completed", completed_date: "2026-03-15" },
    { id: "b", status: "completed", completed_date: "2026-03-15" },
    { id: "c", status: "completed", completed_date: "2026-03-13" },
    { id: "d", status: "completed", completed_date: "2026-03-02" }, // outside window
    { id: "e", status: "todo", completed_date: "2026-03-15" }, // not completed
    { id: "f", status: "completed", completed_date: null },
  ];
  const focus = [
    { date: "2026-03-15", duration: 50, completed: true },
    { date: "2026-03-15", duration: 25, completed: true },
    { date: "2026-03-14", duration: 60, completed: true },
    { date: "2026-03-14", duration: 40, completed: false }, // interrupted — skip
    { date: "2026-03-01", duration: 600, completed: true }, // outside window
  ];

  it("aligns focus minutes and completions to the same day buckets", () => {
    const v = weeklyVelocity({ tasks, focusSessions: focus, todayStr: "2026-03-15" });
    expect(v.days).toHaveLength(7);
    expect(v.focus[6]).toBe(75);
    expect(v.focus[5]).toBe(60);
    expect(v.completions[6]).toBe(2);
    expect(v.completions[4]).toBe(1);
    expect(v.focusMinWeek).toBe(135);
    expect(v.completionsWeek).toBe(3);
    expect(v.focusHoursWeek).toBe(2.25);
    expect(v.intensity).toBe("low");
  });

  it("reports overdrive under a heavy week", () => {
    const heavyFocus = Array.from({ length: 7 }, (_, i) => ({ date: `2026-03-${String(9 + i).padStart(2, "0")}`, duration: 300, completed: true }));
    const heavyTasks = Array.from({ length: 26 }, (_, i) => ({ status: "completed", completed_date: i % 2 ? "2026-03-14" : "2026-03-15" }));
    const v = weeklyVelocity({ tasks: heavyTasks, focusSessions: heavyFocus, todayStr: "2026-03-15" });
    expect(v.focusMinWeek).toBe(2100);
    expect(v.intensity).toBe("overdrive");
    expect(v.score).toBe(100);
  });

  it("uses real today when no todayStr is passed", () => {
    const v = weeklyVelocity({ tasks, focusSessions: focus });
    expect(v.days).toHaveLength(7);
    expect(v.days[6]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});