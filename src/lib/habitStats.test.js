import { describe, it, expect } from "vitest";
import { prevDayStr, lastNDayStrings, habitStreak, habitWeekDone } from "@/lib/habitStats";

const log = (habitId, date, completed = true) => ({ habit_id: habitId, date, completed });

describe("prevDayStr", () => {
  it("walks back a day with month boundaries intact", () => {
    expect(prevDayStr("2026-03-01")).toBe("2026-02-28");
    expect(prevDayStr("2026-01-01")).toBe("2025-12-31");
  });
});

describe("lastNDayStrings", () => {
  it("ends at today and stays in ISO order", () => {
    expect(lastNDayStrings(7, "2026-09-20")).toEqual([
      "2026-09-14", "2026-09-15", "2026-09-16", "2026-09-17", "2026-09-18", "2026-09-19", "2026-09-20",
    ]);
  });
  it("is empty for n <= 0", () => {
    expect(lastNDayStrings(0, "2026-09-20")).toEqual([]);
  });
});

describe("habitStreak", () => {
  const h = "h1";
  it("counts consecutive days ending today", () => {
    const logs = [log(h, "2026-09-18"), log(h, "2026-09-19"), log(h, "2026-09-20")];
    expect(habitStreak(logs, h, "2026-09-20")).toBe(3);
  });
  it("stays alive when the last completion is yesterday", () => {
    const logs = [log(h, "2026-09-18"), log(h, "2026-09-19")];
    expect(habitStreak(logs, h, "2026-09-20")).toBe(2);
  });
  it("resets when the chain is older than yesterday", () => {
    const logs = [log(h, "2026-09-17"), log(h, "2026-09-18")];
    expect(habitStreak(logs, h, "2026-09-20")).toBe(0);
  });
  it("is zero with no logs and only counts completed rows", () => {
    expect(habitStreak([log(h, "2026-09-20", false)], h, "2026-09-20")).toBe(0);
    expect(habitStreak([], h, "2026-09-20")).toBe(0);
  });
  it("only counts the targeted habit", () => {
    const logs = [log(h, "2026-09-20"), log("h2", "2026-09-19"), log("h2", "2026-09-18")];
    expect(habitStreak(logs, h, "2026-09-20")).toBe(1);
  });
});

describe("habitWeekDone", () => {
  const h = "h1";
  const week = ["2026-09-14", "2026-09-15", "2026-09-16", "2026-09-17", "2026-09-18", "2026-09-19", "2026-09-20"];
  it("counts completed days within the window", () => {
    const logs = [log(h, "2026-09-15"), log(h, "2026-09-17"), log(h, "2026-09-18"), log(h, "2026-09-21")];
    expect(habitWeekDone(logs, h, week)).toBe(3);
  });
  it("ignores other habits", () => {
    const logs = [log("h2", "2026-09-16", true), log(h, "2026-09-16", false)];
    expect(habitWeekDone(logs, h, week)).toBe(0);
  });
});