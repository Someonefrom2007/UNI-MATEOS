import { describe, it, expect } from "vitest";
import {
  EVENT_TYPES,
  TASK_STATUSES,
  courseCode,
  courseFilterOptions,
  emptyFilters,
  toggleValue,
  hasActiveFilters,
  filterEvents,
  filterTasks,
  applyScheduleFilters,
} from "@/lib/scheduleFilters";
import { parseICS, parseRRULE, toScheduleEventRows, diffICS, expandICS } from "@/lib/calendarSync";
import { detectConflicts } from "@/lib/scheduleEngine";

const COURSES = [
  { id: "c-alg", code: "ALG", name: "Algebra" },
  { id: "c-phys", code: "PHY", name: "Physics" },
  { id: "c-nocode", code: "", name: "History" },
  { id: "c-blank", code: "", name: "" },
];

const EVENTS = [
  { id: "e1", title: "Algebra lecture", type: "class", course_id: "c-alg" },
  { id: "e2", title: "Algebra exam", type: "exam", course_id: "c-alg" },
  { id: "e3", title: "Physics lab", type: "class", course_id: "c-phys" },
  { id: "e4", title: "Library study", type: "study", course_id: null },
  { id: "e5", title: "Renew passport", type: "personal", course_id: null },
];

const TASKS = [
  { id: "t1", title: "Problem set 4", status: "todo", course_id: "c-alg" },
  { id: "t2", title: "Lab report", status: "completed", course_id: "c-phys" },
  { id: "t3", title: "Reading", status: "in_progress", course_id: null },
];

describe("schedule filter schema contract", () => {
  it("exposes exactly the event types allowed by the schedule_events CHECK", () => {
    expect(EVENT_TYPES).toEqual(["class", "exam", "task", "study", "personal", "deadline"]);
  });

  it("exposes exactly the task statuses allowed by the tasks CHECK", () => {
    expect(TASK_STATUSES).toEqual(["todo", "in_progress", "completed"]);
  });
});

describe("courseCode / courseFilterOptions", () => {
  it("prefers the explicit code over the course name", () => {
    expect(courseCode(COURSES[0])).toBe("ALG");
  });

  it("falls back to the name when the course has no code", () => {
    expect(courseCode(COURSES[2])).toBe("History");
  });

  it("returns an empty string for a blank course", () => {
    expect(courseCode(COURSES[3])).toBe("");
    expect(courseCode(null)).toBe("");
  });

  it("builds sorted options and drops courses with no code and no name", () => {
    expect(courseFilterOptions(COURSES).map((o) => o.code)).toEqual(["ALG", "History", "PHY"]);
  });

  it("de-duplicates repeated course ids so one course cannot double up", () => {
    const opts = courseFilterOptions([COURSES[0], COURSES[0], { id: "c-alg", code: "ALG2", name: "x" }]);
    expect(opts).toHaveLength(1);
  });

  it("tolerates a missing course list", () => {
    expect(courseFilterOptions()).toEqual([]);
    expect(courseFilterOptions(null)).toEqual([]);
  });
});

describe("toggleValue / hasActiveFilters", () => {
  it("adds a value that is absent and removes one that is present", () => {
    expect(toggleValue([], "exam")).toEqual(["exam"]);
    expect(toggleValue(["exam", "class"], "exam")).toEqual(["class"]);
  });

  it("leaves the other facets alone when toggling", () => {
    expect(toggleValue(["class"], "exam")).toEqual(["class", "exam"]);
  });

  it("reports inactive for empty filters and active once a facet is set", () => {
    expect(hasActiveFilters(emptyFilters())).toBe(false);
    expect(hasActiveFilters({ courseIds: [], types: ["exam"], statuses: [] })).toBe(true);
    expect(hasActiveFilters({ courseIds: ["c-alg"], types: [], statuses: [] })).toBe(true);
    expect(hasActiveFilters({ courseIds: [], types: [], statuses: ["completed"] })).toBe(true);
  });
});

