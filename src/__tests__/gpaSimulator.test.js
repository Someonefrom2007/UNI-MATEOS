import { describe, it, expect } from "vitest";
import { courseGrade, ectsAverage, requiredGrade, totalWeight } from "@/lib/gradeEngine";
import { clampGrade, updateTargets, targetFeasibility } from "@/lib/gradesim";

const A = (grade, weight) => ({ grade, weight });

describe("GPA simulator: weighted grade calculations", () => {
  it("computes a weighted course grade", () => {
    expect(courseGrade([A(8, 40), A(6, 60)])).toBeCloseTo(6.8, 10);
  });

  it("ignores ungraded and zero-weight assessments", () => {
    expect(courseGrade([A(8, 0), A(6, 40), A(null, 60), A(undefined, 20)])).toBeCloseTo(6, 10);
  });

  it("returns null with no scored assessments", () => {
    expect(courseGrade([])).toBeNull();
    expect(courseGrade([A(null, 100)])).toBeNull();
  });

  it("computes ECTS-weighted GPA", () => {
    const courses = [
      { ects: 6, grade: 8 },
      { ects: 3, grade: 6 },
    ];
    expect(ectsAverage(courses)).toBeCloseTo((8 * 6 + 6 * 3) / 9, 10);
  });

  it("skips courses without grades or ECTS in the average", () => {
    expect(ectsAverage([{ ects: 6, grade: null }, { ects: 0, grade: 8 }])).toBeNull();
    expect(ectsAverage([{ ects: 6, grade: 7 }, { ects: null, grade: 10 }])).toBeCloseTo(7, 10);
  });

  it("tracks the total defined weight of a course", () => {
    expect(totalWeight([A(8, 30), A(null, 20), A(7, 0)])).toBe(50);
    expect(totalWeight([])).toBe(0);
  });
});

describe("GPA simulator: required-grade edge cases", () => {
  it("returns null on 0% remaining weight (all graded)", () => {
    const assessments = [A(9, 50), A(8, 50)];
    expect(requiredGrade(assessments, 8)).toBeNull();
    expect(targetFeasibility(assessments, 8)).toMatchObject({ remainingWeight: 0, required: null, feasible: true });
  });

  it("handles a target higher than any achievable remaining score", () => {
    // Already 3/10 with 20% remaining → needs 15+ on remaining → not feasible.
    const assessments = [A(3, 80), A(null, 20)];
    const f = targetFeasibility(assessments, 9);
    expect(f.feasible).toBe(false);
    expect(f.rawRequired).toBeGreaterThan(10);
    expect(f.required).toBe(10); // clamped display value
  });

  it("clamps the displayed required grade into 0–10", () => {
    const f = targetFeasibility([A(2, 90), A(null, 10)], 8);
    expect(f.required).toBeGreaterThanOrEqual(0);
    expect(f.required).toBeLessThanOrEqual(10);
  });

  it("0% remaining with a low target still reports feasible", () => {
    expect(targetFeasibility([A(6, 100)], 5).feasible).toBe(true);
  });

  it("computes exact required remaining score for a partial course", () => {
    // graded 50w @ 7, remaining 50w, target 8 → need (8*100 - 7*50)/50 = 9
    const f = targetFeasibility([A(7, 50), A(null, 50)], 8);
    expect(f.remainingWeight).toBe(50);
    expect(f.required).toBeCloseTo(9, 10);
    expect(f.feasible).toBe(true);
  });
});

describe("GPA simulator: interactive slider state updates", () => {
  it("clamps raw slider values to the 0–10 range", () => {
    expect(clampGrade(99)).toBe(10);
    expect(clampGrade(-3)).toBe(0);
    expect(clampGrade(7.4)).toBe(7.4);
    expect(clampGrade("8.5")).toBe(8.5);
    expect(clampGrade(undefined)).toBe(0);
  });

  it("updates the course → target map immutably", () => {
    const next = updateTargets({ c1: 7, c2: 8 }, "c2", 9.5);
    expect(next).toEqual({ c1: 7, c2: 9.5 });
    expect(Object.isFrozen({})).toBe(false);
    expect(next).not.toBe({});
  });

  it("replaces an existing target with a clamped value", () => {
    const next = updateTargets({ c1: 7 }, "c1", 12);
    expect(next.c1).toBe(10);
    expect(next.c2).toBeUndefined();
  });

  it("chains sequential slider drags like the component reducer", () => {
    let state = {};
    state = updateTargets(state, "c1", 5);
    state = updateTargets(state, "c1", 6.5);
    state = updateTargets(state, "c2", 8);
    expect(state).toEqual({ c1: 6.5, c2: 8 });
  });

  it("reproduces the Grades.jsx live recompute pipeline", () => {
    const assessments = [A(7.2, 40), A(8.1, 30), A(null, 30)];
    const target = clampGrade(7.5);
    const { required } = targetFeasibility(assessments, target);
    const expected = (7.5 * 100 - (7.2 * 40 + 8.1 * 30)) / 30;
    expect(required).toBeCloseTo(expected, 10);
  });
});