// Attention Engine — derives "what needs you" from real UNI·MATE data.
//
// Everything here is computed from rows the student already owns. There is no
// stored notification feed and no generated content: an item appears because a
// deadline, exam, conflict or risk actually exists, and disappears when it is
// resolved. That keeps the surface honest — an empty inbox means nothing is
// wrong, not that a list failed to load.
//
// Categories are deliberately coarse so the UI can group them, and every item
// carries a stable `key` so "dismiss" and "seen" survive re-derivation.

import { daysUntil } from "./format";

export const SEVERITY = {
  critical: 3,
  warning: 2,
  info: 1,
};

export const CATEGORIES = ["deadline", "exam", "schedule", "risk", "wellbeing"];

export const CATEGORY_META = {
  deadline: { label: "Deadlines", order: 1 },
  exam: { label: "Exams", order: 2 },
  schedule: { label: "Schedule", order: 3 },
  risk: { label: "Academic risk", order: 4 },
  wellbeing: { label: "Wellbeing", order: 5 },
};

const OVERDUE = (t) => t.status !== "completed" && t.due_date && daysUntil(t.due_date) < 0;

// Deadlines: overdue first, then anything due inside the horizon. Completed
// tasks are excluded so the count means outstanding work, not history.
export const deadlineItems = (tasks = [], { horizon = 7 } = {}) => {
  const items = [];
  for (const t of tasks) {
    if (t.status === "completed" || !t.due_date) continue;
    const n = daysUntil(t.due_date);
    if (n === null) continue;

    if (n < 0) {
      items.push({
        key: `deadline:overdue:${t.id}`,
        category: "deadline",
        severity: t.priority === "urgent" || t.priority === "high" ? "critical" : "warning",
        title: t.title,
        detail: `Overdue by ${Math.abs(n)} ${Math.abs(n) === 1 ? "day" : "days"}`,
        courseId: t.course_id || null,
        dueDate: t.due_date,
        days: n,
        to: "/tasks",
        taskId: t.id,
      });
    } else if (n <= horizon) {
      const label = n === 0 ? "Due today" : n === 1 ? "Due tomorrow" : `Due in ${n} days`;
      items.push({
        key: `deadline:soon:${t.id}`,
        category: "deadline",
        severity: n <= 1 ? "critical" : n <= 3 ? "warning" : "info",
        title: t.title,
        detail: label,
        courseId: t.course_id || null,
        dueDate: t.due_date,
        days: n,
        to: "/tasks",
        taskId: t.id,
      });
    }
  }
  return items.sort((a, b) => a.days - b.days);
};

// Exams: imminent assessments plus a preparation gap when topics exist but are
// mostly unreviewed. The prep item only fires when there is real topic data —
// otherwise we'd be inventing a study plan the student never made.
export const examItems = (exams = [], { horizon = 14 } = {}) => {
  const items = [];
  for (const e of exams) {
    if (e.status === "completed" || !e.date) continue;
    const n = daysUntil(e.date);
    if (n === null || n < 0 || n > horizon) continue;

    const label = n === 0 ? "Today" : n === 1 ? "Tomorrow" : `In ${n} days`;
    items.push({
      key: `exam:date:${e.id}`,
      category: "exam",
      severity: n <= 1 ? "critical" : n <= 4 ? "warning" : "info",
      title: e.name,
      detail: `${e.type ? `${e.type} · ` : ""}${label}${e.location ? ` · ${e.location}` : ""}`,
      courseId: e.course_id || null,
      dueDate: e.date,
      days: n,
      to: "/exams",
      examId: e.id,
    });

    const topics = e.topics || [];
    if (topics.length) {
      const unreviewed = topics.filter((tp) => !tp.reviewed);
      const weak = topics.filter((tp) => (tp.mastery || 0) < 60);
      if (unreviewed.length && n <= 7) {
        items.push({
          key: `exam:prep:${e.id}`,
          category: "exam",
          severity: n <= 2 ? "warning" : "info",
          title: `${e.name} — preparation`,
          detail: `${unreviewed.length} of ${topics.length} topics not reviewed${weak.length ? ` · ${weak.length} below 60% mastery` : ""}`,
          courseId: e.course_id || null,
          dueDate: e.date,
          days: n,
          to: "/exams",
          examId: e.id,
        });
      }
    }
  }
  return items.sort((a, b) => a.days - b.days);
};

// Schedule conflicts for a specific date, surfaced as one item per clash so the
// student sees which pair overlaps.
export const conflictItems = (conflicts = []) =>
  conflicts.map(({ a, b, dateStr }) => ({
    key: `conflict:${dateStr}:${a.id}:${b.id}`,
    category: "schedule",
    severity: "warning",
    title: `${a.title} overlaps ${b.title}`,
    detail: `${a.start_time}–${a.end_time || a.start_time} clashes with ${b.start_time}–${b.end_time || b.start_time}`,
    courseId: a.course_id || b.course_id || null,
    dueDate: dateStr,
    days: daysUntil(dateStr),
    to: "/schedule",
  }));

