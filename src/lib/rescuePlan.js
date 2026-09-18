// Rescue My Week — turns a workload warning into an explicit, applicable plan.
//
// The planner is pure: it reads the student's own tasks, exams and schedule and
// returns (a) the sessions it would book, (b) the work it could not place and
// why, and (c) deadline moves that would make the unplaced work fit. Nothing is
// written here; the caller decides what to apply, so no commitment is ever
// changed silently.
//
// Work is ordered earliest-deadline-first, then by priority — the same order a
// student would triage in — and is packed into real free blocks from the pinned
// scheduleEngine, so a proposed session can never collide with a class.
import { toLocalISO } from "@/lib/format";
import { freeBlocks, durationMin } from "@/lib/scheduleEngine";
import { addMinutes } from "@/lib/planner";

const DEFAULT_TASK_MIN = 30;
const MIN_SESSION = 15;
const MAX_SESSION = 120;
const EXAM_PREP_CAP = 180;
const EXAM_PREP_MIN = 60;

const PRIORITY_RANK = { urgent: 0, high: 1, medium: 2, low: 3 };

/** Estimated remaining work for a task, in minutes. */
export const taskWorkMinutes = (task) =>
  Math.max(MIN_SESSION, Math.round(Number(task?.estimated_duration) || DEFAULT_TASK_MIN));

/**
 * Estimated remaining exam preparation, in minutes.
 * Mirrors the workload engine so the number here matches the one the student
 * already sees on the Workload page rather than contradicting it.
 */
export const examPrepMinutes = (exam) => {
  if (!exam || exam.status === "completed") return 0;
  const topics = exam.topics || [];
  if (!topics.length) return EXAM_PREP_CAP;
  const mastery = topics.reduce((sum, t) => sum + (Number(t.mastery) || 0), 0) / (topics.length * 100);
  const remaining = Math.max(0, 1 - mastery);
  if (remaining === 0) return 0;
  return Math.round(Math.max(EXAM_PREP_MIN, remaining * EXAM_PREP_CAP));
};

/** Days from `todayStr` to `dateStr`; negative when already past. */
export const daysOut = (dateStr, todayStr) => {
  if (!dateStr) return null;
  const a = new Date(dateStr + "T00:00:00").getTime();
  const b = new Date(todayStr + "T00:00:00").getTime();
  return Math.round((a - b) / 86400000);
};

/**
 * Every piece of outstanding work, each with the last day it may be planned on.
 * Exam prep stops the day before the exam; tasks may use their due date.
 */
export const collectWork = ({ tasks = [], exams = [], courses = [], todayStr }) => {
  const items = [];

  tasks.forEach((t) => {
    if (t.status === "completed" || !t.due_date) return;
    const minutes = taskWorkMinutes(t);
    if (minutes <= 0) return;
    items.push({
      kind: "task",
      refId: t.id,
      title: t.title || "Untitled task",
      courseId: t.course_id || null,
      deadline: t.due_date,
      lastDay: t.due_date,
      minutes,
      priority: PRIORITY_RANK[t.priority] ?? PRIORITY_RANK.medium,
      priorityKey: t.priority || "medium",
    });
  });

  exams.forEach((e) => {
    if (!e.date || e.status === "completed") return;
    const minutes = examPrepMinutes(e);
    if (minutes <= 0) return;
    const last = new Date(e.date + "T00:00:00");
    last.setDate(last.getDate() - 1);
    items.push({
      kind: "exam",
      refId: e.id,
      title: e.name || "Exam",
      courseId: e.course_id || null,
      deadline: e.date,
      lastDay: toLocalISO(last),
      minutes,
      // An exam outranks a task on the same day: it is fixed, graded, and big.
      priority: -1,
      priorityKey: "exam",
    });
  });

  return items.sort((a, b) => {
    const byDeadline = (a.deadline || "").localeCompare(b.deadline || "");
    if (byDeadline !== 0) return byDeadline;
    if (a.priority !== b.priority) return a.priority - b.priority;
    return b.minutes - a.minutes;
  });
};

/** Build the day window the plan covers. */
export const planDays = (todayStr, days) => {
  const start = new Date(todayStr + "T00:00:00");
  const out = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    out.push(toLocalISO(d));
  }
  return out;
};

/**
 * Split work into balanced sittings.
 *
 * Greedily filling pockets leaves slivers — a 6-minute "session" is useless —
 * so sizes are decided up front: at most MAX_SESSION each, never below
 * MIN_SESSION, and as even as the total allows.
 *
 * @param {number} minutes
 * @returns {number[]}
 */
export const sittingsFor = (minutes) => {
  const total = Math.max(0, Math.round(minutes));
  if (total <= 0) return [];
  if (total <= MAX_SESSION) return [Math.max(MIN_SESSION, total)];
  const n = Math.ceil(total / MAX_SESSION);
  const base = Math.floor(total / n);
  const sizes = Array(n).fill(base);
  for (let i = 0; i < total - base * n; i++) sizes[i] += 1;
  return sizes;
};

/**
 * Build a week plan.
 *
 * @param {object} args
 * @param {Array<object>} [args.tasks]
 * @param {Array<object>} [args.exams]
 * @param {Array<object>} [args.events] schedule events (classes + dated)
 * @param {Array<object>} [args.courses]
 * @param {string} args.todayStr
 * @param {number} [args.days] horizon in days
 * @param {number} [args.fillRatio] share of free time we are willing to book
 */