describe("filterEvents", () => {
  it("returns everything when no facet is set", () => {
    expect(filterEvents(EVENTS, emptyFilters())).toHaveLength(EVENTS.length);
  });

  it("filters by course id", () => {
    const out = filterEvents(EVENTS, { courseIds: ["c-alg"] });
    expect(out.map((e) => e.id)).toEqual(["e1", "e2"]);
  });

  it("hides course-less events once a course is selected", () => {
    const out = filterEvents(EVENTS, { courseIds: ["c-phys"] });
    expect(out.map((e) => e.id)).toEqual(["e3"]);
    expect(out.some((e) => e.id === "e4")).toBe(false);
  });

  it("keeps course-less events when no course facet is active", () => {
    const out = filterEvents(EVENTS, { types: ["personal"] });
    expect(out.map((e) => e.id)).toEqual(["e5"]);
  });

  it("filters by assignment type", () => {
    expect(filterEvents(EVENTS, { types: ["class"] }).map((e) => e.id)).toEqual(["e1", "e3"]);
    expect(filterEvents(EVENTS, { types: ["exam"] }).map((e) => e.id)).toEqual(["e2"]);
  });

  it("intersects course and type facets", () => {
    const out = filterEvents(EVENTS, { courseIds: ["c-alg"], types: ["exam"] });
    expect(out.map((e) => e.id)).toEqual(["e2"]);
  });

  it("ignores the completion facet, which events do not carry", () => {
    expect(filterEvents(EVENTS, { statuses: ["completed"] })).toHaveLength(EVENTS.length);
  });

  it("returns empty when the facets exclude everything", () => {
    expect(filterEvents(EVENTS, { types: ["deadline"] })).toEqual([]);
  });

  it("tolerates a missing event list", () => {
    expect(filterEvents(undefined, emptyFilters())).toEqual([]);
  });
});

describe("filterTasks", () => {
  it("returns everything when no facet is set", () => {
    expect(filterTasks(TASKS, emptyFilters())).toHaveLength(TASKS.length);
  });

  it("filters by completion state", () => {
    expect(filterTasks(TASKS, { statuses: ["completed"] }).map((t) => t.id)).toEqual(["t2"]);
    expect(filterTasks(TASKS, { statuses: ["todo", "in_progress"] }).map((t) => t.id)).toEqual(["t1", "t3"]);
  });

  it("filters by course id and hides course-less tasks", () => {
    expect(filterTasks(TASKS, { courseIds: ["c-alg"] }).map((t) => t.id)).toEqual(["t1"]);
  });

  it("ignores the event-type facet, which tasks do not carry", () => {
    expect(filterTasks(TASKS, { types: ["class"] })).toHaveLength(TASKS.length);
  });

  it("tolerates a missing task list", () => {
    expect(filterTasks(null, emptyFilters())).toEqual([]);
  });
});

describe("applyScheduleFilters", () => {
  it("never filters exams, so a deadline cannot be hidden", () => {
    const exams = [{ id: "x1", date: "2026-05-18" }];
    const out = applyScheduleFilters({ events: EVENTS, tasks: TASKS, exams }, { statuses: ["todo"] });
    expect(out.exams).toEqual(exams);
  });

  it("filters events and tasks together", () => {
    const out = applyScheduleFilters({ events: EVENTS, tasks: TASKS }, { courseIds: ["c-alg"] });
    expect(out.events.map((e) => e.id)).toEqual(["e1", "e2"]);
    expect(out.tasks.map((t) => t.id)).toEqual(["t1"]);
  });

  it("defaults every collection when called with no payload", () => {
    const out = applyScheduleFilters();
    expect(out).toEqual({ events: [], tasks: [], exams: [] });
  });
});

