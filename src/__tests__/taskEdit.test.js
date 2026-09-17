import { describe, it, expect } from "vitest";
import {
  isArchived,
  isActive,
  isCompleted,
  activeTasks,
  normalizeSubtasks,
  subtaskProgress,
  toggleSubtask,
  addSubtask,
  removeSubtask,
  completionPatch,
  taskToForm,
  formToTaskPatch,
  validateTaskForm,
} from "@/lib/taskEdit";

describe("task status helpers", () => {
  it("treats archived and completed as outside the working set", () => {
    expect(isActive({ status: "todo" })).toBe(true);
    expect(isActive({ status: "in_progress" })).toBe(true);
    expect(isActive({ status: "completed" })).toBe(false);
    expect(isActive({ status: "todo", archived: true })).toBe(false);
    expect(isCompleted({ status: "completed" })).toBe(true);
    expect(isArchived({ archived: true })).toBe(true);
    expect(isArchived({})).toBe(false);
  });

  it("activeTasks filters archived rows and tolerates junk input", () => {
    const list = [{ id: "1" }, { id: "2", archived: true }, { id: "3", status: "completed" }];
    expect(activeTasks(list).map((t) => t.id)).toEqual(["1", "3"]);
    expect(activeTasks(null)).toEqual([]);
    expect(activeTasks(undefined)).toEqual([]);
  });
});

describe("subtasks", () => {
  it("normalizes loose shapes and drops non-objects", () => {
    expect(normalizeSubtasks([{ title: "a", completed: true }, null, "x", { name: "b" }])).toEqual([
      { id: "st-0", title: "a", done: true },
      { id: "st-1", title: "b", done: false },
    ]);
    expect(normalizeSubtasks(undefined)).toEqual([]);
  });

  it("never lets a generated id collide with an explicit one", () => {
    const list = normalizeSubtasks([{ title: "no id" }, { id: "st-0", title: "explicit" }]);
    expect(list[0].id).not.toBe(list[1].id);
    // Toggling one must not also toggle the other.
    const toggled = toggleSubtask(list, "st-0");
    expect(toggled.filter((s) => s.done)).toHaveLength(1);
  });

  it("reports null progress when there are no subtasks", () => {
    expect(subtaskProgress([])).toBeNull();
    expect(subtaskProgress(undefined)).toBeNull();
  });

  it("computes progress and flags completion", () => {
    const p = subtaskProgress([{ id: "a", title: "1", done: true }, { id: "b", title: "2", done: false }]);
    expect(p).toEqual({ done: 1, total: 2, pct: 50, complete: false });
    expect(subtaskProgress([{ id: "a", title: "1", done: true }]).complete).toBe(true);
  });

  it("toggles one subtask without mutating the original array", () => {
    const original = [{ id: "a", title: "1", done: false }];
    const next = toggleSubtask(original, "a");
    expect(next[0].done).toBe(true);
    expect(original[0].done).toBe(false);
  });

  it("adds and removes subtasks", () => {
    const withOne = addSubtask([], "  Read chapter 4  ", () => "fixed");
    expect(withOne).toEqual([{ id: "fixed", title: "Read chapter 4", done: false }]);
    expect(addSubtask(withOne, "   ")).toEqual(withOne);
    expect(removeSubtask(withOne, "fixed")).toEqual([]);
  });

  it("generates unique ids when no factory is given", () => {
    const list = addSubtask(addSubtask([], "one"), "two");
    expect(list[0].id).not.toBe(list[1].id);
  });
});

describe("completionPatch", () => {
  it("stamps the completion date when done and clears it when reopened", () => {
    expect(completionPatch({}, true, "2026-09-17")).toEqual({ status: "completed", completed_date: "2026-09-17" });
    expect(completionPatch({}, false, "2026-09-17")).toEqual({ status: "todo", completed_date: null });
  });
});

describe("form mapping", () => {
  it("maps a row to an editable form with safe defaults", () => {
    expect(taskToForm({})).toEqual({
      title: "",
      description: "",
      course_id: null,
      due_date: "",
      priority: "medium",
      status: "todo",
      estimated_duration: 0,
      subtasks: [],
    });
  });

  it("coerces an unknown status back to todo", () => {
    expect(taskToForm({ status: "weird" }).status).toBe("todo");
    expect(taskToForm({ status: "in_progress" }).status).toBe("in_progress");
  });

  it("clears blank optional fields to null rather than empty strings", () => {
    const patch = formToTaskPatch({ title: "  Essay  ", description: "  ", course_id: "", due_date: "", estimated_duration: "" });
    expect(patch.title).toBe("Essay");
    expect(patch.description).toBeNull();
    expect(patch.course_id).toBeNull();
    expect(patch.due_date).toBeNull();
    expect(patch.estimated_duration).toBe(0);
  });

  it("keeps real values through a round trip", () => {
    const row = {
      title: "Problem set 3",
      description: "Chapters 4–6",
      course_id: "c1",
      due_date: "2026-09-20",
      priority: "high",
      status: "in_progress",
      estimated_duration: 90,
      subtasks: [{ id: "s1", title: "Q1", done: true }],
    };
    expect(formToTaskPatch(taskToForm(row))).toEqual({
      title: row.title,
      description: row.description,
      course_id: row.course_id,
      due_date: row.due_date,
      priority: row.priority,
      status: row.status,
      estimated_duration: row.estimated_duration,
      subtasks: row.subtasks,
    });
  });
});

describe("validateTaskForm", () => {
  it("requires a title", () => {
    expect(validateTaskForm({ title: "" })).toBeTruthy();
    expect(validateTaskForm({ title: "   " })).toBeTruthy();
    expect(validateTaskForm({})).toBeTruthy();
    expect(validateTaskForm({ title: "Essay" })).toBeNull();
  });
});
