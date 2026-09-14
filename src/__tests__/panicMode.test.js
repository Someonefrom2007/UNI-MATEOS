import { describe, it, expect } from "vitest";
import { cutoffForPanic, panicTasks, microCount, microBase, microTitle } from "@/lib/triage";
import { toLocalISO, todayISO } from "@/lib/format";

const TODAY = "2026-07-15";
const task = (over = {}) => ({
  id: "t1",
  title: "Task",
  status: "todo",
  priority: "medium",
  due_date: TODAY,
  estimated_duration: 30,
  ...over,
});

describe("panic mode: 48-hour boundary via toLocalISO", () => {
  it("computes an inclusive +2d cutoff string", () => {
    expect(cutoffForPanic(TODAY)).toBe("2026-07-17");
    expect(cutoffForPanic(TODAY, 5)).toBe("2026-07-20");
  });

  it("builds cutoff from a Date like the page used to", () => {
    const d = new Date(TODAY + "T12:00:00");
    d.setDate(d.getDate() + 2);
    expect(cutoffForPanic(TODAY)).toBe(toLocalISO(d));
  });

  it("keeps tasks due exactly on the cutoff (inclusive) and drops the next day", () => {
    const list = panicTasks(
      [task({ due_date: "2026-07-18" }), task({ due_date: "2026-07-17" }), task({ due_date: TODAY })],
      { todayStr: TODAY }
    );
    expect(list.map((t) => t.due_date).sort()).toEqual([TODAY, "2026-07-17"]);
  });

  it("todayISO() and cutoffForPanic agree on local-day math near midnight", () => {
    const lateDay = new Date(2026, 6, 15, 23, 59, 59);
    expect(todayISO(lateDay)).toBe("2026-07-15");
    expect(cutoffForPanic(todayISO(lateDay))).toBe("2026-07-17");
  });
});

describe("panic mode: task sorting + filtering", () => {
  it("sorts fire-zone tasks by due date ascending", () => {
    const list = panicTasks(
      [task({ due_date: "2026-07-17", id: "a" }), task({ due_date: TODAY, id: "b" }), task({ due_date: "2026-07-16", id: "c" })],
      { todayStr: TODAY }
    );
    expect(list.map((t) => t.id)).toEqual(["b", "c", "a"]);
  });

  it("excludes completed, low-priority, and undated tasks", () => {
    const list = panicTasks(
      [
        task({ status: "completed" }),
        task({ priority: "low" }),
        task({ due_date: null }),
        task({ due_date: "" }),
        task({}), // valid
      ],
      { todayStr: TODAY }
    );
    expect(list).toHaveLength(1);
  });

  it("missing todayStr falls back to the real clock (never crashes)", () => {
    const out = panicTasks([task({})]);
    expect(Array.isArray(out)).toBe(true);
  });
});

describe("panic mode: sub-task splitting logic", () => {
  it("sizes micro-task counts from estimated duration", () => {
    expect(microCount({ estimated_duration: 0 })).toBe(3);
    expect(microCount({ estimated_duration: 15 })).toBe(2);
    expect(microCount({ estimated_duration: 150 })).toBe(10);
    expect(microCount({ estimated_duration: 10 })).toBe(2);
    expect(microCount({})).toBe(3);
  });

  it("builds titles that round-trip through microBase", () => {
    const base = "Calculus Problem Set";
    const title = microTitle(base, 2, 6);
    expect(title).toBe("15m · Calculus Problem Set (3/6)");
    expect(microBase(title)).toBe(base);
  });

  it("microBase is a no-op on plain titles", () => {
    expect(microBase("Plain task")).toBe("Plain task");
    expect(microBase("")).toBe("");
    expect(microBase("15m · weird (1/2) splittable")).toBe("15m · weird (1/2) splittable");
  });

  it("splitting a task produces n unique chunks across all indices", () => {
    const n = microCount({ estimated_duration: 60 });
    const titles = Array.from({ length: n }, (_, i) => microTitle("Algebra", i, n));
    expect(new Set(titles).size).toBe(n);
    expect(titles[0]).toBe("15m · Algebra (1/4)");
  });
});