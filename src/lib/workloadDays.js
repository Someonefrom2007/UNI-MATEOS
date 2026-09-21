// Workload by day — pure display lens over the pinned workload engine.
// Buckets open tasks' estimated durations across the 7 days of the week
// starting at `weekStart` (a Monday). Fully deterministic and timezone-safe:
// the workload page passes its Monday via weekStartOf(todayISO()) so the
// buckets match the user's local week boundaries.

const DAYS_IN_WEEK = 7;
const MS_PER_DAY = 86400000;

/**
 * @typedef {{ status?: string, due_date?: string, estimated_duration?: number }} WorkloadTask
 */

/**
 * Estimated minutes a task contributes (defaults to 30, matching the engine).
 * @param {WorkloadTask} [task]
 * @returns {number}
 */
export const defaultDuration = (task) => (task && task.estimated_duration) || 30;

/**
 * Estimated minutes per day of a Monday-start week.
 * @param {WorkloadTask[]} tasks
 * @param {string} weekStart YYYY-MM-DD, a Monday.
 * @returns {number[]} 7 totals, index 0 = Monday.
 */
export const tasksByDay = (tasks, weekStart) => {
  const days = Array(DAYS_IN_WEEK).fill(0);
  if (!weekStart || !Array.isArray(tasks)) return days;
  const ws = new Date(weekStart + "T00:00:00").getTime();
  tasks.forEach((task) => {
    if (task.status === "completed" || !task.due_date) return;
    const index = Math.floor((new Date(task.due_date + "T00:00:00").getTime() - ws) / MS_PER_DAY);
    if (index >= 0 && index < DAYS_IN_WEEK) days[index] += defaultDuration(task);
  });
  return days;
};

/**
 * Total estimated minutes for tasks due within the week.
 * @param {WorkloadTask[]} tasks
 * @param {string} weekStart YYYY-MM-DD, a Monday.
 * @returns {number}
 */
export const tasksDueThisWeek = (tasks, weekStart) =>
  tasksByDay(tasks, weekStart).reduce((sum, v) => sum + v, 0);