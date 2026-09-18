import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  buildNotifications, deadlineItems, examItems, conflictItems, riskItems,
  wellbeingItems, groupNotifications, countBySeverity, applyDismissed,
  pruneDismissed, SEVERITY, attendanceItems, deriveNotifications,
} from "@/lib/notifications";

// Dates are relative to "now" because the engine classifies by proximity.
const iso = (offsetDays) => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const TODAY = iso(0);

describe("deadlineItems", () => {
  it("flags an overdue task as critical when priority is high", () => {
    const items = deadlineItems([{ id: "t1", title: "Essay", due_date: iso(-2), status: "todo", priority: "high" }]);
    expect(items).toHaveLength(1);
    expect(items[0].severity).toBe("critical");
    expect(items[0].detail).toBe("Overdue by 2 days");
    expect(items[0].key).toBe("deadline:overdue:t1");
  });

  it("uses singular wording for a one-day overrun", () => {
    const items = deadlineItems([{ id: "t1", title: "Essay", due_date: iso(-1), status: "todo", priority: "low" }]);
    expect(items[0].detail).toBe("Overdue by 1 day");
  });

  it("ignores completed tasks", () => {
    const items = deadlineItems([{ id: "t1", title: "Done", due_date: iso(-3), status: "completed", priority: "urgent" }]);
    expect(items).toHaveLength(0);
  });

  it("respects the horizon so distant work stays out of the inbox", () => {
    const far = deadlineItems([{ id: "t1", title: "Later", due_date: iso(30), status: "todo" }], { horizon: 7 });
    expect(far).toHaveLength(0);
    const near = deadlineItems([{ id: "t1", title: "Soon", due_date: iso(3), status: "todo" }], { horizon: 7 });
    expect(near).toHaveLength(1);
    expect(near[0].severity).toBe("warning");
  });

  it("calls today and tomorrow critical", () => {
    const items = deadlineItems([
      { id: "a", title: "Today", due_date: TODAY, status: "todo" },
      { id: "b", title: "Tomorrow", due_date: iso(1), status: "todo" },
      { id: "c", title: "In four", due_date: iso(4), status: "todo" },
    ]);
    expect(items.map((i) => i.severity)).toEqual(["critical", "critical", "info"]);
    expect(items[0].detail).toBe("Due today");
    expect(items[1].detail).toBe("Due tomorrow");
  });

  it("skips tasks with no due date", () => {
    expect(deadlineItems([{ id: "t1", title: "Someday", status: "todo" }])).toHaveLength(0);
  });
});

describe("examItems", () => {
  it("reports an imminent exam with its countdown", () => {
    const items = examItems([{ id: "e1", name: "Midterm", date: iso(3), type: "exam", location: "A-101" }]);
    expect(items).toHaveLength(1);
    expect(items[0].severity).toBe("warning");
    expect(items[0].detail).toBe("exam · In 3 days · A-101");
  });

  it("ignores exams outside the horizon and past exams", () => {
    expect(examItems([{ id: "e1", name: "Later", date: iso(40) }])).toHaveLength(0);
    expect(examItems([{ id: "e1", name: "Past", date: iso(-3) }])).toHaveLength(0);
  });

  it("adds a preparation item only when topics actually exist", () => {
    const noTopics = examItems([{ id: "e1", name: "Quiz", date: iso(2) }]);
    expect(noTopics.filter((i) => i.category === "exam" && i.key.includes("prep"))).toHaveLength(0);

    const withTopics = examItems([{
      id: "e1", name: "Quiz", date: iso(2),
      topics: [{ reviewed: true, mastery: 90 }, { reviewed: false, mastery: 30 }, { reviewed: false, mastery: 40 }],
    }]);
    const prep = withTopics.find((i) => i.key === "exam:prep:e1");
    expect(prep).toBeTruthy();
    expect(prep.detail).toBe("2 of 3 topics not reviewed · 2 below 60% mastery");
  });

  it("does not claim a prep gap when every topic is reviewed", () => {
    const items = examItems([{
      id: "e1", name: "Quiz", date: iso(2),
      topics: [{ reviewed: true, mastery: 95 }, { reviewed: true, mastery: 80 }],
    }]);
    expect(items.find((i) => i.key === "exam:prep:e1")).toBeUndefined();
  });
});

