import { describe, it, expect } from "vitest";
import {
  COURSE_SCOPED,
  courseDependents,
  dependentTotal,
  dependentSummary,
  planCourseDelete,
} from "@/lib/courseLifecycle";

const courseA = { id: "a" };
const courseB = { id: "b" };

const data = {
  Task: [
    { id: "t1", course_id: "a" },
    { id: "t2", course_id: "b" },
    { id: "t3", course_id: null },
  ],
  Note: [{ id: "n1", course_id: "a" }],
  Resource: [{ id: "r1", course_id: "a" }, { id: "r2", course_id: "a" }],
  ScheduleEvent: [{ id: "s1", course_id: "a" }, { id: "s2", course_id: "b" }],
  FocusSession: [{ id: "f1", course_id: "a" }],
  Project: [{ id: "p1", course_id: "a" }],
  Exam: [{ id: "e1", course_id: "a" }],
  Grade: [{ id: "g1", course_id: "a" }, { id: "g2", course_id: "b" }],
  Attendance: [{ id: "at1", course_id: "a" }],
};

describe("courseDependents", () => {
  it("counts only rows referencing the course", () => {
    const counts = courseDependents(data, "a");
    expect(counts.Task).toBe(1);
    expect(counts.Note).toBe(1);
    expect(counts.Resource).toBe(2);
    expect(counts.Exam).toBe(1);
    expect(counts.Grade).toBe(1);
    expect(counts.Attendance).toBe(1);
    // course B rows never counted
    expect(courseDependents(data, "b").Task).toBe(1);
  });

  it("coerces ids so numeric/string ids still match", () => {
    const counts = courseDependents({ Task: [{ id: "t", course_id: 7 }] }, "7");
    expect(counts.Task).toBe(1);
  });

  it("returns zeroes for every entity when nothing is linked", () => {
    const counts = courseDependents({}, "a");
    expect(Object.keys(counts).sort()).toEqual(Object.keys(COURSE_SCOPED).sort());
    expect(dependentTotal(counts)).toBe(0);
  });

  it("survives malformed rows", () => {
    const counts = courseDependents({ Task: [null, undefined, { id: "x" }] }, "a");
    expect(counts.Task).toBe(0);
  });
});

describe("dependentSummary", () => {
  it("lists only non-empty groups with their labels", () => {
    const summary = dependentSummary(courseDependents(data, "a"));
    expect(summary.map((s) => s.entity)).toEqual(["Task", "Note", "Resource", "ScheduleEvent", "FocusSession", "Project", "Exam", "Grade", "Attendance"]);
    expect(summary.find((s) => s.entity === "Resource").count).toBe(2);
    expect(summary.every((s) => s.count > 0)).toBe(true);
  });

  it("is empty when nothing is attached", () => {
    expect(dependentSummary(courseDependents({}, "a"))).toEqual([]);
  });
});

describe("planCourseDelete", () => {
  it("keepWork splits optional (unlink) from required (delete)", () => {
    const plan = planCourseDelete(data, "a", { keepWork: true });
    const unlinked = plan.unlink.map((x) => x.entity + ":" + x.id).sort();
    const removed = plan.remove.map((x) => x.entity + ":" + x.id).sort();

    // optional children survive, detached
    expect(unlinked).toEqual(["FocusSession:f1", "Note:n1", "Project:p1", "Resource:r1", "Resource:r2", "ScheduleEvent:s1", "Task:t1"]);
    // NOT NULL course_id children can't exist without a course
    expect(removed).toEqual(["Attendance:at1", "Exam:e1", "Grade:g1"]);
    expect(plan.total).toBe(10);
  });

  it("requires deletion wipes every dependent", () => {
    const plan = planCourseDelete(data, "a", { keepWork: false });
    expect(plan.unlink).toEqual([]);
    expect(plan.remove).toHaveLength(10);
    expect(plan.total).toBe(10);
  });

  it("never touches another course's rows", () => {
    const plan = planCourseDelete(data, "a");
    const touched = [...plan.unlink, ...plan.remove].map((x) => x.id);
    expect(touched).not.toContain("t2");
    expect(touched).not.toContain("s2");
    expect(touched).not.toContain("g2");
  });

  it("never unlinks a required child even when keeping work", () => {
    const plan = planCourseDelete(data, "a", { keepWork: true });
    const required = Object.entries(COURSE_SCOPED).filter(([, c]) => !c.optional).map(([e]) => e);
    plan.unlink.forEach((u) => expect(required).not.toContain(u.entity));
  });

  it("is a no-op for a course with nothing attached", () => {
    const plan = planCourseDelete({}, "a");
    expect(plan.unlink).toEqual([]);
    expect(plan.remove).toEqual([]);
    expect(plan.total).toBe(0);
  });

  it("reports the chosen mode back to the caller", () => {
    expect(planCourseDelete(data, "a", { keepWork: true }).keepWork).toBe(true);
    expect(planCourseDelete(data, "a", { keepWork: false }).keepWork).toBe(false);
  });
});
