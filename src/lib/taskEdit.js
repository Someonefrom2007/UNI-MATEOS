// Task editing — pure helpers for the task lifecycle the UI needs but never
// had: subtask toggle/split counts, progress, archive vs delete, and the form
// model that maps a task row to editable fields and back.
//
// Archive uses an `archived` boolean column (same convention as courses, notes
// and habits) rather than a status value: the tasks table's status CHECK only
// permits todo | in_progress | completed, so widening it in code would break
// hosted writes. `supabase/schema.sql` carries the additive column.

export const isArchived = (task) => Boolean(task?.archived);
export const isActive = (task) => task && !task.archived && task.status !== "completed";
export const isCompleted = (task) => task?.status === "completed";

export const NORMALIZE_STATUSES = ["todo", "in_progress", "completed"];
export const normalizeStatus = (status) =>
  NORMALIZE_STATUSES.includes(status) ? status : "todo";

// The working set every engine should read: archived tasks are out of the way,
// so workload, insights, focus pickers and the dashboard all agree on what is
// actually outstanding. Only the archived view itself reads the raw list.
export const activeTasks = (tasks) => (Array.isArray(tasks) ? tasks.filter((t) => !isArchived(t)) : []);

export const normalizeSubtasks = (subtasks) => {
  if (!Array.isArray(subtasks)) return [];
  const used = new Set();
  return subtasks
    .filter((s) => s && typeof s === "object")
    .map((s, i) => {
      // Explicit ids win; generated ones must not collide with an explicit id
      // elsewhere in the list, or toggling one step would toggle two.
      let id = s.id != null && String(s.id) !== "" ? String(s.id) : `st-${i}`;
      while (used.has(id)) id = `${id}-x`;
      used.add(id);
      return {
        id,
        title: String(s.title ?? s.name ?? ""),
        done: Boolean(s.done ?? s.completed),
      };
    });
};

// Completed / total for the subtask checklist. A task with no subtasks reports
// null so the UI can show its own done-state instead of a misleading 0/0.
export const subtaskProgress = (subtasks) => {
  const list = normalizeSubtasks(subtasks);
  if (!list.length) return null;
  const done = list.filter((s) => s.done).length;
  return { done, total: list.length, pct: Math.round((done / list.length) * 100), complete: done === list.length };
};

// Flip one subtask; returns a new array (never mutates the row's array).
export const toggleSubtask = (subtasks, id) =>
  normalizeSubtasks(subtasks).map((s) => (s.id === String(id) ? { ...s, done: !s.done } : s));

export const addSubtask = (subtasks, title, idFactory) => {
  const clean = String(title || "").trim();
  if (!clean) return normalizeSubtasks(subtasks);
  const id = idFactory ? idFactory() : `st-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  return [...normalizeSubtasks(subtasks), { id, title: clean, done: false }];
};

export const removeSubtask = (subtasks, id) =>
  normalizeSubtasks(subtasks).filter((s) => s.id !== String(id));

// Toggling a task's completion also records/clears the completion date, which
// the insights and workload engines read. Kept here so both stays consistent.
export const completionPatch = (task, done, todayStr) => ({
  status: done ? "completed" : "todo",
  completed_date: done ? todayStr : null,
});

// A task row -> the shape the edit form edits (numbers coerced, nulls explicit).
export const taskToForm = (task = {}) => ({
  title: task.title || "",
  description: task.description || "",
  course_id: task.course_id || null,
  due_date: task.due_date || "",
  priority: task.priority || "medium",
  status: normalizeStatus(task.status),
  estimated_duration: task.estimated_duration || 0,
  subtasks: normalizeSubtasks(task.subtasks),
});

// Editable form -> the patch written back. Blank optional fields become null so
// clearing a due date or course actually clears it instead of storing "".
export const formToTaskPatch = (form = {}) => ({
  title: String(form.title || "").trim(),
  description: String(form.description || "").trim() || null,
  course_id: form.course_id || null,
  due_date: form.due_date || null,
  priority: form.priority || "medium",
  status: normalizeStatus(form.status),
  estimated_duration: Number(form.estimated_duration) || 0,
  subtasks: normalizeSubtasks(form.subtasks),
});

export const archivePatch = () => ({ archived: true });
export const restorePatch = () => ({ archived: false });

// Which Tasks tab can actually show a given task. A search result deep-links to
// `?highlight=<id>`; the default "today" tab hides anything not due today, so
// landing there would show an empty list and a highlight the student cannot
// see. Ordering matters: archived first, then the status/deadline buckets.
export const taskViews = ["today", "upcoming", "overdue", "all", "completed", "archived"];

export const viewForTask = (task, todayStr) => {
  if (!task) return null;
  if (isArchived(task)) return "archived";
  if (isCompleted(task)) return "completed";
  if (task.due_date && task.due_date < todayStr) return "overdue";
  return "upcoming";
};

// A patch is only valid if it still has a title — the one required field.
export const validateTaskForm = (form = {}) =>
  String(form.title || "").trim() ? null : "A task needs a title.";
