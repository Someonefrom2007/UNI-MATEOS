import { describe, it, expect } from "vitest";
import { todayISO } from "@/lib/format";
import {
  courseMetrics,
  buildAttendanceSummary,
  statusBucket,
  isAttended,
  isExcused,
  isLate,
} from "@/lib/attendance";

const R = (status) => ({ course_id: "c1", status, date: "2026-09-07" });
const C = (id, name) => ({ id, name });

describe("attendance engine (real schema vocabulary)", () => {
  it("maps only the schema statuses present|absent|late|excused to real buckets", () => {
    expect(statusBucket("present")).toBe("attended");
    expect(statusBucket("late")).toBe("attended");
    expect(statusBucket("absent")).toBe("missed");
    expect(statusBucket("excused")).toBe("excused");
    expect(statusBucket("tardy")).toBeNull();
    expect(isAttended("present")).toBe(true);
    expect(isAttended("late")).toBe(true);
    expect(isAttended("absent")).toBe(false);
    expect(isExcused("excused")).toBe(true);
  });

  it("never fabricates a rate for an empty or excused-only history", () => {
    expect(courseMetrics([]).rate).toBeNull();
    expect(courseMetrics([R("excused")]).rate).toBeNull();
  });

  it("rate is the real attended denominator ratio, excused excluded", () => {
    const m = courseMetrics([
      R("present"),
      R("late"),
      R("present"),
      R("absent"),
      R("excused"),
    ]);
    expect(m.total).toBe(5);
    expect(m.attended).toBe(3);
    expect(m.missed).toBe(1);
    expect(m.excused).toBe(1);
    expect(m.rate).toBeCloseTo(3 / 4);
  });

  it("summary derives courses strictly from real rows and a real required mapping", () => {
    const out = buildAttendanceSummary({
      rows: [R("present"), R("late"), R("absent")],
      courses: [C("c1", "Linear Algebra")],
      requiredByCourse: { c1: 80 },
      today: todayISO(),
    });
    const s = out.summaries.find((x) => x.id === "c1");
    expect(s.rate).toBeCloseTo(2 / 3);
    expect(s.atRisk).toBe(true);
  });

  it("does not declare atRisk on a fabricated zero row state", () => {
    const out = buildAttendanceSummary({
      rows: [],
      courses: [C("c1", "Linear Algebra")],
      requiredByCourse: { c1: 80 },
      today: todayISO(),
    });
    const s = out.summaries.find((x) => x.id === "c1");
    expect(s.rate).toBeNull();
    expect(s.atRisk).toBe(false);
  });
});