describe("conflictItems", () => {
  it("describes the overlapping pair with both time ranges", () => {
    const items = conflictItems([{
      dateStr: TODAY,
      a: { id: "a", title: "Lecture", start_time: "10:00", end_time: "11:30" },
      b: { id: "b", title: "Lab", start_time: "11:00", end_time: "12:00" },
    }]);
    expect(items[0].severity).toBe("warning");
    expect(items[0].title).toBe("Lecture overlaps Lab");
    expect(items[0].detail).toBe("10:00–11:30 clashes with 11:00–12:00");
    expect(items[0].to).toBe("/schedule");
  });
});

describe("riskItems", () => {
  it("raises a failing course", () => {
    const items = riskItems([{ id: "c1", code: "CS101", name: "Programming" }], { gradeFor: () => 4.2 });
    expect(items[0].severity).toBe("critical");
    expect(items[0].title).toBe("CS101 is below the pass mark");
    expect(items[0].detail).toContain("4.20");
  });

  it("raises an under-target course once the gap is meaningful", () => {
    const items = riskItems([{ id: "c1", code: "PSY101", name: "Psych", target_grade: 8 }], { gradeFor: () => 6.5 });
    expect(items[0].severity).toBe("warning");
    expect(items[0].detail).toContain("6.50");
    expect(items[0].detail).toContain("1.50 to close");
  });

  it("stays quiet for a small gap or a met target", () => {
    expect(riskItems([{ id: "c1", name: "A", target_grade: 8 }], { gradeFor: () => 7.8 })).toHaveLength(0);
    expect(riskItems([{ id: "c1", name: "A", target_grade: 7 }], { gradeFor: () => 9 })).toHaveLength(0);
  });

  it("treats missing grades as no signal rather than risk", () => {
    expect(riskItems([{ id: "c1", name: "A", target_grade: 8 }], { gradeFor: () => null })).toHaveLength(0);
    expect(riskItems([{ id: "c1", name: "A" }], {})).toHaveLength(0);
  });

  it("skips archived courses", () => {
    expect(riskItems([{ id: "c1", name: "Old", archived: true }], { gradeFor: () => 2 })).toHaveLength(0);
  });
});

describe("wellbeingItems", () => {
  const sessions = (dates) => dates.flatMap((d, i) => [
    { id: `s${i}a`, date: d, duration: 150 },
    { id: `s${i}b`, date: d, duration: 150 },
  ]);

  it("needs real history before saying anything", () => {
    expect(wellbeingItems({ focusSessions: [{ date: TODAY, duration: 600 }], todayStr: TODAY })).toHaveLength(0);
  });

  it("flags three heavy days inside the last week", () => {
    const items = wellbeingItems({ focusSessions: sessions([iso(0), iso(-1), iso(-2)]), todayStr: TODAY });
    expect(items).toHaveLength(1);
    expect(items[0].detail).toContain("3 of the last 3 days");
  });

  it("stays quiet when the load is spread out", () => {
    const items = wellbeingItems({
      focusSessions: [
        ...sessions([iso(0)]),
        { id: "x", date: iso(-1), duration: 60 },
        { id: "y", date: iso(-2), duration: 60 },
        { id: "z", date: iso(-3), duration: 90 },
        { id: "w", date: iso(-4), duration: 120 },
      ],
      todayStr: TODAY,
    });
    expect(items).toHaveLength(0);
  });
});

describe("buildNotifications", () => {
  it("orders critical before warning before info", () => {
    const items = buildNotifications({
      tasks: [
        { id: "a", title: "Later", due_date: iso(6), status: "todo" },
        { id: "b", title: "Now", due_date: TODAY, status: "todo" },
        { id: "c", title: "Soon", due_date: iso(2), status: "todo" },
      ],
      todayStr: TODAY,
    });
    expect(items.map((i) => i.severity)).toEqual(["critical", "warning", "info"]);
  });

  it("produces an empty inbox from empty data instead of inventing items", () => {
    expect(buildNotifications({})).toEqual([]);
    expect(buildNotifications({ tasks: [], exams: [], courses: [], conflicts: [], focusSessions: [] })).toEqual([]);
  });

  it("groups by category in a stable order and drops empty groups", () => {
    const groups = groupNotifications([
      { key: "1", category: "risk", severity: "info" },
      { key: "2", category: "deadline", severity: "critical" },
    ]);
    expect(groups.map((g) => g.category)).toEqual(["deadline", "risk"]);
  });

  it("counts by severity", () => {
    const counts = countBySeverity([
      { severity: "critical" }, { severity: "critical" }, { severity: "warning" }, { severity: "info" },
    ]);
    expect(counts).toEqual({ critical: 2, warning: 1, info: 1, total: 4 });
  });

  it("exposes the severity ordering used for sorting", () => {
    expect(SEVERITY.critical).toBeGreaterThan(SEVERITY.warning);
    expect(SEVERITY.warning).toBeGreaterThan(SEVERITY.info);
  });
});

