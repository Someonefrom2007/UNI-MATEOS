// Panic / triage mode — 48-hour fire-zone filtering and micro-task splitting.
// Pure functions extracted from Tasks.jsx so boundary rules are testable.
import { toLocalISO } from "@/lib/format";

// The inclusive cutoff date string for items due within `days` (default 2).
/** @param {string} [todayStr] @param {number} [days] */
export const cutoffForPanic = (todayStr, days = 2) => {
  const base = todayStr ? new Date(todayStr + "T00:00:00") : new Date();
  base.setHours(0, 0, 0, 0);
  base.setDate(base.getDate() + days);
  return toLocalISO(base);
};

// Fire-zone tasks: uncompleted, not low priority, due <= cutoff, sorted by date.
/**
 * @param {Array<object>} tasks
 * @param {{ todayStr?: string, days?: number }} [opts]
 */
export const panicTasks = (tasks = [], { todayStr, days = 2 } = {}) => {
  const cutoffStr = cutoffForPanic(todayStr, days);
  return tasks
    .filter((t) => t.status !== "completed")
    .filter((t) => t.priority !== "low")
    .filter((t) => t.due_date && t.due_date <= cutoffStr)
    .sort((a, b) => (a.due_date || "9999").localeCompare(b.due_date || "9999"));
};

// Number of 15-minute micro-tasks a task splits into.
export const microCount = (t) => {
  const est = t?.estimated_duration || 0;
  return est > 0 ? Math.max(2, Math.ceil(est / 15)) : 3;
};

// Strip a prior "15m · title (n/N)" packaging back to the base title.
export const microBase = (title) => {
  const m = (title || "").match(/^15m · (.*?) \(\d+\/(\d+)\)$/);
  return m ? m[1].trim() : title || "";
};

// One micro-task title, round-trippable through microBase.
export const microTitle = (base, i, n) => `15m · ${base} (${i + 1}/${n})`;