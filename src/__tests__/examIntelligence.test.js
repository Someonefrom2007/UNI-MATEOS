import { describe, expect, it } from "vitest";
import {
  ASSESSMENT_SCALE,
  PASS_THRESHOLD,
  readinessOf,
  predictedScore,
  scoreBand,
  stepsToPass,
  toScale,
} from "@/lib/examIntelligence";

const GRADES = [
  { course_id: "eco", grade: 6, weight: 40 },
  { course_id: "eco", grade: 4, weight: 30 },
  { course_id: "law", grade: 9, weight: 20 },
];

describe("toScale", () => {
  it("clamps onto the 0-10 scale and rejects junk", () => {
    expect(toScale(8.5)).toBe(8.5);
    expect(toScale(20)).toBe(ASSESSMENT_SCALE);
    expect(toScale(-3)).toBe(0);
    expect(toScale("x")).toBe(null);
    expect(toScale(undefined)).toBe(null);
  });
});

describe("predictedScore", () => {
  it("prefers the recorded result when the exam is completed", () => {
    const out = predictedScore({ status: "completed", grade: 7.25, course_id: "eco" }, GRADES);
    expect(out).toEqual({ value: 7.25, confidence: "exact", source: "Recorded result" });
  });

  it("falls back to the expected grade", () => {
    const out = predictedScore({ status: "upcoming", expected_grade: 6.5, course_id: "eco" }, GRADES);
    expect(out.confidence).toBe("medium");
    expect(out.value).toBe(6.5);
  });

  it("uses weighted course history otherwise", () => {
    const out = predictedScore({ status: "upcoming", course_id: "eco" }, GRADES);
    expect(out.source).toContain("2 scored");
    const expected = (6 * 40 + 4 * 30) / 70;
    expect(out.value).toBe(+expected.toFixed(2));
  });

  it("returns null with no signal at all", () => {
    expect(predictedScore({ status: "upcoming", course_id: "eco" }, [])).toBe(null);
    expect(predictedScore({ status: "upcoming", course_id: "none" }, GRADES)).toBe(null);
  });

  it("reflects better confidence with more history", () => {
    const more = [...GRADES, { course_id: "eco", grade: 7, weight: 30 }];
    expect(predictedScore({ course_id: "eco" }, more).confidence).toBe("good");
  });
});

describe("scoreBand", () => {
  it("markers high / pass / risk from their margins", () => {
    expect(scoreBand(7).key).toBe("high");
    expect(scoreBand(5.4).key).toBe("pass");
    expect(scoreBand(4.9).key).toBe("risk");
    expect(scoreBand(2).label).toBe("At risk");
    expect(scoreBand(null)).toBe(null);
  });
});

describe("readinessOf", () => {
  it("averages mastery and ranks weakest first", () => {
    const out = readinessOf([{ name: "b", mastery: 70 }, { name: "a", mastery: 20 }]);
    expect(out.readiness).toBe(45);
    expect(out.weakest[0].name).toBe("a");
  });

  it("returns null for an empty topic set and clamps out-of-range mastery", () => {
    expect(readinessOf([])).toBe(null);
    const out = readinessOf([{ mastery: 300 }, { mastery: -1 }]);
    expect(out.weakest[0].mastery).toBe(0);
    expect(out.weakest[1].mastery).toBe(100);
  });
});

describe("stepsToPass", () => {
  it("asks to maintain when already safe", () => {
    const out = stepsToPass(7, [{ name: "x", mastery: 90 }]);
    expect(out.gap).toBe(0);
    expect(out.steps[0].kind).toBe("maintain");
  });

  it("derives mastery targets from the weakest topics around a deficit", () => {
    const out = stepsToPass(3.5, [
      { name: "weak", mastery: 10 },
      { name: "ok", mastery: 60 },
    ]);
    expect(out.gap).toBe(PASS_THRESHOLD - 3.5);
    expect(out.steps[0].kind).toBe("mastery");
    expect(out.steps[0].topic).toBe("weak");
    expect(out.steps.some((s) => s.kind === "schedule")).toBe(true);
  });

  it("returns null without a prediction", () => {
    expect(stepsToPass(null, [])).toBe(null);
  });
});