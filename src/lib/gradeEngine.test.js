import { describe, it, expect } from "vitest";
import {
  GRADE_BANDS,
  gradeBand,
  courseGrade,
  totalWeight,
  requiredGrade,
  projectedGrade,
  ectsAverage,
} from "./gradeEngine";

describe("gradeBand", () => {
  it("maps 0-10 scores to the Spanish grade bands", () => {
    expect(gradeBand(10)).toBe(GRADE_BANDS[0]); // Sobresaliente
    expect(gradeBand(9.5)).toBe(GRADE_BANDS[0]);
    expect(gradeBand(9.0)).toBe(GRADE_BANDS[0]);
    expect(gradeBand(8.999)).toBe(GRADE_BANDS[1]); // Notable
    expect(gradeBand(7.35)).toBe(GRADE_BANDS[1]);
    expect(gradeBand(7.0)).toBe(GRADE_BANDS[1]);
    expect(gradeBand(6.999)).toBe(GRADE_BANDS[2]); // Aprobado
    expect(gradeBand(5.2)).toBe(GRADE_BANDS[2]);
    expect(gradeBand(5.0)).toBe(GRADE_BANDS[2]);
    expect(gradeBand(4.999)).toBe(GRADE_BANDS[3]); // Suspenso
    expect(gradeBand(0)).toBe(GRADE_BANDS[3]);
  });

  it("returns null for missing or NaN grades", () => {
    expect(gradeBand(null)).toBeNull();
    expect(gradeBand(undefined)).toBeNull();
    expect(gradeBand(NaN)).toBeNull();
  });
});

describe("courseGrade", () => {
  it("computes a weighted average", () => {
    const assessments = [
      { grade: 8, weight: 50 },
      { grade: 6, weight: 50 },
    ];
    expect(courseGrade(assessments)).toBeCloseTo(7, 5);
  });

  it("is not skewed by weights when equal", () => {
    expect(courseGrade([{ grade: 10, weight: 40 }, { grade: 5, weight: 60 }])).toBeCloseTo(7, 5);
  });

  it("ignores ungraded or zero-weight assessments", () => {
    expect(courseGrade([{ grade: 8, weight: 50 }, { grade: null, weight: 50 }, { grade: 6, weight: 0 }])).toBeCloseTo(8, 5);
  });

  it("returns null when nothing is graded", () => {
    expect(courseGrade([])).toBeNull();
    expect(courseGrade([{ grade: null, weight: 50 }])).toBeNull();
  });
});

describe("totalWeight", () => {
  it("sums defined weights, coercing falsy to 0", () => {
    expect(totalWeight([{ weight: 30 }, { weight: 20 }, { weight: null }])).toBe(50);
    expect(totalWeight([])).toBe(0);
  });
});

describe("requiredGrade", () => {
  it("computes the score needed on remaining assessments to hit a target", () => {
    const assessments = [
      { grade: 8, weight: 50 },
      { grade: null, weight: 50 },
    ];
    // (8*50 + x*50) / 100 = 7  =>  x = 6
    expect(requiredGrade(assessments, 7)).toBeCloseTo(6, 5);
  });

  it("returns null when nothing remains", () => {
    expect(requiredGrade([{ grade: 8, weight: 100 }], 7)).toBeNull();
  });

  it("clamps to the valid 0-10 range", () => {
    const impossible = [{ grade: 3, weight: 90 }, { grade: null, weight: 10 }];
    expect(requiredGrade(impossible, 10)).toBe(10);

    const trivial = [{ grade: 9, weight: 90 }, { grade: null, weight: 10 }];
    expect(requiredGrade(trivial, 5)).toBe(0);
  });
});

describe("projectedGrade", () => {
  it("projects the final grade when the hypothetical is reached on all remaining", () => {
    const assessments = [
      { grade: 8, weight: 50 },
      { grade: null, weight: 50 },
    ];
    expect(projectedGrade(assessments, 10)).toBeCloseTo(9, 5);
    expect(projectedGrade(assessments, 5)).toBeCloseTo(6.5, 5);
  });

  it("returns null when no assessment has weight", () => {
    expect(projectedGrade([], 10)).toBeNull();
  });
});

describe("ectsAverage", () => {
  it("computes the ECTS-weighted average across graded courses", () => {
    const courses = [
      { ects: 6, grade: 8 },
      { ects: 6, grade: 6 },
      { ects: 12, grade: null }, // not yet graded, ignored
    ];
    expect(ectsAverage(courses)).toBeCloseTo(7, 5);
  });

  it("returns null when no course has a grade", () => {
    expect(ectsAverage([])).toBeNull();
    expect(ectsAverage([{ ects: 6, grade: null }])).toBeNull();
  });
});