import { describe, it, expect } from "vitest";
import {
  weekWorkload,
  todayWorkload,
  focusToday,
  focusThisWeek,
  focusStreak,
} from "./workloadEngine";

const MONDAY = "2026-09-14"; // arbitrary week start
const todayISO = () => new Date().toISOString().slice(0, 10);
const dateFromToday = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};
// Mirrors the engine: date string for a day computed from local midnight,
// serialized to a UTC ISO slice (as focusStreak does internally).
const streakDay = (offsetFromToday) => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offsetFromToday);
  return d.toISOString().slice(0, 10);
};

describe("weekWorkload", () => {
  it("sums estimated task durations due within the week, grouped by course", () => {
    const tasks = [
      { id: "1", course_id: "c1", due_date: "2026-09-16", estimated_duration: 60, status: "todo" },
      { id: "2", course_id: "c1", due_date: "2026-09-17", estimated_duration: 90, status: "todo" },
      { id: "3", course_id: "c2", due_date: "2026-09-18", estimated_duration: 30, status: "todo" },
      { id: "4", course_id: "c1", due_date: "2026-09-21", estimated_duration: 999, status: "todo" }, // outside week
      { id: "5", course_id: "c1", due_date: "2026-09-16", estimated_duration: 500, status: "completed" },
    ];
    const courses = [
      { id: "c1", name: "Math" },
      { id: "c2", name: "Physics" },
    ];
    const res = weekWorkload(tasks, [], [], courses, MONDAY);
    expect(res.total).toBe(180);
    expect(res.breakdown).toHaveLength(2);
    expect(res.breakdown[0]).toMatchObject({ course_id: "c1", minutes: 150 });
    expect(res.breakdown[1]).toMatchObject({ course_id: "c2", minutes: 30 });
  });

  it("defaults unknown estimates to 30 minutes", () => {
    const tasks = [{ id: "1", course_id: "c1", due_date: "2026-09-16", status: "todo" }];
    expect(weekWorkload(tasks, [], [], [], MONDAY).total).toBe(30);
  });

  it("adds exam prep time proportional to unmastered topics within 14 days", () => {
    const exams = [
      {
        id: "x1",
        course_id: "c1",
        date: dateFromToday(5),
        status: "todo",
        topics: [
          { name: "t1", mastered: false, reviewed: true, mastery: 100 },
          { name: "t2", mastered: false, reviewed: true, mastery: 0 },
        ],
      },
    ];
    const courses = [{ id: "c1", name: "Math" }];
    const res = weekWorkload([], exams, [], courses, MONDAY);
    // mastery 50% -> remaining 0.5 -> ~90 minutes prep
    expect(res.total).toBeGreaterThan(70);
    expect(res.total).toBeLessThanOrEqual(110);
  });

  it("returns zero for an empty week", () => {
    expect(weekWorkload([], [], [], [], MONDAY).total).toBe(0);
  });
});

describe("todayWorkload", () => {
  it("sums durations of tasks due today, excluding completed", () => {
    const tasks = [
      { id: "1", due_date: todayISO(), estimated_duration: 40, status: "todo" },
      { id: "2", due_date: todayISO(), estimated_duration: 60, status: "todo" },
      { id: "3", due_date: todayISO(), estimated_duration: 999, status: "completed" },
      { id: "4", due_date: "2020-01-01", estimated_duration: 999, status: "todo" },
    ];
    expect(todayWorkload(tasks)).toBe(100);
  });
});

describe("focusToday / focusThisWeek", () => {
  it("reports focus minutes for today", () => {
    const sessions = [
      { id: "1", date: todayISO(), duration: 50 },
      { id: "2", date: "2000-01-01", duration: 999 },
    ];
    expect(focusToday(sessions)).toBe(50);
  });

  it("reports focus minutes for the current week (from Monday)", () => {
    const sessions = [
      { id: "1", date: "2000-01-01", duration: 999 }, // long past
      { id: "2", date: dateFromToday(0), duration: 25 },
      { id: "3", date: dateFromToday(-1), duration: 25 }, // yesterday, may cross week boundary
    ];
    const res = focusThisWeek(sessions);
    expect(res).toBeGreaterThanOrEqual(25);
    expect(res).toBeLessThan(1000);
  });
});

describe("focusStreak", () => {
  it("returns 0 when there are no sessions", () => {
    expect(focusStreak([])).toBe(0);
  });

  it("counts consecutive days ending today", () => {
    const sessions = [
      { id: "1", date: streakDay(0) },
      { id: "2", date: streakDay(-1) },
      { id: "3", date: streakDay(-2) },
    ];
    expect(focusStreak(sessions)).toBe(3);
  });

  it("stops counting when a day is missing", () => {
    const sessions = [
      { id: "1", date: streakDay(0) },
      { id: "2", date: streakDay(-2) }, // gap at -1
    ];
    expect(focusStreak(sessions)).toBe(1);
  });
});