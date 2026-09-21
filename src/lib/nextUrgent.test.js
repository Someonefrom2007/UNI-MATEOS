import { describe, expect, it } from "vitest";
import { daysBetween, nextUrgent } from "./nextUrgent";

const TODAY = "2026-09-21";

const exam = (over) => ({ id: "e1", name: "Calculus", course_id: "c1", date: "2026-09-25", status: "pending", ...over });
const task = (over) => ({ id: "t1", title: "Write essay", course_id: "c1", due_date: "2026-09-22", status: "pending", priority: "normal", ...over });
const course = (over) => ({ id: "c1", name: "Calculus I", color: "amber", ...over });

describe("daysBetween", () => {
  it("counts whole days between date strings", () => {
    expect(daysBetween("2026-09-21", TODAY)).toBe(0);
    expect(daysBetween("2026-09-25", TODAY)).toBe(4);
    expect(daysBetween("2026-09-20", TODAY)).toBe(-1);
  });

  it("returns null when a date is missing or malformed", () => {
    expect(daysBetween(null, TODAY)).toBeNull();
    expect(daysBetween("not-a-date", TODAY)).toBeNaN();
  });
});

describe("nextUrgent", () => {
  it("picks exams within 7 days and joins the course", () => {
    const urgent = nextUrgent([exam()], [], [course()], TODAY);
    expect(urgent).toHaveLength(1);
    expect(urgent[0]).toMatchObject({ kind: "exam", n: 4, course: { id: "c1", name: "Calculus I" } });
  });

  it("skips completed and far-away exams", () => {
    const data = [
      exam({ id: "done", status: "completed", date: "2026-09-22" }),
      exam({ id: "late", date: "2026-10-10" }),
    ];
    expect(nextUrgent(data, [], [], TODAY)).toHaveLength(0);
  });

  it("includes tasks due within 2 days and overdue ones", () => {
    const data = [
      task({ due_date: "2026-09-22" }),
      task({ id: "old", due_date: "2026-09-10" }),
      task({ id: "far", due_date: "2026-09-30" }),
    ];
    const urgent = nextUrgent([], data, [], TODAY);
    expect(urgent.map((u) => u.item.id)).toEqual(["old", "t1"]);
  });

  it("sorts by urgency and caps at 4", () => {
    const exams = Array.from({ length: 3 }, (_, i) => exam({ id: `e${i}`, date: `2026-09-2${5 - i}` }));
    const tasks = Array.from({ length: 4 }, (_, i) => task({ id: `t${i}`, due_date: `2026-09-2${i + 1}` }));
    const urgent = nextUrgent(exams, tasks, [], TODAY);
    expect(urgent).toHaveLength(4);
    expect(urgent[0].n).toBe(0);
    for (let i = 1; i < urgent.length; i++) expect(urgent[i].n).toBeGreaterThanOrEqual(urgent[i - 1].n);
  });

  it("handles empty inputs", () => {
    expect(nextUrgent([], [], [], TODAY)).toEqual([]);
    expect(nextUrgent(undefined, undefined, undefined, TODAY)).toEqual([]);
  });
});