// Advanced Analytics — parity reference. NOT the implementation any more.
//
// These derivations used to run in the browser and power the Analytics hub.
// They were pure functions over focus_sessions/tasks/grades/courses — all
// FREE-tier tables with deliberately untouched RLS — so a free user could
// reproduce every Pro number by hand, which made the paywall cosmetic.
//
// The authoritative implementation is now public.advanced_analytics(), a
// SECURITY DEFINER function in
// supabase/migrations/20260929000000_paid_entitlement_enforcement.sql, which
// computes the same figures server-side and refuses non-entitled callers with
// 42501. src/pages/Analytics.jsx calls that RPC and no longer imports this file.
//
// This copy is retained as the readable specification the SQL is checked
// against. It is intentionally NOT exported to the app: there is no parity
// harness comparing the two implementations line by line, so a second copy can
// only drift. Treat the SQL as the source of truth; if you change a rule here,
// change it there too, and re-run `npm run verify:hosted:all`.
import { toLocalISO } from "@/lib/format";

const DAY_MS = 86400000;

const isoDay = (value) => String(value || "").slice(0, 10);

const dayStart = (value) => new Date(`${isoDay(value) || "1970-01-01"}T00:00:00`);

/**
 * Monday-start of the week containing `date` (local time).
 * @param {string} date - yyyy-mm-dd
 * @returns {string}
 */
export const weekStartOf = (date) => {
  const d = dayStart(date);
  const dow = (d.getDay() + 6) % 7; // Mon=0
  d.setDate(d.getDate() - dow);
  return toLocalISO(d);
};

/** Monday-start of a week `offset` weeks before the week containing today. */
export const weekBefore = (today, offset) => {
  const start = weekStartOf(today);
  const d = dayStart(start);
  d.setDate(d.getDate() - offset * 7);
  return toLocalISO(d);
};

const activeOn = (tasks = [], sessions = []) => {
  const active = new Set();
  tasks.forEach((t) => {
    if (t.status === "completed" && t.completed_date) active.add(isoDay(t.completed_date));
  });
  sessions.forEach((s) => active.add(isoDay(s.date)));
  return active;
};

/**
 * Current and best consecutive study-day streaks. A day counts when it has at
 * least one completed task (with a completed date) or a focus session.
 * @param {Array<object>} tasks
 * @param {Array<object>} sessions
 * @param {{ today?: string }} [options]
 * @returns {{ current: number, best: number }}
 */
export const studyStreaks = (tasks = [], sessions = [], options = {}) => {
  const active = activeOn(tasks, sessions);
  const today = isoDay(options.today ?? new Date().toISOString());
  const ts = dayStart(today).getTime();

  let best = 0;
  let run = 0;
  for (let i = 0; i < 1200; i += 1) {
    const key = toLocalISO(new Date(ts - i * DAY_MS));
    if (active.has(key)) {
      run += 1;
      if (run > best) best = run;
    } else {
      run = 0;
    }
  }

  if (!active.has(today)) return { current: 0, best };

  let current = 0;
  for (let offset = 0; offset < 1200; offset += 1) {
    const key = toLocalISO(new Date(ts - offset * DAY_MS));
    if (active.has(key)) current += 1;
    else break;
  }
  return { current, best };
};

/**
 * Minutes of focused study per Monday-week for the last `weeks` weeks.
 * @param {Array<{ date?: string, duration?: number }>} sessions
 * @param {{ weeks?: number, today?: string }} [options]
 * @returns {Array<{ week: string, minutes: number }>}
 */
export const weeklyFocus = (sessions = [], options = {}) => {
  const weeks = options.weeks ?? 8;
  const today = isoDay(options.today ?? new Date().toISOString());
  const bucket = new Map();
  sessions.forEach((s) => {
    if (!s.date) return;
    const key = weekStartOf(isoDay(s.date));
    bucket.set(key, (bucket.get(key) || 0) + (Number(s.duration) || 0));
  });
  const out = [];
  for (let i = weeks - 1; i >= 0; i -= 1) {
    const key = weekBefore(today, i);
    out.push({ week: key, minutes: bucket.get(key) || 0 });
  }
  return out;
};