// Academic risk from real grade data: a graded course sitting below the pass
// mark, or below the student's own target. Courses with no grades yet are
// skipped — "no data" is not a risk signal.
/** @param {Array<object>} courses @param {{ gradeFor?: (course: any) => number|null }} [opts] */
export const riskItems = (courses = [], { gradeFor } = {}) => {
  const items = [];
  for (const c of courses) {
    if (c.archived) continue;
    const grade = gradeFor ? gradeFor(c) : null;
    if (grade === null || grade === undefined || Number.isNaN(grade)) continue;

    if (grade < 5) {
      items.push({
        key: `risk:fail:${c.id}`,
        category: "risk",
        severity: "critical",
        title: `${c.code || c.name} is below the pass mark`,
        detail: `Current average ${grade.toFixed(2)} · passing needs 5.00`,
        courseId: c.id,
        to: `/courses/${c.id}`,
      });
    } else if (c.target_grade && grade < c.target_grade) {
      const gap = c.target_grade - grade;
      if (gap >= 0.5) {
        items.push({
          key: `risk:target:${c.id}`,
          category: "risk",
          severity: gap >= 1.5 ? "warning" : "info",
          title: `${c.code || c.name} is under your target`,
          detail: `${grade.toFixed(2)} now · target ${Number(c.target_grade).toFixed(2)} · ${gap.toFixed(2)} to close`,
          courseId: c.id,
          to: `/courses/${c.id}`,
        });
      }
    }
  }
  return items;
};

// Wellbeing: sustained focus with no recorded breaks reads as burnout risk.
// Only fires once there is enough history to mean something.
/** @param {{ focusSessions?: Array<object>, todayStr?: string }} [opts] */
export const wellbeingItems = ({ focusSessions = [], todayStr } = {}) => {
  const items = [];
  if (!todayStr || focusSessions.length < 5) return items;

  const byDay = {};
  for (const s of focusSessions) {
    if (!s.date || s.date > todayStr) continue;
    byDay[s.date] = (byDay[s.date] || 0) + (s.duration || 0);
  }
  const days = Object.keys(byDay).sort().slice(-7);
  const heavy = days.filter((d) => byDay[d] >= 240);

  if (heavy.length >= 3) {
    items.push({
      key: "wellbeing:load",
      category: "wellbeing",
      severity: "info",
      title: "Heavy focus stretch",
      detail: `${heavy.length} of the last ${days.length} days passed 4 hours of focus. Consider a lighter day.`,
      to: "/focus",
    });
  }
  return items;
};

const SEVERITY_RANK = { critical: 0, warning: 1, info: 2 };

// One call that produces the whole inbox, sorted by urgency then recency.
/**
 * @param {{
 *   tasks?: Array<object>, exams?: Array<object>, courses?: Array<object>,
 *   conflicts?: Array<object>, focusSessions?: Array<object>,
 *   gradeFor?: (course: any) => number|null, todayStr?: string,
 *   horizon?: number, examHorizon?: number,
 * }} [input]
 */
export const buildNotifications = ({
  tasks = [],
  exams = [],
  courses = [],
  conflicts = [],
  focusSessions = [],
  gradeFor,
  todayStr,
  horizon = 7,
  examHorizon = 14,
} = {}) => {
  const items = [
    ...deadlineItems(tasks, { horizon }),
    ...examItems(exams, { horizon: examHorizon }),
    ...conflictItems(conflicts),
    ...riskItems(courses, { gradeFor }),
    ...wellbeingItems({ focusSessions, todayStr }),
  ];

  return items.sort((a, b) => {
    const s = (SEVERITY_RANK[a.severity] ?? 3) - (SEVERITY_RANK[b.severity] ?? 3);
    if (s !== 0) return s;
    const da = a.days ?? 999;
    const db = b.days ?? 999;
    if (da !== db) return da - db;
    return String(a.title).localeCompare(String(b.title));
  });
};

export const countBySeverity = (items = []) => ({
  critical: items.filter((i) => i.severity === "critical").length,
  warning: items.filter((i) => i.severity === "warning").length,
  info: items.filter((i) => i.severity === "info").length,
  total: items.length,
});

// Group for display, keeping category order stable and skipping empty groups.
export const groupNotifications = (items = []) =>
  CATEGORIES.map((category) => ({
    category,
    ...CATEGORY_META[category],
    items: items.filter((i) => i.category === category),
  }))
    .filter((g) => g.items.length)
    .sort((a, b) => a.order - b.order);

// Dismissals and read state are keyed by the stable item key, so they survive
// recomputation and only apply to the exact condition the student acted on.
export const applyDismissed = (items = [], dismissed = []) => {
  const set = new Set(dismissed || []);
  return items.filter((i) => !set.has(i.key));
};

export const pruneDismissed = (dismissed = [], items = []) => {
  // Drop keys that no longer match a live item so storage can't grow forever.
  const live = new Set(items.map((i) => i.key));
  return (dismissed || []).filter((k) => live.has(k));
};
