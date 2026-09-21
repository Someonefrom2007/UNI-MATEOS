// Mission 15 — Attendance. A thin, derived, honest engine grounded in the ONE
// truth that exists on disk: the attendance table's status vocabulary
// (present | absent | late | excused). Buckets are real classifications of
// that vocabulary, never invented states.
//
// Honesty rules (non-negotiable):
//  - A rate is ONLY a real attended/denominator ratio over actual rows.
//    It is null when there are no ineligible rows (empty history, or all
//    excused) — never a fabricated 0% or 100%.
//  - atRisk is a STRICT comparison of that real rate against the course's real
//    attendance_required mapping. It never fires off a made-up number.
//  - excused rows lower the denominator (you do not lose credit for a real
//    excuse) but attended adds nothing for them either.
// Pure + node-safe: no React, no component state, only derived numbers.
import { todayISO } from "@/lib/format";

const ATTENDED = new Set(["present", "late"]);
const MISSED = new Set(["absent"]);
const EXCUSED = new Set(["excused"]);

export const statusBucket = (s) =>
  ATTENDED.has(s) ? "attended" : MISSED.has(s) ? "missed" : EXCUSED.has(s) ? "excused" : null;

export const isAttended = (s) => ATTENDED.has(s);
export const isMissed = (s) => MISSED.has(s);
export const isExcused = (s) => EXCUSED.has(s);

export const courseMetrics = (rows) => {
  const counts = { total: rows.length, attended: 0, missed: 0, excused: 0 };
  for (const r of rows) {
    const b = statusBucket(r.status);
    if (b === "attended") counts.attended += 1;
    else if (b === "missed") counts.missed += 1;
    else if (b === "excused") counts.excused += 1;
  }
  const denominator = counts.total - counts.excused;
  return {
    ...counts,
    rate: denominator > 0 ? counts.attended / denominator : null,
  };
};

export const buildAttendanceSummary = ({
  rows = [],
  courses = [],
  requiredByCourse = {},
  today = todayISO(),
}) => {
  const summaries = courses.map((course) => {
    const metrics = courseMetrics(rows.filter((r) => r.course_id === course.id));
    const required = requiredByCourse[course.id];
    const rate = metrics.rate;
    const atRisk = rate !== null && typeof required === "number" && rate * 100 < required;
    return { ...course, ...metrics, rate, atRisk };
  });
  return { summaries };
};
