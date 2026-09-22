// Rescue My Week — a real workload-recovery planner.
//
// Given open tasks, upcoming exams and the actual schedule (fixed commitments),
// this builds an honest recovery plan for the next N days:
//
//   1. Per-day free capacity = real free blocks (08:00–20:00) from the pinned
//      schedule engine, constrained by an optional daily budget.
//   2. Required work items = open tasks (estimated_duration) + exam prep blocks
//      (scaled by how close the exam is).
//   3. Latest-fit assignment: each item goes into the latest day before its
//      deadline that still has capacity — keeping earlier days free is what a
//      sane recovery schedule does.
//   4. Anything that cannot fit anywhere is reported as `overloaded`, honestly.
//      No fake AI response, no invented minutes — every number comes from the
//      data you gave the app.
//
// Pure and injectable (dates + timestamp factory), matching the other planner
// modules. Uses toLocalISO so day arithmetic is timezone-safe.

import { toLocalISO } from "@/lib/format";
import { freeBlocks, durationMin } from "@/lib/scheduleEngine";
import { defaultDuration } from "@/lib/workloadDays";

const DAY_MS = 86400000;
export const RESCUE_DEFAULTS = Object.freeze({
  windowDays: 7,
  dailyBudgetMin: 300,
  prepMin: 60,
  minBlock: 25,
  hourStart: "08:00",
  hourEnd: "20:00",
});

const iso = (date) => String(date || "").slice(0, 10);

export const addDaysISO = (date, days) => {
  const d = new Date(`${iso(date)}T00:00:00`);
  d.setDate(d.getDate() + days);
  return toLocalISO(d);
};

/** Whole days from `fromISO` to `toISO`. */
export const daysUntil = (fromISO, toISO) => {
  if (!toISO) return null;
  const a = new Date(`${iso(fromISO)}T00:00:00`).getTime();
  const b = new Date(`${iso(toISO)}T00:00:00`).getTime();
  return Math.round((b - a) / DAY_MS);
};

/** Work demanded by an open task, as a plan item (due-floored to today). */
export const taskItem = (task, todayStr) => {
  const dur = Math.max(RESCUE_DEFAULTS.minBlock, defaultDuration(task) || RESCUE_DEFAULTS.minBlock);
  const raw = iso(task.due_date) || addDaysISO(todayStr, RESCUE_DEFAULTS.windowDays);
  const due = raw < todayStr ? todayStr : raw;
  return {
    kind: "task",
    id: task.id,
    courseId: task.course_id || null,
    title: task.title || "Untitled task",
    minutes: Math.min(dur, RESCUE_DEFAULTS.dailyBudgetMin),
    due,
    priority: task.priority || "medium",
    status: task.status || "todo",
  };
};

/** Exam prep needed before an upcoming exam. Later exams ask for less urgency. */
export const prepForExam = (exam, todayStr, opts) => {
  if (!exam.date) return null;
  const due = iso(exam.date);
  if (due < todayStr) return null;
  const until = daysUntil(todayStr, due);
  if (until === null || until > opts.windowDays) return null;
  const closeness = 1 + Math.max(0, opts.windowDays - until) / opts.windowDays;
  const minutes = Math.round(Math.min(opts.dailyBudgetMin, opts.prepMin * closeness));
  return {
    kind: "exam_prep",
    id: exam.id,
    courseId: exam.course_id || null,
    title: `Prep · ${exam.name || "exam"}`,
    minutes,
    due,
    priority: "high",
    status: "todo",
  };
};

/** Build all required items for the window. */
export const requiredItems = ({ tasks = [], exams = [], todayStr, opts }) => {
  const items = [];
  tasks.forEach((t) => {
    if (t.status === "completed") return;
    items.push(taskItem(t, todayStr));
  });
  exams.forEach((e) => {
    if (e.status === "completed") return;
    const item = prepForExam(e, todayStr, opts);
    if (item) items.push(item);
  });
  return items.sort((a, b) => {
    const d = String(a.due).localeCompare(String(b.due));
    return d !== 0 ? d : (b.minutes - a.minutes);
  });
};

/** Real free minutes for a date given the scheduled events (no budget applied). */
export const freeMinutes = (events, dateStr) => {
  const blocks = freeBlocks(events, dateStr);
  return blocks.reduce((sum, b) => sum + durationMin(b.start, b.end), 0);
};

/** Per-day capacity lookup keyed by YYYY-MM-DD (raw free minutes, budget-capped). */
export const buildCapacities = ({ events = [], from, days, opts }) => {
  const capacities = {};
  let cursor = 0;
  let day = addDaysISO(from, cursor);
  while (cursor < days) {
    capacities[day] = Math.min(freeMinutes(events, day), opts.dailyBudgetMin);
    cursor += 1;
    day = addDaysISO(from, cursor);
  }
  return capacities;
};

