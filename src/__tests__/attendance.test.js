import { describe, it, expect } from "vitest";
import {
  ATTENDANCE_STATUSES,
  ATTENDANCE_META,
  attendanceCounts,
  attendanceRate,
  requiredRate,
  recoveryPlan,
  summarizeCourse,
  summarizeAll,
  attendanceToForm,
  formToAttendancePatch,
  validateAttendanceForm,
  sortAttendance,
  isAttendanceStatus,
} from "@/lib/attendance";

const rows = (...statuses) => statuses.map((status, i) => ({ id: `a${i}`, course_id: "c1", date: `2026-09-${String(10 + i).padStart(2, "0")}`, status }));

describe("status registry", () => {
  it("labels every status the schema allows", () => {
    ATTENDANCE_STATUSES.forEach((s) => expect(ATTENDANCE_META[s]?.label).toBeTruthy());
    expect(ATTENDANCE_STATUSES).toEqual(["present", "absent", "late", "excused"]);
  });

  it("rejects anything the CHECK constraint would reject", () => {
    expect(isAttendanceStatus("present")).toBe(true);
    expect(isAttendanceStatus("holiday")).toBe(false);
    expect(isAttendanceStatus(undefined)).toBe(false);
  });
});

describe("attendanceCounts", () => {
  it("counts each status and ignores junk rows", () => {
    const c = attendanceCounts([...rows("present", "present", "late", "absent", "excused"), null, { status: "bogus" }, {}]);
    expect(c).toEqual({ present: 2, late: 1, absent: 1, excused: 1, total: 5 });
  });

  it("tolerates a missing list", () => {
    expect(attendanceCounts(undefined).total).toBe(0);
    expect(attendanceCounts(null).total).toBe(0);
  });
});

describe("attendanceRate", () => {
  it("counts late as attended — being late means you were there", () => {
    expect(attendanceRate(rows("present", "late"))).toBe(100);
  });

  it("drops excused sessions from the calculation entirely", () => {
    // 2 attended, 1 excused: excused must not drag the rate down to 66.7.
    expect(attendanceRate(rows("present", "present", "excused"))).toBe(100);
  });

  it("counts absences against the rate", () => {
    expect(attendanceRate(rows("present", "absent"))).toBe(50);
  });

  it("returns null rather than 0 when nothing has been judged", () => {
    // "no data" and "0%" must not look alike.
    expect(attendanceRate([])).toBeNull();
    expect(attendanceRate(rows("excused", "excused"))).toBeNull();
  });
});

describe("requiredRate", () => {
  it("uses the course's own threshold", () => {
    expect(requiredRate({ attendance_required: 75 })).toBe(75);
  });

  it("falls back to the schema default when unset", () => {
    expect(requiredRate({})).toBe(80);
    expect(requiredRate(undefined)).toBe(80);
  });

  it("clamps a nonsense threshold into 0–100", () => {
    expect(requiredRate({ attendance_required: 250 })).toBe(100);
    expect(requiredRate({ attendance_required: -10 })).toBe(0);
    expect(requiredRate({ attendance_required: "not a number" })).toBe(80);
  });
});

describe("recoveryPlan", () => {
  it("reports no-data before anything is judged", () => {
    const p = recoveryPlan([], 80);
    expect(p.status).toBe("no-data");
    expect(p.rate).toBeNull();
    expect(p.absencesLeft).toBeNull();
  });

  it("reports how many more absences are survivable when above target", () => {
    // 8/10 = 80% against an 80% target: one more absence gives 8/11 = 72.7%, so
    // there is no room left, but the rate is still met.
    const p = recoveryPlan(rows(...Array(8).fill("present"), "absent", "absent"), 80);
    expect(p.status).toBe("met");
    expect(p.rate).toBe(80);
    expect(p.absencesLeft).toBe(0);
  });

  it("allows absences while there is headroom above the target", () => {
    // 18/20 = 90% against 80%: attended*100/target - n = 22.5 - 20 = 2.
    const p = recoveryPlan(rows(...Array(18).fill("present"), "absent", "absent"), 80);
    expect(p.rate).toBe(90);
    expect(p.status).toBe("met");
    expect(p.absencesLeft).toBe(2);
  });

  it("computes the sessions needed to climb back to target", () => {
    // 3/5 = 60% against 70%: ceil((70*5 - 300)/30) = ceil(50/30) = 2.
    const p = recoveryPlan(rows("present", "present", "present", "absent", "absent"), 70);
    expect(p.rate).toBe(60);
    expect(p.status).toBe("below");
    expect(p.sessionsNeeded).toBe(2);
    // Verify the arithmetic actually lands on or above the target.
    expect(((3 + 2) / (5 + 2)) * 100).toBeGreaterThanOrEqual(70);
  });

  it("treats a 100% target as unreachable once anything is missed", () => {
    const missed = recoveryPlan(rows("present", "absent"), 100);
    expect(missed.stillPossible).toBe(false);
    expect(missed.sessionsNeeded).toBeNull();

    const clean = recoveryPlan(rows("present", "present"), 100);
    expect(clean.stillPossible).toBe(true);
    expect(clean.status).toBe("met");
  });

  it("never returns a negative session count", () => {
    const p = recoveryPlan(rows("present"), 50);
    expect(p.sessionsNeeded).toBeGreaterThanOrEqual(0);
  });

  it("handles a zero target as always met", () => {
    const p = recoveryPlan(rows("absent"), 0);
    expect(p.status).toBe("met");
  });
});

