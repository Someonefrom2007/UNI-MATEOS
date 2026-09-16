// Mission 02 (dashboard radar): pure lens over the pinned engines. All inputs
// are injected so every case below is deterministic and reproducible.
import { describe, it, expect } from "vitest";
import {
  weekStartOf,
  minutesUntilStart,
  statusBanner,
  radarClassify,
  studyVelocity,
  markIcsTimeline,
} from "@/lib/dashboardRadar";

const NOW = new Date("2026-09-16T10:00:00");
const TODAY = "2026-09-16"; // Wednesday

describe("weekStartOf", () => {
  it("returns the Monday of the containing week for a mid-week date", () => {
    expect(weekStartOf("2026-09-16")).toBe("2026-09-14");
    expect(weekStartOf("2026-09-13")).toBe("2026-09-07"); // Sunday rolls back
  });

  it("handles Monday itself", () => {
    expect(weekStartOf("2026-09-14")).toBe("2026-09-14");
  });
});

describe("minutesUntilStart", () => {
  it("computes whole minutes from now to a wall-clock start today", () => {
    expect(minutesUntilStart("10:42", NOW)).toBe(42);
    expect(minutesUntilStart("10:00", NOW)).toBe(0);
  });

  it("returns null for missing times and negatives for past starts", () => {
    expect(minutesUntilStart("", NOW)).toBeNull();
    expect(minutesUntilStart(null, NOW)).toBeNull();
    expect(minutesUntilStart("09:00", NOW)).toBe(-60);
  });
});

describe("statusBanner", () => {
  it("prioritises the next class today with a countdown", () => {
    const nc = { when: "today", start_time: "10:42", title: "Algorithms", room: "A3.01" };
    expect(statusBanner({ nc, nowDate: NOW })).toMatchObject({
      variant: "upcoming",
      title: "Next class in 42 mins",
      detail: "Algorithms · Room A3.01",
    });
  });

  it("says the class is starting near-zero minutes out", () => {
    const nc = { when: "today", start_time: "10:00", title: "Algorithms" };
    expect(statusBanner({ nc, nowDate: NOW, urgent: [] }).title).toBe("Class starting now");
  });

  it("falls through a past class to urgent exams", () => {
    const nc = { when: "today", start_time: "09:00", title: "Past" };
    const urgent = [
      { kind: "exam", item: { id: "e1" }, course: { name: "Calculus" } },
      { kind: "exam", item: { id: "e2" }, course: { name: "Physics" } },
    ];
    expect(statusBanner({ nc, urgent, nowDate: NOW })).toMatchObject({
      variant: "attention",
      title: "2 pending high-priority exams",
      detail: "Calculus",
    });
  });

  it("reports a single pending exam with singular copy", () => {
    const urgent = [{ kind: "exam", item: { id: "e1" }, course: null }];
    const b = statusBanner({ urgent, nowDate: NOW });
    expect(b.variant).toBe("attention");
    expect(b.title).toBe("1 pending high-priority exam");
  });

  it("falls back to urgent tasks with priority and relative deadline", () => {
    const urgent = [{ kind: "task", item: { id: "t1", title: "Write abstract", priority: "high", due_date: "2026-09-18" } }];
    const b = statusBanner({ urgent, nowDate: NOW });
    expect(b.variant).toBe("attention");
    expect(b.title).toBe("Write abstract");
    expect(b.detail).toContain("Priority high");
  });

  it("shifts to planned weekly load when nothing is urgent", () => {
    const b = statusBanner({ urgent: [], workloadMinutes: 200, nowDate: NOW });
    expect(b.variant).toBe("steady");
    expect(b.title).toBe("3h 20m of study planned this week");
  });

  it("ends at an honest all-clear with zero everything", () => {
    const b = statusBanner({ nc: null, urgent: [], workloadMinutes: 0, nowDate: NOW });
    expect(b).toMatchObject({ variant: "clear", title: "All clear for today" });
  });
});

describe("radarClassify", () => {
  it("classifies low when both effort and completions stay under the bar", () => {
    const r = radarClassify({ workloadMinutes: 60, focusMinutes: 120, completionsWeek: 2 });
    expect(r.level).toBe("low");
    expect(r.label).toBe("Low");
    expect(r.totalHours).toBe(3);
  });

  it("classifies balanced in the sustainable middle", () => {
    const r = radarClassify({ workloadMinutes: 300, focusMinutes: 300, completionsWeek: 6 });
    expect(r.level).toBe("balanced");
    expect(r.totalHours).toBe(10);
  });

  it("classifies overdrive beyond the high-output bar", () => {
    const r = radarClassify({ workloadMinutes: 900, focusMinutes: 900, completionsWeek: 10 });
    expect(r.level).toBe("overdrive");
    expect(r.totalHours).toBe(30);
  });

  it("treats zero input as low without a division error", () => {
    const r = radarClassify({});
    expect(r.level).toBe("low");
    expect(r.totalHours).toBe(0);
    expect(r.completionsWeek).toBe(0);
  });

  it("keeps minutes and completions on the result verbatim", () => {
    const r = radarClassify({ workloadMinutes: 480, focusMinutes: 0, completionsWeek: 4 });
    expect(r.workloadMinutes).toBe(480);
    expect(r.focusMinutes).toBe(0);
    expect(r.completionsWeek).toBe(4);
    expect(r.level).toBe("balanced");
    expect(r.note.length).toBeGreaterThan(0);
  });
});

describe("studyVelocity", () => {
  it("assembles workload + focus from the engines and classifies the result", () => {
    const in7 = (days) => {
      const d = new Date("2026-09-16T00:00:00");
      d.setDate(d.getDate() + days);
      return d.toISOString().slice(0, 10);
    };
    const tasks = [
      { id: "t1", title: "Lab", course_id: "c1", status: "todo", due_date: in7(3), estimated_duration: 120 },
      { id: "t2", title: "Reading", course_id: "c1", status: "todo", due_date: in7(2), estimated_duration: 60 },
    ];
    const exams = [{ id: "e1", course_id: "c1", status: "upcoming", date: in7(5), topics: [], weight: 2 }];
    const focus = [{ date: "2026-09-15", duration: 45, completed: true }];
    const courses = [{ id: "c1", name: "Algorithms" }];
    const r = studyVelocity({ tasks, exams, focusSessions: focus, courses, todayStr: "2026-09-16" });
    expect(r.workloadMinutes).toBeGreaterThan(0);
    expect(r.focusMinutes).toBe(45);
    expect(["low", "balanced", "overdrive"]).toContain(r.level);
    expect(r.completionsWeek).toBe(0);
  });
});

describe("markIcsTimeline", () => {
  const events = [
    { id: "e-1", google_event_id: "ics:https://cal.example/feed.ics:abc" },
    { id: "e-2", google_event_id: null },
  ];

  it("badges only items backed by an ICS-sourced event", () => {
    const timeline = markIcsTimeline(
      [
        { id: "evt-e-1", title: "Imported lecture", type: "personal" },
        { id: "evt-e-2", title: "Manual class", type: "class" },
        { id: "task-t1", title: "A task", type: "task" },
        { id: "evt-orphan", title: "Gone event", type: "personal" },
      ],
      events
    );
    expect(timeline[0].ics).toBe(true);
    expect(timeline[1].ics).toBe(false);
    expect(timeline[2].ics).toBeUndefined();
    expect(timeline[3].ics).toBeUndefined();
  });

  it("tolerates empty inputs", () => {
    expect(markIcsTimeline([], [])).toEqual([]);
  });
});