/**
 * Main planner. Returns a day-by-day recovery plan plus an honest summary.
 * @param {object} input
 * @param {object[]} input.tasks
 * @param {object[]} input.exams
 * @param {object[]} input.events Schedule events (fixed commitments).
 * @param {object} [input.options]
 * @returns {{ days: object[], summary: object, recommendation: object }}
 */
export const buildRescuePlan = ({ tasks = [], exams = [], events = [], options = {} }) => {
  const opts = { ...RESCUE_DEFAULTS, ...options };
  const todayStr = iso(options.today ?? new Date().toISOString());
  const now = options.now ?? (() => new Date().toISOString());

  const capacities = buildCapacities({ events, from: todayStr, days: opts.windowDays, opts });
  const items = requiredItems({ tasks, exams, todayStr, opts });

  const days = [];
  for (let i = 0; i < opts.windowDays; i += 1) {
    days.push({
      date: addDaysISO(todayStr, i),
      available: capacities[addDaysISO(todayStr, i)] || 0,
      planned: 0,
      items: [],
    });
  }

  // Latest-fit greedy assignment.
  const overloaded = [];
  const placed = [];
  const dayIndex = (date) => {
    const offset = daysUntil(todayStr, date);
    return offset === null || offset < 0 || offset >= days.length ? null : offset;
  };

  items.forEach((item) => {
    const dueIdx = dayIndex(item.due);
    const searchRange = dueIdx === null ? days.length - 1 : dueIdx;
    let slot = -1;
    for (let i = searchRange; i >= 0; i -= 1) {
      if (days[i].available - days[i].planned >= item.minutes) {
        slot = i;
        break;
      }
    }
    if (slot === -1) {
      overloaded.push(item);
      return;
    }
    days[slot].items.push({ ...item, date: days[slot].date, created_at: now(), updated_at: now() });
    days[slot].planned += item.minutes;
    placed.push({ ...item, date: days[slot].date });
  });

  days.forEach((d) => d.items.sort((a, b) => a.minutes - b.minutes));

  const plannedMinutes = placed.reduce((s, it) => s + it.minutes, 0);
  const loadNeeded = items.reduce((s, it) => s + it.minutes, 0);
  const availableTotal = days.reduce((s, d) => s + d.available, 0);
  const feasible = overloaded.length === 0;
  const overloadedMinutes = overloaded.reduce((s, it) => s + it.minutes, 0);

  const recommendation = buildRecommendation({
    items,
    placed,
    overloaded,
    feasible,
    loadNeeded,
    plannedMinutes,
    availableTotal,
    days,
    todayStr,
  });

  return {
    days,
    summary: {
      loadNeeded,
      plannedMinutes,
      overloadedMinutes,
      availableTotal,
      feasible,
      overloadedCount: overloaded.length,
      itemsPlanned: placed.length,
    },
    recommendation,
  };
};

const buildRecommendation = ({
  items,
  placed,
  overloaded,
  feasible,
  loadNeeded,
  plannedMinutes,
  availableTotal,
  days,
  todayStr,
}) => {
  const lines = [];
  const overdue = items.filter((it) => it.due < todayStr);
  const todayPlan = (days.find((d) => d.date === todayStr) || {}).items || [];
  const anyDayOverCap = days.filter((d) => d.planned > d.available);

  if (feasible && items.length === 0) {
    return {
      tone: "clear",
      headline: "Nothing to rescue — the week is clear.",
      lines: ["No open tasks or exams inside this window. Use the space to get ahead."],
    };
  }

  if (feasible) {
    lines.push(
      `${loadNeeded} minutes of work fits into ${availableTotal} free minutes across the window.`
    );
  } else {
    lines.push(
      `Needed ${loadNeeded} minutes, only ${availableTotal} free — ${plannedMinutes} can be scheduled now.`
    );
    lines.push(
      `${overloaded.length} item${overloaded.length === 1 ? "" : "s"} can't fit: ` +
        overloaded.slice(0, 4).map((it) => it.title).join(", ") +
        (overloaded.length > 4 ? "…" : "") +
        `. Reduce scope or push a deadline before planning again.`
    );
  }

  if (overdue.length > 0) {
    lines.push(`${overdue.length} item${overdue.length === 1 ? "s" : ""} is/are already overdue.`);
  }
  if (todayPlan.length > 0) {
    lines.push(`Today=${todayPlan.reduce((s, it) => s + it.minutes, 0)} minutes: ${todayPlan.map((it) => it.title).join(", ")}.`);
  }
  if (anyDayOverCap.length > 0) {
    lines.push(
      `${anyDayOverCap.length} day${anyDayOverCap.length === 1 ? "" : "s"} is overloaded — consider moving lighter work earlier.`
    );
  }
  if (placed.length === 0 && items.length > 0) {
    lines.push("No free blocks with at least 25 minutes were found — add schedule availability first.");
  }

  return {
    tone: feasible ? "recovering" : "overloaded",
    headline: feasible
      ? "This week is recoverable — here's exactly where the work fits."
      : "This week needs a triage, not a miracle.",
    lines,
  };
};