describe("dismissal bookkeeping", () => {
  it("hides dismissed keys and shows everything else", () => {
    const items = [{ key: "a" }, { key: "b" }];
    expect(applyDismissed(items, ["a"]).map((i) => i.key)).toEqual(["b"]);
    expect(applyDismissed(items, [])).toHaveLength(2);
  });

  it("prunes keys whose condition no longer exists", () => {
    const items = [{ key: "a" }];
    expect(pruneDismissed(["a", "stale"], items)).toEqual(["a"]);
  });
});

describe("attendanceItems", () => {
  it("fires only for a course below its own requirement", () => {
    const courses = [{ id: "c1", name: "Algebra" }, { id: "c2", name: "Biology" }];
    const attendanceFor = (c) => (c.id === "c1" ? { rate: 55, target: 80 } : { rate: 90, target: 80 });
    const items = attendanceItems(courses, { attendanceFor });
    expect(items).toHaveLength(1);
    expect(items[0].key).toBe("risk:attendance:c1");
    expect(items[0].detail).toContain("25.0 points short");
  });

  it("never reports a course with no attendance record as at risk", () => {
    // rate null means "nothing logged", which is not a risk signal.
    const items = attendanceItems([{ id: "c1", name: "Algebra" }], {
      attendanceFor: () => ({ rate: null, target: 80 }),
    });
    expect(items).toEqual([]);
  });

  it("skips archived courses", () => {
    const items = attendanceItems([{ id: "c1", name: "Algebra", archived: true }], {
      attendanceFor: () => ({ rate: 10, target: 80 }),
    });
    expect(items).toEqual([]);
  });

  it("does nothing without a summarizer", () => {
    expect(attendanceItems([{ id: "c1" }], {})).toEqual([]);
  });
});

describe("deriveNotifications", () => {
  const data = {
    Course: [
      { id: "c1", name: "Algebra", code: "MATH1", target_grade: 7, attendance_required: 80 },
      { id: "c2", name: "Archived", archived: true },
    ],
    Task: [{ id: "t1", title: "Essay", due_date: TODAY, status: "todo", priority: "high" }],
    Exam: [],
    Grade: [],
    Attendance: [
      { id: "a1", course_id: "c1", status: "present" },
      { id: "a2", course_id: "c1", status: "absent" },
      { id: "a3", course_id: "c1", status: "absent" },
    ],
    FocusSession: [],
    ScheduleEvent: [],
  };

  it("derives a full inbox from the raw data bundle in one call", () => {
    const { all, courses } = deriveNotifications(data, { todayStr: TODAY });
    // Archived courses are excluded from the course list passed to the engine.
    expect(courses.map((c) => c.id)).toEqual(["c1"]);
    expect(all.some((i) => i.key === "deadline:soon:t1")).toBe(true);
  });

  it("raises the attendance risk from real rows via the shared path", () => {
    const { all } = deriveNotifications(data, { todayStr: TODAY });
    const att = all.find((i) => i.key === "risk:attendance:c1");
    expect(att).toBeTruthy();
    // 1 present of 3 judged = 33.3% against the course's own 80%.
    expect(att.detail).toContain("33.3%");
  });

  it("tolerates a missing data bundle", () => {
    const { all, courses } = deriveNotifications(undefined, { todayStr: TODAY });
    expect(all).toEqual([]);
    expect(courses).toEqual([]);
  });

  it("adds schedule conflicts only when a detector is supplied", () => {
    const withConflicts = deriveNotifications(
      { ...data, ScheduleEvent: [{ id: "e1", date: TODAY, start_time: "09:00", end_time: "10:00" }] },
      {
        todayStr: TODAY,
        conflictDays: 1,
        detectConflicts: () => [
          { a: { id: "e1", title: "A", start_time: "09:00" }, b: { id: "e2", title: "B", start_time: "09:30" }, dateStr: TODAY },
        ],
      }
    );
    expect(withConflicts.all.some((i) => i.category === "schedule")).toBe(true);

    const without = deriveNotifications(data, { todayStr: TODAY });
    expect(without.all.some((i) => i.category === "schedule")).toBe(false);
  });
});