describe("summarizeCourse", () => {
  const course = { id: "c1", attendance_required: 80 };

  it("summarizes a course below its threshold", () => {
    const s = summarizeCourse(course, rows("present", "present", "absent", "absent", "absent"));
    expect(s.rate).toBe(40);
    expect(s.status).toBe("below");
    expect(s.target).toBe(80);
    expect(s.onTrack).toBe(false);
  });

  it("summarizes a course meeting its threshold", () => {
    const s = summarizeCourse(course, rows("present", "present", "present", "present", "absent"));
    expect(s.rate).toBe(80);
    expect(s.status).toBe("met");
    expect(s.onTrack).toBe(true);
  });

  it("reports no-data without pretending the course is failing", () => {
    const s = summarizeCourse(course, []);
    expect(s.status).toBe("no-data");
    expect(s.onTrack).toBe(false);
    expect(s.rate).toBeNull();
  });

  it("carries the course's own threshold, not a hardcoded one", () => {
    expect(summarizeCourse({ id: "c9", attendance_required: 60 }, rows("present", "absent")).target).toBe(60);
  });
});

describe("summarizeAll", () => {
  const courses = [
    { id: "c1", attendance_required: 80 },
    { id: "c2", attendance_required: 50 },
    { id: "c3", attendance_required: 80 },
  ];
  const all = [
    { course_id: "c1", status: "present" },
    { course_id: "c1", status: "present" },
    { course_id: "c2", status: "absent" },
    { course_id: "c2", status: "absent" },
  ];

  it("omits courses with no record instead of showing them at 0%", () => {
    const s = summarizeAll(courses, all);
    expect(s.summaries.map((x) => x.courseId)).toEqual(["c1", "c2"]);
    expect(s.coursesWithRecord).toBe(2);
  });

  it("weights the overall rate by judged sessions, not by averaging courses", () => {
    // c1: 2/2 attended. c2: 0/2. Overall is 2/4 = 50%, not (100 + 0) / 2 = 50 by
    // coincidence here — so use an uneven split to prove the weighting.
    const uneven = [
      { course_id: "c1", status: "present" },
      { course_id: "c1", status: "present" },
      { course_id: "c1", status: "present" },
      { course_id: "c1", status: "present" },
      { course_id: "c2", status: "absent" },
    ];
    const s = summarizeAll(courses, uneven);
    // 4/5 = 80%, not the 50% an average of course averages would give.
    expect(s.overallRate).toBe(80);
    expect(s.sessions).toBe(5);
  });

  it("lists only the courses actually below their threshold as at risk", () => {
    const s = summarizeAll(courses, all);
    expect(s.atRisk.map((x) => x.courseId)).toEqual(["c2"]);
  });

  it("returns null overall rate when nothing is judged", () => {
    const s = summarizeAll(courses, [{ course_id: "c1", status: "excused" }]);
    expect(s.overallRate).toBeNull();
    expect(s.coursesWithRecord).toBe(1);
  });

  it("tolerates missing input", () => {
    expect(summarizeAll(undefined, undefined).summaries).toEqual([]);
    expect(summarizeAll([], []).overallRate).toBeNull();
  });
});

describe("form mapping", () => {
  it("maps a row to an editable form", () => {
    expect(attendanceToForm({ course_id: "c1", date: "2026-09-10", status: "late" })).toEqual({
      course_id: "c1",
      date: "2026-09-10",
      status: "late",
    });
  });

  it("falls back to present for an unknown status", () => {
    expect(attendanceToForm({ status: "bogus" }).status).toBe("present");
    expect(attendanceToForm({}).status).toBe("present");
  });

  it("clears blanks to null rather than empty strings", () => {
    expect(formToAttendancePatch({ course_id: "", date: "", status: "present" })).toEqual({
      course_id: null,
      date: null,
      status: "present",
    });
  });
});

describe("validateAttendanceForm", () => {
  it("requires a course, a date and a valid status", () => {
    expect(validateAttendanceForm({ course_id: "c1", date: "2026-09-10", status: "present" })).toBeNull();
    expect(validateAttendanceForm({ date: "2026-09-10", status: "present" })).toBeTruthy();
    expect(validateAttendanceForm({ course_id: "c1", status: "present" })).toBeTruthy();
    expect(validateAttendanceForm({ course_id: "c1", date: "2026-09-10", status: "bogus" })).toBeTruthy();
  });
});

describe("sortAttendance", () => {
  it("sorts newest first and does not mutate the input", () => {
    const input = [
      { id: "old", date: "2026-09-01" },
      { id: "new", date: "2026-09-20" },
      { id: "mid", date: "2026-09-10" },
    ];
    const out = sortAttendance(input);
    expect(out.map((r) => r.id)).toEqual(["new", "mid", "old"]);
    expect(input.map((r) => r.id)).toEqual(["old", "new", "mid"]);
  });

  it("breaks date ties by created_at so the order is stable", () => {
    const out = sortAttendance([
      { id: "a", date: "2026-09-10", created_at: "2026-09-10T08:00:00Z" },
      { id: "b", date: "2026-09-10", created_at: "2026-09-10T09:00:00Z" },
    ]);
    expect(out.map((r) => r.id)).toEqual(["b", "a"]);
  });
});