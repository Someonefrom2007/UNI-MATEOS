// Attendance — pure engine over the `attendance` rows the data layer already
// loads (id, course_id, date, status). The table, RLS and the per-course
// `attendance_required` column all predate this file; what was missing was any
// way to read them, so the module and its UI are the only new surface.
//
// Rate semantics are stated here rather than assumed silently, because the
// student has to be able to see why a number is what it is:
//   - `present` and `late` both count as attended. Being late means you were
//     there; it is recorded separately so it can be reported, not punished.
//   - `absent` counts against you.
//   - `excused` is dropped from the calculation entirely — an authorised
//     absence is not something to hold against the student.
// The threshold itself is never invented: it comes from the course's own
// `attendance_required` (default 80 in the schema), which the student controls.

export const ATTENDANCE_STATUSES = ["present", "absent", "late", "excused"];

export const ATTENDANCE_META = {
  present: { label: "Present", tone: "emerald" },
  late: { label: "Late", tone: "amber" },
  absent: { label: "Absent", tone: "rose" },
  excused: { label: "Excused", tone: "cyan" },
};

export const DEFAULT_REQUIRED = 80;

export const isAttendanceStatus = (status) => ATTENDANCE_STATUSES.includes(status);

// Counts for a single course's rows (or any pre-filtered set).
export const attendanceCounts = (rows) => {
  const counts = { present: 0, late: 0, absent: 0, excused: 0, total: 0 };
  (Array.isArray(rows) ? rows : []).forEach((r) => {
    if (!r || !isAttendanceStatus(r.status)) return;
    counts[r.status] += 1;
    counts.total += 1;
  });
  return counts;
};

// Attendances that are actually judged: excused sessions are excluded so an
// authorised absence can neither help nor hurt the rate.
export const judged = (counts) => counts.present + counts.late + counts.absent;

// Percentage 0–100, or null when nothing has been judged yet. Null rather than
// 0 or 100 because "no data" and "perfect record" must not look alike.
export const attendanceRate = (rows) => {
  const counts = attendanceCounts(rows);
  const n = judged(counts);
  if (n === 0) return null;
  return ((counts.present + counts.late) / n) * 100;
};

// The threshold a course is measured against, clamped to a sane 0–100 range.
export const requiredRate = (course) => {
  const raw = Number(course?.attendance_required);
  if (!Number.isFinite(raw)) return DEFAULT_REQUIRED;
  return Math.min(100, Math.max(0, raw));
};

// Keeping a target can be recoverable or not. `stillPossible` is false once the
// record is damaged beyond repair, so the UI can say "you cannot reach 80% from
// here" instead of showing an unreachable number of sessions to attend.
export const recoveryPlan = (rows, target) => {
  const counts = attendanceCounts(rows);
  const attended = counts.present + counts.late;
  const n = judged(counts);
  const rate = n === 0 ? null : (attended / n) * 100;

  if (n === 0) return { rate: null, status: "no-data", sessionsNeeded: 0, absencesLeft: null, stillPossible: true };
  if (rate >= target) {
    // How many further judged sessions may be missed before dropping under the
    // target: attended / (n + k) >= target/100.
    const allowed = target <= 0 ? Infinity : Math.floor((attended * 100) / target - n);
    return {
      rate,
      status: "met",
      sessionsNeeded: 0,
      absencesLeft: Number.isFinite(allowed) ? Math.max(0, allowed) : null,
      stillPossible: true,
    };
  }

  if (target >= 100) {
    // Only a flawless record reaches 100%, so any absence is unrecoverable.
    return { rate, status: "below", sessionsNeeded: null, absencesLeft: 0, stillPossible: attended === 0 };
  }

  // Attending x more sessions in a row: (attended + x) / (n + x) >= target/100.
  const x = Math.ceil((target * n - attended * 100) / (100 - target));
  return { rate, status: "below", sessionsNeeded: Math.max(0, x), absencesLeft: 0, stillPossible: true };
};

// One course's attendance summary: counts, rate, the course's own threshold and
// what it would take to get back above it.
export const summarizeCourse = (course, rows) => {
  const counts = attendanceCounts(rows);
  const target = requiredRate(course);
  const plan = recoveryPlan(rows, target);
  return {
    courseId: course?.id ?? null,
    counts,
    target,
    rate: plan.rate,
    // `rate` and `plan.rate` are the same number; status is the comparison.
    status: plan.rate === null ? "no-data" : plan.rate >= target ? "met" : "below",
    sessionsNeeded: plan.sessionsNeeded,
    absencesLeft: plan.absencesLeft,
    stillPossible: plan.stillPossible,
    // A rate can be above the threshold while still being worth flagging when
    // the margin is thin; the UI reads absencesLeft for that, not this flag.
    onTrack: plan.rate !== null && plan.rate >= target,
  };
};

// All courses that actually have attendance rows, plus an overall rate across
// them. Courses with no rows are omitted rather than shown at 0% — no record is
// not the same as a bad record. `overallRate` is weighted by judged sessions,
// not an average of averages, so a course with 2 sessions cannot swing it.
export const summarizeAll = (courses, rows) => {
  const list = Array.isArray(courses) ? courses : [];
  const all = Array.isArray(rows) ? rows : [];
  const summaries = [];
  let attended = 0;
  let n = 0;

  list.forEach((course) => {
    const own = all.filter((r) => r?.course_id === course.id);
    if (!own.length) return;
    summaries.push(summarizeCourse(course, own));
    const counts = attendanceCounts(own);
    attended += counts.present + counts.late;
    n += judged(counts);
  });

  return {
    summaries,
    coursesWithRecord: summaries.length,
    sessions: n,
    overallRate: n === 0 ? null : (attended / n) * 100,
    atRisk: summaries.filter((s) => s.status === "below"),
  };
};

// Row -> editable form, and back. Mirrors the recordForms convention so the
// dialog behaves like every other editor.
export const attendanceToForm = (row = {}) => ({
  course_id: row.course_id ?? null,
  date: row.date ? String(row.date) : "",
  status: isAttendanceStatus(row.status) ? row.status : "present",
});

export const formToAttendancePatch = (form = {}) => ({
  course_id: form.course_id || null,
  date: form.date || null,
  status: isAttendanceStatus(form.status) ? form.status : "present",
});

export const validateAttendanceForm = (form = {}) => {
  if (!form.course_id) return "Pick the course this session belongs to.";
  if (!form.date) return "A session needs a date.";
  if (!isAttendanceStatus(form.status)) return "Pick a valid attendance status.";
  return null;
};

// Newest first for the log, with a stable fallback for rows sharing a date.
export const sortAttendance = (rows) =>
  (Array.isArray(rows) ? rows.slice() : []).sort((a, b) => {
    const d = String(b?.date || "").localeCompare(String(a?.date || ""));
    if (d !== 0) return d;
    return String(b?.created_at || "").localeCompare(String(a?.created_at || ""));
  });