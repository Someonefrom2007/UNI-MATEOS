import { describe, expect, it } from "vitest";
import {
  completionStats,
  focusVelocity,
  gradeTrajectory,
  weekBefore,
  weekStartOf,
  weeklyFocus,
  studyStreaks,
} from "@/lib/analytics";

const TODAY = "2026-05-01"; // a Friday

describe("weekStartOf / weekBefore", () => {
  it("snaps to the Monday of the local week", () => {
    expect(weekStartOf(TODAY)).toBe("2026-04-27");
    expect(weekStartOf("2026-04-27")).toBe("2026-04-27");
    expect(weekStartOf("2026-04-26") /* Sunday */).toBe("2026-04-20");
  });

  it("backs off whole weeks", () => {
    expect(weekBefore(TODAY, 1)).toBe("2026-04-20");
    expect(weekBefore(TODAY, 2)).toBe("2026-04-13");
  });
});

describe("studyStreaks", () => {
  const sessions = [
    { date: "2026-05-01", duration: 25 },
    { date: "2026-04-30", duration: 25 },
    { date: "2026-04-29", duration: 25 },
  ];
  const tasks = [{ status: "completed", completed_date: "2026-04-29" }];

  it("counts the current run ending today", () => {
    expect(studyStreaks(tasks, sessions, { today: TODAY }).current).toBe(3);
  });

  it("resets current when today is idle but keeps best", () => {
    const gap = [{ date: "2026-04-29", duration: 25 }, { date: "2026-04-28", duration: 25 }];
    expect(studyStreaks([], gap, { today: TODAY })).toEqual({ current: 0, best: 2 });
  });

  it("finds a best streak longer than the current one", () => {
    const longRun = [
      { date: "2026-04-01", duration: 25 },
      { date: "2026-04-02", duration: 25 },
      { date: "2026-04-03", duration: 25 },
    ];
    expect(studyStreaks([], longRun, { today: TODAY }).best).toBe(3);
  });

  it("counts a completed task day and a session day both as active", () => {
    const mixed = { completed_date: "2026-04-28" };
    const out = studyStreaks(
      [{ status: "completed", completed_date: "2026-04-29" }, mixed],
      [{ date: "2026-04-30", duration: 25 }],
      { today: "2026-04-30" }
    );
    expect(out.current).toBe(2);
  });
});

describe("weeklyFocus", () => {
  it("buckets sessions into Monday weeks, returning the last N ascending", () => {
    const sessions = [
      { date: "2026-05-01", duration: 50 }, // this week (Mon 04-27)
      { date: "2026-04-29", duration: 40 }, // this week
      { date: "2026-04-22", duration: 60 }, // last week (Mon 04-20)
    ];
    const rows = weeklyFocus(sessions, { today: TODAY, weeks: 3 });
    expect(rows).toHaveLength(3);
    expect(rows[0].week).toBe("2026-04-13");
    expect(rows[0].minutes).toBe(0);
    expect(rows[1]).toEqual({ week: "2026-04-20", minutes: 60 });
    expect(rows[2]).toEqual({ week: "2026-04-27", minutes: 90 });
  });

  it("ignores sessions without dates", () => {
    expect(weeklyFocus([{ duration: 25 }], { today: TODAY, weeks: 2 })).toHaveLength(2);
  });
});

describe("completionStats", () => {
  it("computes done/open/overdue and the completion pct", () => {
    const tasks = [
      { status: "completed" },
      { status: "completed" },
      { status: "todo", due_date: "2026-04-01" },
      { status: "in_progress", due_date: "2026-05-10" },
      { status: "todo", due_date: "2026-05-02" },
    ];
    const s = completionStats(tasks, { today: TODAY });
    expect(s.done).toBe(2);
    expect(s.open).toBe(3);
    expect(s.overdue).toBe(1);
    expect(s.total).toBe(5);
    expect(s.pct).toBe(40);
  });
});

describe("gradeTrajectory", () => {
  it("builds cumulative averages ordered by date", () => {
    const grades = [
      { course_id: "c1", grade: 6, date: "2026-03-01" },
      { course_id: "c1", grade: 8, date: "2026-04-01" },
    ];
    const out = gradeTrajectory(grades, [{ id: "c1", name: "Calc" }]);
    expect(out.points).toEqual([
      { date: "2026-03-01", avg: 6 },
      { date: "2026-04-01", avg: 7 },
    ]);
    expect(out.current).toBe(7);
    expect(out.best).toEqual({ courseId: "c1", name: "Calc", avg: 7 });
    expect(out.worst).toEqual({ courseId: "c1", name: "Calc", avg: 7 });
  });

  it("skips non-numeric grades and empty output stays zeroed", () => {
    const out = gradeTrajectory([{ grade: null }, { grade: "x" }], []);
    expect(out.points).toEqual([]);
    expect(out.current).toBe(null);
    expect(out.best).toBe(null);
    expect(out.count).toBe(0);
  });

  it("ranks the strongest and weakest course", () => {
    const grades = [
      { course_id: "a", grade: 9, date: "2026-01-01" },
      { course_id: "b", grade: 4, date: "2026-01-02" },
    ];
    const out = gradeTrajectory(grades, [
      { id: "a", name: "Top" },
      { id: "b", name: "Bottom" },
    ]);
    expect(out.best.name).toBe("Top");
    expect(out.worst.name).toBe("Bottom");
  });
});

describe("focusVelocity", () => {
  it("compares this week against last week and reports the avg session", () => {
    const sessions = [
      { date: "2026-05-01", duration: 50 }, // this week
      { date: "2026-04-29", duration: 40 }, // this week
      { date: "2026-04-22", duration: 60 }, // last week
      { date: "2026-04-21", duration: 30 }, // last week
    ];
    const v = focusVelocity(sessions, { today: TODAY });
    expect(v.weekMinutes).toBe(90);
    expect(v.lastWeekMinutes).toBe(90);
    expect(v.sessionsThisWeek).toBe(2);
    expect(v.sessionsLastWeek).toBe(2);
    expect(v.changePct).toBe(0);
    expect(v.avgSession).toBe(45);
  });

  it("reports an increase even when last week had no focus", () => {
    const v = focusVelocity([{ date: "2026-05-01", duration: 50 }], { today: TODAY });
    expect(v.lastWeekMinutes).toBe(0);
    expect(v.changePct).toBe(50);
    expect(v.avgSession).toBe(50);
  });
});