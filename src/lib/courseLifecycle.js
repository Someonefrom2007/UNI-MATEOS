// Course lifecycle — the dependent map that keeps deletion honest.
//
// Deleting a course touches rows in nine other tables. Two adapters behave
// differently underneath (hosted Postgres cascades on FK, the local repo does
// not), so the plan is computed here, from real rows, and executed through the
// same `useUserData.mutate` surface the rest of the UI uses. Pure and testable.
//
// `optional: false` marks tables whose course_id is NOT NULL in the schema —
// their rows cannot survive without a course, so "keep my work" still has to
// delete them. Everything else is unlinked (course_id set to null) and kept.

export const COURSE_SCOPED = {
  Task: { field: "course_id", optional: true, label: "tasks" },
  Note: { field: "course_id", optional: true, label: "notes" },
  Resource: { field: "course_id", optional: true, label: "resources" },
  ScheduleEvent: { field: "course_id", optional: true, label: "classes & events" },
  FocusSession: { field: "course_id", optional: true, label: "focus sessions" },
  Project: { field: "course_id", optional: true, label: "projects" },
  Exam: { field: "course_id", optional: false, label: "exams" },
  Grade: { field: "course_id", optional: false, label: "grades" },
  Attendance: { field: "course_id", optional: false, label: "attendance records" },
};

const sameId = (a, b) => String(a ?? "") === String(b ?? "");

// Count every row that references this course, per entity.
export const courseDependents = (data, courseId) => {
  const counts = {};
  Object.entries(COURSE_SCOPED).forEach(([entity, cfg]) => {
    const rows = (data && data[entity]) || [];
    counts[entity] = rows.filter((r) => r && sameId(r[cfg.field], courseId)).length;
  });
  return counts;
};

export const dependentTotal = (counts = {}) =>
  Object.values(counts).reduce((sum, n) => sum + (Number(n) || 0), 0);

// Human-readable summary of what a course owns, ordered by the registry.
export const dependentSummary = (counts = {}) =>
  Object.entries(COURSE_SCOPED)
    .map(([entity, cfg]) => ({ entity, label: cfg.label, count: counts[entity] || 0 }))
    .filter((s) => s.count > 0);

// The plan for removing a course.
//   keepWork true  -> optional children are unlinked and kept; required ones are
//                     deleted (they cannot exist without a course).
//   keepWork false -> every dependent row is deleted with the course.
export const planCourseDelete = (data, courseId, { keepWork = true } = {}) => {
  const unlink = [];
  const remove = [];
  Object.entries(COURSE_SCOPED).forEach(([entity, cfg]) => {
    const rows = ((data && data[entity]) || []).filter((r) => r && sameId(r[cfg.field], courseId));
    rows.forEach((r) => {
      if (keepWork && cfg.optional) unlink.push({ entity, id: r.id });
      else remove.push({ entity, id: r.id });
    });
  });
  return { unlink, remove, total: unlink.length + remove.length, keepWork };
};

export const archiveCoursePatch = () => ({ archived: true });
export const restoreCoursePatch = () => ({ archived: false });
