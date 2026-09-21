import { describe, it, expect } from "vitest";
import { goalProgress } from "@/lib/goalStats";

describe("goalProgress", () => {
  it("clamps percent to 100 once the target is passed", () => {
    expect(goalProgress({ target: 10, current: 12 })).toEqual({ pct: 100, remaining: 0, achieved: true });
  });
  it("rounds mid-progress and keeps remaining honest", () => {
    expect(goalProgress({ target: 3, current: 1 })).toEqual({ pct: 33, remaining: 2, achieved: false });
  });
  it("is zeroed without a target or with negative inputs", () => {
    expect(goalProgress({})).toEqual({ pct: 0, remaining: 0, achieved: false });
    expect(goalProgress({ target: 0, current: 5 })).toEqual({ pct: 0, remaining: 0, achieved: false });
    expect(goalProgress({ target: -4, current: -9 })).toEqual({ pct: 0, remaining: 0, achieved: false });
  });
  it("treats a goal met exactly as achieved", () => {
    expect(goalProgress({ target: 8, current: 8 })).toEqual({ pct: 100, remaining: 0, achieved: true });
  });
});