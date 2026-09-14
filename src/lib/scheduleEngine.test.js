import { describe, it, expect } from "vitest";
import {
  eventsForDate,
  todayTimeline,
  nextClass,
  detectConflicts,
  freeBlocks,
  durationMin,
  minutesUntil,
} from "./scheduleEngine";

const MONDAY = "2026-09-14"; // day_of_week = 1

describe("eventsForDate", () => {
  it("returns dated events plus recurring classes that fall on that weekday", () => {
    const events = [
      { id: "1", title: "One-off", date: MONDAY, start_time: "10:00", type: "other" },
      { id: "2", title: "MWF class", day_of_week: 1, start_time: "09:00", type: "class" },
      { id: "3", title: "Other-day class", day_of_week: 3, start_time: "09:00", type: "class" },
    ];
    const out = eventsForDate(events, MONDAY);
    expect(out.map((e) => e.id).sort()).toEqual(["1", "2"]);
    expect(out[0].start_time).toBe("09:00"); // sorted by time
  });

  it("does not include a recurring event marked non-recurring", () => {
    const events = [{ id: "1", title: "Once", day_of_week: 1, recurring: false, start_time: "09:00" }];
    expect(eventsForDate(events, MONDAY)).toEqual([]);
  });
});

describe("todayTimeline", () => {
  it("combines events, tasks due that day, and exams on that day, sorted by start time", () => {
    const events = [{ id: "e1", type: "class", title: "Physics", date: MONDAY, start_time: "12:00", course_id: "c1" }];
    const tasks = [{ id: "t1", title: "Submit lab", due_date: MONDAY, due_time: "23:59", status: "todo", course_id: "c1" }];
    const exams = [{ id: "x1", name: "Midterm", date: MONDAY, time: "09:00", course_id: "c1" }];

    const out = todayTimeline(events, tasks, exams, MONDAY);
    expect(out[0]).toEqual(expect.objectContaining({ type: "exam", title: "Midterm", start: "09:00" }));
    expect(out[1]).toEqual(expect.objectContaining({ type: "class", title: "Physics", start: "12:00" }));
    expect(out[2]).toEqual(expect.objectContaining({ type: "task", title: "Submit lab", start: "23:59" }));
  });

  it("excludes completed tasks", () => {
    const tasks = [{ id: "t1", title: "Done", due_date: MONDAY, status: "completed", course_id: "c1" }];
    expect(todayTimeline([], tasks, [], MONDAY)).toEqual([]);
  });
});

describe("nextClass", () => {
  const events = [
    { id: "1", title: "Class today later", type: "class", start_time: "18:00", day_of_week: 1 },
    { id: "2", title: "Class tomorrow", type: "class", start_time: "08:00", day_of_week: 2 },
  ];

  it("picks today's upcoming class when one exists", () => {
    const from = new Date(`${MONDAY}T09:00:00`);
    const res = nextClass(events, from);
    expect(res).toEqual(expect.objectContaining({ title: "Class today later", when: "today" }));
  });

  it("falls through to the next day when no class remains today", () => {
    const from = new Date(`${MONDAY}T19:00:00`);
    const res = nextClass(events, from);
    expect(res).toEqual(expect.objectContaining({ title: "Class tomorrow", when: "tomorrow" }));
  });

  it("returns null when no class exists within the next week", () => {
    const res = nextClass([], new Date(`${MONDAY}T09:00:00`));
    expect(res).toBeNull();
  });
});

describe("detectConflicts", () => {
  it("flags overlapping events and ignores non-overlapping ones", () => {
    const events = [
      { id: "1", title: "A", date: MONDAY, start_time: "09:00", end_time: "10:00" },
      { id: "2", title: "B", date: MONDAY, start_time: "09:30", end_time: "10:30" },
      { id: "3", title: "C", date: MONDAY, start_time: "11:00", end_time: "12:00" },
    ];
    const conflicts = detectConflicts(events, MONDAY);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].a.id).toBe("1");
    expect(conflicts[0].b.id).toBe("2");
  });
});

describe("freeBlocks", () => {
  it("returns free spans between scheduled events within 08:00-20:00", () => {
    const events = [
      { id: "1", date: MONDAY, start_time: "09:00", end_time: "10:00" },
      { id: "2", date: MONDAY, start_time: "14:00", end_time: "15:00" },
    ];
    const blocks = freeBlocks(events, MONDAY);
    expect(blocks).toContainEqual({ start: "08:00", end: "09:00" });
    expect(blocks).toContainEqual({ start: "10:00", end: "14:00" });
    expect(blocks).toContainEqual({ start: "15:00", end: "20:00" });
  });
});

describe("durationMin & minutesUntil", () => {
  it("computes minute duration between H:M strings", () => {
    expect(durationMin("08:00", "09:30")).toBe(90);
    expect(durationMin("09:30", "10:00")).toBe(30);
  });

  it("computes minutes until a time on a given date", () => {
    const from = new Date("2026-09-14T09:00:00");
    expect(minutesUntil("09:30", from)).toBe(30);
    expect(minutesUntil("08:00", from)).toBe(-60);
  });
});