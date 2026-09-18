import { describe, it, expect } from "vitest";
import {
  examToForm,
  formToExamPatch,
  validateExamForm,
  gradeToForm,
  formToGradePatch,
  validateGradeForm,
  resourceToForm,
  formToResourcePatch,
  validateResourceForm,
  isSafeUrl,
  eventToForm,
  formToEventPatch,
  validateEventForm,
  isValidGrade,
  orphanedExamIds,
} from "@/lib/recordForms";

describe("grades are bounded 0–10", () => {
  it("accepts in-range values including the bounds", () => {
    expect(isValidGrade(0)).toBe(true);
    expect(isValidGrade(10)).toBe(true);
    expect(isValidGrade("7.5")).toBe(true);
  });

  it("rejects out-of-range and non-numeric values", () => {
    expect(isValidGrade(10.1)).toBe(false);
    expect(isValidGrade(-0.1)).toBe(false);
    expect(isValidGrade("abc")).toBe(false);
    expect(isValidGrade("")).toBe(false);
    expect(isValidGrade(null)).toBe(false);
  });
});

describe("exam form mapping", () => {
  it("defaults a blank exam", () => {
    expect(examToForm({})).toEqual({
      name: "",
      course_id: null,
      type: "exam",
      date: "",
      time: "",
      location: "",
      weight: "",
      grade: "",
      notes: "",
      status: "upcoming",
    });
  });

  it("clears empty fields to null so edits actually remove data", () => {
    const patch = formToExamPatch({ name: "  Midterm ", weight: "", grade: "", date: "", time: "", location: "  ", notes: "" });
    expect(patch.name).toBe("Midterm");
    expect(patch.date).toBeNull();
    expect(patch.time).toBeNull();
    expect(patch.location).toBeNull();
    expect(patch.notes).toBeNull();
    expect(patch.grade).toBeNull();
    expect(patch.weight).toBe(0);
  });

  it("round-trips a real exam", () => {
    const row = {
      name: "Midterm",
      course_id: "c1",
      type: "midterm",
      date: "2026-10-02",
      time: "10:00",
      location: "Hall B",
      weight: 30,
      grade: 7.4,
      notes: "Formula sheet allowed",
      status: "completed",
    };
    expect(formToExamPatch(examToForm(row))).toEqual(row);
  });

  it("requires a name, a course and a sane weight and grade", () => {
    expect(validateExamForm({ name: "", course_id: "c1" })).toBeTruthy();
    expect(validateExamForm({ name: "X", course_id: null })).toBeTruthy();
    expect(validateExamForm({ name: "X", course_id: "c1", weight: "150" })).toBeTruthy();
    expect(validateExamForm({ name: "X", course_id: "c1", grade: "11" })).toBeTruthy();
    expect(validateExamForm({ name: "X", course_id: "c1", weight: "30", grade: "9" })).toBeNull();
  });
});

describe("grade form mapping", () => {
  it("requires a course and an in-range grade", () => {
    expect(validateGradeForm({ name: "Quiz", course_id: "c1", grade: "" })).toBeTruthy();
    expect(validateGradeForm({ name: "Quiz", course_id: "c1", grade: "12" })).toBeTruthy();
    expect(validateGradeForm({ name: "Quiz", course_id: null, grade: "8" })).toBeTruthy();
    expect(validateGradeForm({ name: "Quiz", course_id: "c1", grade: "8" })).toBeNull();
  });

  it("keeps the grade numeric and the date clearable", () => {
    const patch = formToGradePatch({ name: "Lab", course_id: "c1", grade: "8.4", weight: "15", date: "" });
    expect(patch.grade).toBe(8.4);
    expect(patch.date).toBeNull();
    expect(patch.exam_id).toBeNull();
  });

  it("round-trips a linked grade", () => {
    const row = { name: "Final", course_id: "c1", exam_id: "e1", type: "exam", grade: 8, weight: 40, date: "2026-12-01" };
    expect(formToGradePatch(gradeToForm(row))).toEqual(row);
  });
});

describe("resource urls are constrained", () => {
  it("allows empty and http(s) urls only", () => {
    expect(isSafeUrl("")).toBe(true);
    expect(isSafeUrl("https://example.com/a.pdf")).toBe(true);
    expect(isSafeUrl("http://example.com")).toBe(true);
    expect(isSafeUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeUrl("data:text/html,<script>")).toBe(false);
    expect(isSafeUrl("not a url")).toBe(false);
  });

  it("surfaces an unsafe url as a validation error", () => {
    expect(validateResourceForm({ name: "Slides", url: "javascript:alert(1)" })).toBeTruthy();
    expect(validateResourceForm({ name: "Slides", url: "https://x.test" })).toBeNull();
    expect(validateResourceForm({ name: "", url: "" })).toBeTruthy();
  });

  it("clears blank url and description", () => {
    const patch = formToResourcePatch({ name: "Notes", url: "  ", description: "" });
    expect(patch.url).toBeNull();
    expect(patch.description).toBeNull();
  });

  it("round-trips a resource", () => {
    const row = { name: "Slides", type: "pdf", course_id: "c1", url: "https://x.test/s.pdf", description: "Week 3" };
    expect(formToResourcePatch(resourceToForm(row))).toEqual(row);
  });
});

describe("event form mapping", () => {
  it("requires a weekday when recurring and a date when not", () => {
    expect(validateEventForm({ title: "Lecture", recurring: true, day_of_week: "" })).toBeTruthy();
    expect(validateEventForm({ title: "Lecture", recurring: false, date: "" })).toBeTruthy();
    expect(validateEventForm({ title: "Lecture", recurring: true, day_of_week: 1 })).toBeNull();
    expect(validateEventForm({ title: "Lecture", recurring: false, date: "2026-09-20" })).toBeNull();
  });

  it("rejects an end time before the start", () => {
    expect(validateEventForm({ title: "Study", recurring: false, date: "2026-09-20", start_time: "14:00", end_time: "13:00" })).toBeTruthy();
    expect(validateEventForm({ title: "Study", recurring: false, date: "2026-09-20", start_time: "13:00", end_time: "14:00" })).toBeNull();
  });

  it("requires a title", () => {
    expect(validateEventForm({ title: "  ", recurring: true, day_of_week: 2 })).toBeTruthy();
  });

  it("round-trips a recurring class", () => {
    const row = {
      title: "Linear Algebra — Lecture",
      type: "class",
      course_id: "c1",
      date: null,
      day_of_week: 1,
      start_time: "10:00",
      end_time: "11:30",
      room: "A-101",
      recurring: true,
    };
    expect(formToEventPatch(eventToForm(row))).toEqual(row);
  });

  it("round-trips a one-off event", () => {
    const row = {
      title: "Study session",
      type: "study",
      course_id: null,
      date: "2026-09-21",
      day_of_week: null,
      start_time: "18:00",
      end_time: "20:00",
      room: null,
      recurring: false,
    };
    expect(formToEventPatch(eventToForm(row))).toEqual(row);
  });
});

describe("orphanedExamIds", () => {
  it("reports the exam a grade points at", () => {
    expect(orphanedExamIds({ exam_id: "e1" })).toEqual(["e1"]);
    expect(orphanedExamIds({ exam_id: null })).toEqual([]);
    expect(orphanedExamIds(null)).toEqual([]);
  });
});