describe("ICS string parsing", () => {
  it("parses a VTIMEZONE-bearing feed and keeps the local clock", () => {
    const { events, warnings } = parseICS([
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "BEGIN:VEVENT",
      "UID:alg-1",
      "SUMMARY:Algebra",
      "DTSTART;TZID=Europe/Madrid:20260315T090000",
      "DTEND;TZID=Europe/Madrid:20260315T103000",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n"));
    expect(warnings).toEqual([]);
    expect(events).toHaveLength(1);
    expect(events[0].summary).toBe("Algebra");
  });

  it("reports malformed entries as warnings instead of throwing", () => {
    const { events, warnings } = parseICS("BEGIN:VEVENT\r\nSUMMARY:no uid no dtstart\r\nEND:VEVENT");
    expect(events).toEqual([]);
    expect(warnings.length).toBeGreaterThan(0);
  });

  it("returns empty on non-ICS garbage", () => {
    expect(parseICS("just some text").events).toEqual([]);
  });

  it("maps parsed occurrences onto schedule_events rows keyed by feed", () => {
    const { events } = parseICS("BEGIN:VEVENT\r\nUID:u9\r\nSUMMARY:Seminar\r\nDTSTART:20260402T140000Z\r\nDTEND:20260402T150000Z\r\nEND:VEVENT");
    const { rows } = toScheduleEventRows(events, "https://uni.example/feed.ics");
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe("Seminar");
  });

  it("updates: diffICS only creates occurrences not already stored", () => {
    const existing = [{ google_event_id: "ics:https://uni.example/feed.ics:u9-20260402" }];
    const { toCreate, skipped } = diffICS(existing, [
      { google_event_id: "ics:https://uni.example/feed.ics:u9-20260402" },
      { google_event_id: "ics:https://uni.example/feed.ics:u9-20260409" },
    ]);
    expect(skipped).toBe(1);
    expect(toCreate).toHaveLength(1);
    expect(toCreate[0].google_event_id).toContain("20260409");
  });
});

describe("recurrence + timezone expansion", () => {
  it("parses RRULE parts", () => {
    const r = parseRRULE("FREQ=WEEKLY;BYDAY=MO,WE;INTERVAL=2;COUNT=10");
    expect(r.freq).toBe("WEEKLY");
    expect(r.byday).toEqual(["MO", "WE"]);
    expect(r.interval).toBe(2);
    expect(r.count).toBe(10);
  });

  it("keeps floating local times unshifted while moving UTC to the local clock", () => {
    const { events } = parseICS([
      "BEGIN:VEVENT",
      "UID:utc-1",
      "SUMMARY:UTC lecture",
      "DTSTART:20260402T120000Z",
      "DTEND:20260402T130000Z",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "UID:float-1",
      "SUMMARY:Floating seminar",
      "DTSTART:20260402T120000",
      "DTEND:20260402T130000",
      "END:VEVENT",
    ].join("\r\n"));
    const utc = events.find((e) => e.uid === "utc-1");
    const floating = events.find((e) => e.uid === "float-1");
    expect(utc.start.toISOString()).toBe("2026-04-02T12:00:00.000Z");
    expect(floating.start.getHours()).toBe(12);
  });

  it("expands a COUNT-bounded weekly rule inside the window", () => {
    const { events } = parseICS([
      "BEGIN:VEVENT",
      "UID:rec-1",
      "SUMMARY:Weekly lab",
      "DTSTART:20260406T090000Z",
      "DTEND:20260406T110000Z",
      "RRULE:FREQ=WEEKLY;COUNT=4",
      "END:VEVENT",
    ].join("\r\n"));
    const out = expandICS(events, { from: new Date("2026-04-01T00:00:00Z"), to: new Date("2026-05-01T00:00:00Z") });
    expect(out.length).toBe(4);
  });
});

describe("conflict detection", () => {
  it("flags two events that overlap on the same day", () => {
    const found = detectConflicts([
      { title: "Lecture", date: "2026-03-15", start_time: "09:00", end_time: "11:00" },
      { title: "Lab", date: "2026-03-15", start_time: "10:30", end_time: "12:00" },
    ], "2026-03-15");
    expect(found.length).toBeGreaterThan(0);
  });

  it("returns nothing for back-to-back events that merely touch", () => {
    const found = detectConflicts([
      { title: "Lecture", date: "2026-03-15", start_time: "09:00", end_time: "10:00" },
      { title: "Lab", date: "2026-03-15", start_time: "10:00", end_time: "11:00" },
    ], "2026-03-15");
    expect(found).toEqual([]);
  });

  it("ignores events on another day", () => {
    const found = detectConflicts([
      { title: "Lecture", date: "2026-03-15", start_time: "09:00", end_time: "11:00" },
      { title: "Lab", date: "2026-03-16", start_time: "10:30", end_time: "12:00" },
    ], "2026-03-15");
    expect(found).toEqual([]);
  });
});
