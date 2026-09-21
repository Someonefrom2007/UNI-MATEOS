import { describe, it, expect } from "vitest";
import { minutesOnDate, minutesInRange, recentSessions } from "@/lib/focusStats";

const fix = (date, duration, created_at = "") => ({ date, duration, created_at });
const S = [
  fix("2026-09-14", 25, "a"),
  fix("2026-09-14", 50, "b"),
  fix("2026-09-16", 10, "c"),
  fix("2026-09-18", 40, "d"),
  fix("2026-09-17", 99, "e"),
];

describe("minutesOnDate", () => {
  it("sums durations for one day", () => {
    expect(minutesOnDate(S, "2026-09-14")).toBe(75);
    expect(minutesOnDate(S, "2026-09-15")).toBe(0);
  });
  it("is zero on empty input and guards missing durations", () => {
    expect(minutesOnDate([], "2026-09-14")).toBe(0);
    expect(minutesOnDate([{ date: "2026-09-14" }], "2026-09-14")).toBe(0);
  });
});

describe("minutesInRange", () => {
  it("includes both bounds", () => {
    expect(minutesInRange(S, "2026-09-14", "2026-09-16")).toBe(85);
    expect(minutesInRange(S, "2026-09-17", "2026-09-18")).toBe(139);
    expect(minutesInRange(S, "2026-09-15", "2026-09-15")).toBe(0);
  });
});

describe("recentSessions", () => {
  it("returns the newest n, newest first", () => {
    expect(recentSessions(S, 3).map((s) => s.date)).toEqual(["2026-09-18", "2026-09-17", "2026-09-16"]);
  });
  it("uses created_at as tiebreak", () => {
    expect(recentSessions(S, 2).map((s) => s.created_at)).toEqual(["d", "e"]);
  });
  it("is empty on empty input", () => {
    expect(recentSessions([], 5)).toEqual([]);
  });
});