export const buildRescuePlan = ({
  tasks = [],
  exams = [],
  events = [],
  courses = [],
  todayStr,
  days = 7,
  fillRatio = 0.8,
}) => {
  const dayList = planDays(todayStr, days);
  const work = collectWork({ tasks, exams, courses, todayStr });

  // Real free blocks per day, plus a booking budget per day. The headroom is
  // applied as a *day* budget rather than by shrinking each block: shrinking a
  // block to 80% turns a 60-minute gap into a 48-minute gap, which no sensible
  // sitting fits into, so the whole block goes to waste.
  const pockets = {};
  const budgetByDay = {};
  dayList.forEach((ds) => {
    const usable = freeBlocks(events, ds)
      .map((b) => ({ start: b.start, mins: durationMin(b.start, b.end) }))
      .filter((b) => b.mins >= MIN_SESSION);
    pockets[ds] = usable;
    budgetByDay[ds] = Math.floor(usable.reduce((sum, b) => sum + b.mins, 0) * fillRatio);
  });

  const capacityTotal = Object.values(budgetByDay).reduce((s, v) => s + v, 0);
  const demandTotal = work.reduce((s, w) => s + w.minutes, 0);

  const sessions = [];
  const unplaced = [];

  // Place a sitting in the earliest free block that can hold it, within the
  // day's budget.
  const place = (item, size, window, overdue) => {
    for (const ds of window) {
      if (budgetByDay[ds] < size) continue;
      const pocket = pockets[ds].find((p) => p.mins >= size);
      if (!pocket) continue;
      const start = pocket.start;
      sessions.push({
        kind: item.kind,
        refId: item.refId,
        title: item.kind === "exam" ? `Study: ${item.title}` : item.title,
        courseId: item.courseId,
        date: ds,
        start,
        end: addMinutes(start, size),
        minutes: size,
        deadline: item.deadline,
        overdue,
      });
      pocket.start = addMinutes(start, size);
      pocket.mins -= size;
      budgetByDay[ds] -= size;
      return true;
    }
    return false;
  };

  work.forEach((item) => {
    const overdue = daysOut(item.deadline, todayStr) < 0;
    // Overdue work is the most urgent there is: plan it from today, and let the
    // UI say so, rather than treating a missed deadline as unplannable.
    const window = dayList.filter((ds) => ds <= (overdue ? todayStr : item.lastDay));

    const queue = sittingsFor(item.minutes);
    let remaining = 0;
    while (queue.length) {
      const size = queue.shift();
      if (size < MIN_SESSION) break;
      if (place(item, size, window, overdue)) continue;
      // Nothing before the deadline can hold this sitting in one go. Halving it
      // is worth trying once, because two 60m slots often fit where one 120m
      // slot does not — but a sitting is never split below the minimum.
      if (size > MIN_SESSION * 2) {
        const half = Math.floor(size / 2);
        queue.unshift(size - half, half);
        continue;
      }
      remaining += size + queue.reduce((s, x) => s + x, 0);
      break;
    }

    if (remaining > 0) {
      unplaced.push({ ...item, overdue, reason: "no_capacity", remaining });
    }
  });

  // Honest verdict: is the work placeable inside the horizon at all?
  const placedTotal = sessions.reduce((s, x) => s + x.minutes, 0);
  const overloaded = demandTotal > capacityTotal;

  // For unplaced work, find the earliest deadline extension that would fit it —
  // a concrete suggestion instead of "work harder". Free time past the horizon
  // is computed the same way (recurring classes are known), so the number is a
  // real estimate rather than a guess.
  const freeMinutesOn = (ds) => {
    if (ds in budgetByDay) return budgetByDay[ds];
    return Math.floor(
      freeBlocks(events, ds).reduce((sum, b) => sum + durationMin(b.start, b.end), 0) * fillRatio,
    );
  };

  const deferrals = unplaced
    .map((u) => {
      // Extending the allowed window by n days adds that many days of free time
      // after the current horizon.
      const extendFrom = dayList[dayList.length - 1] || todayStr;
      let freed = 0;
      let n = 0;
      while (freed < u.remaining && n < 60) {
        n++;
        const d = new Date(extendFrom + "T00:00:00");
        d.setDate(d.getDate() + n);
        freed += freeMinutesOn(toLocalISO(d));
      }
      const suggested = new Date(u.deadline + "T00:00:00");
      suggested.setDate(suggested.getDate() + n);
      return { ...u, extendByDays: n, suggestedDeadline: toLocalISO(suggested) };
    })
    .filter((d) => d.extendByDays > 0);

  return {
    todayStr,
    days: dayList,
    capacityByDay: budgetByDay,
    capacityTotal,
    demandTotal,
    placedTotal,
    // Sittings are placed in deadline order, so a later-appearing pocket can
    // land before an earlier one on the same day. The UI shows a timeline, so
    // the plan is ordered chronologically before it leaves the engine.
    sessions: [...sessions].sort(
      (a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start),
    ),
    unplaced,
    deferrals,
    overloaded,
    // Anything placed or unplaced? An empty result is a real empty state.
    hasWork: work.length > 0,
    courseById: courses.reduce((acc, c) => {
      acc[c.id] = c;
      return acc;
    }, {}),
  };
};
