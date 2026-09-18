import { describe, it, expect, beforeEach } from "vitest";
import { getDefaultStorage } from "@/lib/repo/storage";
import { createLocalRepo } from "@/lib/repo/localRepo";
import { loadDemoData } from "@/lib/demoData";

// The seeder shares the memoized default storage with this repo instance, so
// seeding here writes exactly what a local-workspace user would get.
const repo = createLocalRepo();
const storage = getDefaultStorage();

const count = (table) => repo.list(table).length;

const reset = () => {
  storage.clear();
};

describe("demoData: repeatable seeding", () => {
  beforeEach(reset);

  it("loads the sample semester", async () => {
    await loadDemoData();
    expect(count("courses")).toBe(4);
    expect(count("schedule_events")).toBe(6);
    expect(count("tasks")).toBe(5);
    expect(count("exams")).toBe(3);
  });

  it("does not duplicate anything when loaded twice", async () => {
    await loadDemoData();
    const first = {
      courses: count("courses"),
      schedule_events: count("schedule_events"),
      tasks: count("tasks"),
      exams: count("exams"),
      grades: count("grades"),
      notes: count("notes"),
      sticky_notes: count("sticky_notes"),
      habits: count("habits"),
      habit_logs: count("habit_logs"),
      goals: count("goals"),
      focus_sessions: count("focus_sessions"),
    };

    await loadDemoData();

    Object.entries(first).forEach(([table, n]) => {
      // The bug this guards: a second load doubled every one of these, which
      // showed up as each class conflicting with its own duplicate.
      expect(count(table), `${table} duplicated on re-seed`).toBe(n);
    });
  });

  it("stays stable across three loads", async () => {
    await loadDemoData();
    await loadDemoData();
    await loadDemoData();
    expect(count("courses")).toBe(4);
    expect(count("tasks")).toBe(5);
    expect(count("sticky_notes")).toBe(5);
  });

  it("leaves the student's own courses and their work untouched", async () => {
    await loadDemoData();

    const mine = repo.create("courses", {
      name: "My Own Course",
      code: "MINE101",
      ects: 5,
      archived: false,
    });
    const myTask = repo.create("tasks", {
      title: "My own task",
      course_id: mine.id,
      due_date: "2026-10-01",
      status: "todo",
      estimated_duration: 45,
    });
    const myNote = repo.create("notes", { title: "My own note", course_id: mine.id });
    const mySticky = repo.create("sticky_notes", { content: "call my tutor" });

    const before = {
      courses: count("courses"),
      tasks: count("tasks"),
      notes: count("notes"),
      sticky_notes: count("sticky_notes"),
    };

    await loadDemoData();

    expect(count("courses")).toBe(before.courses);
    expect(count("tasks")).toBe(before.tasks);
    expect(count("notes")).toBe(before.notes);
    expect(count("sticky_notes")).toBe(before.sticky_notes);

    const ids = (table) => repo.list(table).map((r) => r.id);
    expect(ids("courses")).toContain(mine.id);
    expect(ids("tasks")).toContain(myTask.id);
    expect(ids("notes")).toContain(myNote.id);
    expect(ids("sticky_notes")).toContain(mySticky.id);
  });

  it("never leaves two classes scheduled at the same time on the same weekday", async () => {
    await loadDemoData();
    await loadDemoData();

    const classes = repo.list("schedule_events").filter((e) => e.type === "class");
    const seen = new Set();
    let collisions = 0;
    classes.forEach((c) => {
      const key = `${c.day_of_week}|${c.start_time}|${c.title}`;
      if (seen.has(key)) collisions++;
      seen.add(key);
    });
    expect(collisions).toBe(0);
  });

  it("re-seeding restores a deleted sample course", async () => {
    await loadDemoData();
    const math = repo.list("courses").find((c) => c.code === "MATH201");
    repo.delete("courses", math.id);
    expect(count("courses")).toBe(3);

    await loadDemoData();
    expect(count("courses")).toBe(4);
    expect(repo.list("courses").some((c) => c.code === "MATH201")).toBe(true);
  });

  it("reports how much it seeded", async () => {
    const summary = await loadDemoData();
    expect(summary.courses).toBe(4);
    expect(summary.tasks).toBe(5);
    expect(summary.exams).toBe(3);
  });
});
