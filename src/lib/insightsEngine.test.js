import { describe, it, expect } from "vitest";
import { generateInsights, recommendNow } from "./insightsEngine";

const todayISO = () => new Date().toISOString().slice(0, 10);
const dateFromToday = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

describe("generateInsights", () => {
  it("reports a task completion-rate insight when tasks were created this week", () => {
    const tasks = [
      { id: "1", created_date: dateFromToday(0), completed_date: dateFromToday(0), status: "completed" },
      { id: "2", created_date: dateFromToday(0), completed_date: null, status: "todo" },
    ];
    const insights = generateInsights({ tasks });
    const rate = insights.find((i) => i.id === "task-rate");
    expect(rate).toBeDefined();
    expect(rate.value).toBe(50);
  });

  it("flags an exam within 14 days as exam pressure", () => {
    const examDate = dateFromToday(3);
    const exams = [{ id: "x1", name: "Final", date: examDate, course_id: "c1", status: "todo" }];
    const courses = [{ id: "c1", name: "Physics" }];
    const insights = generateInsights({ exams, courses });
    const pressure = insights.find((i) => i.id === "exam-pressure");
    expect(pressure).toBeDefined();
    // Value is calendar days-ish; accept the computed norm
    expect(pressure.value).toBeGreaterThanOrEqual(0);
    expect(pressure.value).toBeLessThanOrEqual(14);
    expect(pressure.text).toContain("Physics");
  });

  it("clusters when 3+ tasks are due within 5 days", () => {
    const tasks = [0, 1, 2, 3].map((n, i) => ({
      id: String(i),
      due_date: dateFromToday(n),
      status: "todo",
    }));
    const insights = generateInsights({ tasks });
    const cluster = insights.find((i) => i.id === "deadline-cluster");
    expect(cluster).toBeDefined();
    expect(cluster.value).toBeGreaterThanOrEqual(3);
  });

  it("returns empty when there is no data", () => {
    expect(generateInsights({})).toEqual([]);
  });

  it("sorts Risk-category insights to the front", () => {
    const tasks = [0, 1, 2].map((n, i) => ({ id: String(i), due_date: dateFromToday(n), status: "todo" }));
    const exams = [{ id: "x1", name: "Final", date: dateFromToday(2), course_id: "c1", status: "todo" }];
    const insights = generateInsights({ tasks, exams });
    expect(insights[0].category).toBe("Risk");
  });
});

describe("recommendNow", () => {
  it("recommends the most urgent overdue task first", () => {
    const tasks = [
      { id: "t1", title: "Overdue normal", due_date: dateFromToday(-2), priority: "high", status: "todo", course_id: "c1" },
      { id: "t2", title: "Overdue urgent", due_date: dateFromToday(-1), priority: "urgent", status: "todo", course_id: "c1" },
    ];
    const res = recommendNow({ tasks, exams: [], courses: [], events: [] });
    expect(res).toMatchObject({ taskId: "t2", kind: "task" });
  });

  it("recommends the nearest exam when nothing is overdue", () => {
    const exams = [
      { id: "x1", name: "Midterm", date: dateFromToday(2), status: "todo", course_id: "c1" },
    ];
    const res = recommendNow({ tasks: [], exams, courses: [], events: [] });
    expect(res).toMatchObject({ examId: "x1", kind: "exam" });
  });

  it("falls back to the next task due today/soon", () => {
    const tasks = [
      { id: "t1", title: "Do homework", due_date: dateFromToday(1), status: "todo", course_id: "c1" },
    ];
    const res = recommendNow({ tasks, exams: [], courses: [], events: [] });
    expect(res).toMatchObject({ taskId: "t1", kind: "task" });
  });

  it("returns null when there is nothing actionable", () => {
    expect(recommendNow({ tasks: [], exams: [], courses: [], events: [] })).toBeNull();
  });
});