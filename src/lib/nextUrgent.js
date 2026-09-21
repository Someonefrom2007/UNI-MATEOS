// Urgent dashboard lens — the priority queue behind AttentionCard and the
// hero banner. Pure and date-string deterministic (local-day whole maths, no
// clock-time noise) so "what needs me now" is stable across timezones.

/**
 * @typedef {{ id?: string, name?: string, course_id?: string, date?: string, status?: string }} UrgentExam
 * @typedef {{ id?: string, title?: string, course_id?: string, due_date?: string, status?: string, priority?: string }} UrgentTask
 * @typedef {{ id?: string, name?: string, color?: string }} UrgentCourse
 */

/**
 * Whole days between two YYYY-MM-DD strings (positive = future).
 * @param {string} dateStr
 * @param {string} todayStr YYYY-MM-DD.
 * @returns {number | null}
 */
export const daysBetween = (dateStr, todayStr) => {
  if (!dateStr || !todayStr) return null;
  const a = new Date(dateStr + "T00:00:00").getTime();
  const b = new Date(todayStr + "T00:00:00").getTime();
  return Math.round((a - b) / 86400000);
};

/**
 * Exams within 7 days plus tasks due within 2 days (incl. overdue), sorted by
 * urgency and capped at 4 — with each item joined to its course.
 * @param {UrgentExam[]} exams
 * @param {UrgentTask[]} tasks
 * @param {UrgentCourse[]} courses
 * @param {string} todayStr YYYY-MM-DD.
 * @returns {Array<{ kind: "exam" | "task", item: object, n: number, course?: object }>}
 */
export const nextUrgent = (exams, tasks, courses, todayStr) => {
  const courseOf = (courseId) => (courses || []).find((c) => c.id === courseId);
  const urgent = [];

  (exams || []).forEach((e) => {
    if (e.status === "completed") return;
    const n = daysBetween(e.date, todayStr);
    if (n !== null && n >= 0 && n <= 7) urgent.push({ kind: "exam", item: e, n, course: courseOf(e.course_id) });
  });

  (tasks || []).forEach((t) => {
    if (t.status === "completed") return;
    const n = daysBetween(t.due_date, todayStr);
    if (n !== null && n <= 2) urgent.push({ kind: "task", item: t, n, course: courseOf(t.course_id) });
  });

  return urgent.sort((a, b) => a.n - b.n).slice(0, 4);
};