/**
 * Completion profile of the task backlog.
 * @param {Array<{ status?: string, due_date?: string }>} tasks
 * @param {{ today?: string }} [options]
 * @returns {{ done: number, inProgress: number, open: number, total: number, pct: number, overdue: number }}
 */
export const completionStats = (tasks = [], options = {}) => {
  const today = isoDay(options.today ?? new Date().toISOString());
  const done = tasks.filter((t) => t.status === "completed").length;
  const inProgress = tasks.filter((t) => t.status === "in_progress").length;
  const open = tasks.filter((t) => t.status && t.status !== "completed").length;
  const overdue = tasks.filter(
    (t) => t.status !== "completed" && t.due_date && isoDay(t.due_date) < today
  ).length;
  const total = tasks.length;
  return {
    done,
    inProgress,
    open,
    total,
    pct: total ? Math.round((done / total) * 100) : 0,
    overdue,
  };
};

const avg = (nums) => (nums.length ? nums.reduce((s, n) => s + n, 0) / nums.length : null);

/**
 * Weighted grade trajectory plus per-course performance.
 * @param {Array<{ grade?: number, weight?: number, date?: string, created_at?: string, course_id?: string }>} grades
 * @param {Array<{ id?: string, name?: string }>} courses
 * @returns {object}
 */
export const gradeTrajectory = (grades = [], courses = []) => {
  const graded = grades
    .filter((g) => g.grade !== null && g.grade !== undefined && Number.isFinite(Number(g.grade)))
    .map((g) => ({
      ...g,
      value: Number(g.grade),
      date: isoDay(g.date || g.created_at),
      weight: Number(g.weight) || 1,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  let sum = 0;
  let weight = 0;
  const points = graded.map((g) => {
    sum += g.value;
    weight += 1;
    return { date: g.date, avg: +(sum / weight).toFixed(2) };
  });

  const byCourse = {};
  graded.forEach((g) => {
    if (!g.course_id) return;
    (byCourse[g.course_id] = byCourse[g.course_id] || []).push(g.value);
  });

  let best = null;
  let worst = null;
  Object.entries(byCourse).forEach(([courseId, values]) => {
    const mean = (values.reduce((s, v) => s + v, 0) / values.length).toFixed(2);
    const entry = { courseId, name: (courses.find((c) => c.id === courseId) || {}).name || "Course", avg: +mean };
    if (!best || entry.avg > best.avg) best = entry;
    if (!worst || entry.avg < worst.avg) worst = entry;
  });

  return {
    points,
    current: avg(graded.map((g) => g.value)),
    count: graded.length,
    best,
    worst,
  };
};

/**
 * Focus velocity: minutes this week vs last, session length, and counts.
 * @param {Array<{ date?: string, duration?: number }>} sessions
 * @param {{ today?: string }} [options]
 * @returns {object}
 */
export const focusVelocity = (sessions = [], options = {}) => {
  const today = isoDay(options.today ?? new Date().toISOString());
  const thisWeek = weekStartOf(today);
  const lastWeek = weekBefore(today, 1);
  let weekMinutes = 0;
  let lastMinutes = 0;
  let sessionsThisWeek = 0;
  let sessionsLastWeek = 0;
  const durations = [];
  sessions.forEach((s) => {
    if (!s.date) return;
    const minutes = Number(s.duration) || 0;
    const key = weekStartOf(isoDay(s.date));
    if (key === thisWeek) {
      weekMinutes += minutes;
      sessionsThisWeek += 1;
    }
    if (key === lastWeek) {
      lastMinutes += minutes;
      sessionsLastWeek += 1;
    }
    if (minutes > 0) durations.push(minutes);
  });
  const changePct =
    lastMinutes > 0 ? Math.round(((weekMinutes - lastMinutes) / lastMinutes) * 100) : weekMinutes;
  return {
    weekMinutes,
    lastWeekMinutes: lastMinutes,
    sessionsThisWeek,
    sessionsLastWeek,
    changePct,
    avgSession: avg(durations),
  };
};