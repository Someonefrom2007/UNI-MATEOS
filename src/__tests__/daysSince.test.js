import { describe, it, expect, vi, afterEach } from "vitest";
import { daysSince, daysUntil, toLocalISO } from "@/lib/format";

const at = (iso) => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(`${iso}T09:00:00`));
};

afterEach(() => {
  vi.useRealTimers();
});

// `daysSince` exists so past-dated records ("last studied yesterday") are not
// rendered with deadline wording ("Due tomorrow"). It is the mirror of
// daysUntil, so the two must never disagree in sign or magnitude.
describe("daysSince", () => {
  it("counts whole days from a past date up to today", () => {
    at("2026-03-10");
    expect(daysSince("2026-03-10")).toBe(0);
    expect(daysSince("2026-03-09")).toBe(1);
    expect(daysSince("2026-03-01")).toBe(9);
  });

  it("is negative for a future date, mirroring daysUntil", () => {
    at("2026-03-10");
    expect(daysSince("2026-03-12")).toBe(-2);
  });

  it("mirrors daysUntil, except that today is a plain 0 and not -0", () => {
    at("2026-03-10");
    for (const d of ["2026-03-01", "2026-03-09", "2026-03-11", "2026-04-01"]) {
      expect(daysSince(d)).toBe(-daysUntil(d));
    }
    expect(Object.is(daysSince("2026-03-10"), 0)).toBe(true);
    expect(daysUntil("2026-03-10")).toBe(0);
  });

  it("returns null for a missing date so callers can show an honest blank", () => {
    expect(daysSince(null)).toBeNull();
    expect(daysSince(undefined)).toBeNull();
    expect(daysSince("")).toBeNull();
  });

  it("does not drift across a month boundary", () => {
    at("2026-03-01");
    expect(daysSince("2026-02-27")).toBe(2);
  });

  it("agrees with the local ISO helper for today", () => {
    at("2026-03-10");
    expect(daysSince(toLocalISO(new Date()))).toBe(0);
  });
});
