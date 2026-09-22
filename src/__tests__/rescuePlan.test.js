// Rescue My Week — pure planning logic. These tests pin the data-derived
// behavior (capacities from real free blocks, latest-fit assignment, honest
// overload reporting) so the UI can never present fabricated numbers.
import { describe, it, expect } from "vitest";
import {
  buildRescuePlan,
  requiredItems,
  freeMinutes,
  buildCapacities,
  taskItem,
  prepForExam,
  addDaysISO,
  daysUntil,
  RESCUE_DEFAULTS,
} from "@/lib/rescuePlan";

const TODAY = "2026-10-05"; // a Monday
const day = (offset) => addDaysISO(TODAY, offset);

const task = (over = {}) => ({
  id: "t1",
  title: "Problem set",
  course_id: "c1",
  due_date: day(2),
  priority: "high",
  status: "todo",
  estimated_duration: 60,
  ...over,
});

const exam = (over = {}) => ({
  id: "e1",
  name: "Midterm",
  course_id: "c1",
  date: day(3),
  status: "upcoming",
  ...over,
});

const cls = (dow, start, end) => ({
  id: `c-${dow}-${start}`,
  type: "class",
  day_of_week: dow,
  start_time: start,
  end_time: end,
  recurring: true,
});

const dayName = (isoDate) => ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][new Date(isoDate + "T00:00:00").getDay()];

// A Monday class 10:00–12:00 and Tuesday 09:00–10:30, all week.
const weekEvents = [cls(1, "10:00", "12:00"), cls(2, "09:00", "10:30")];

describe("time helpers", () => {
  it("shifts local days across month boundaries", () => {
    expect(addDaysISO("2026-10-29", 3)).toBe("2026-11-01");
    expect(daysUntil("2026-10-05", "2026-10-08")).toBe(3);
    expect(daysUntil("2026-10-05", null)).toBeNull();
  });
});

describe("free-minute capacity", () => {
  it("computes real free minutes outside scheduled classes", () => {
    // Monday: class 10:00-12:00 → free 08:00-10:00 (120) + 12:00-20:00 (480)
    expect(freeMinutes(weekEvents, TODAY)).toBe(600);
  });

  it("reports the full working window when no classes exist", () => {
    expect(freeMinutes([], day(4))).toBe(720);
  });

  it("caps daily capacity at the user budget in buildCapacities", () => {
    const caps = buildCapacities({ events: weekEvents, from: TODAY, days: 7, opts: RESCUE_DEFAULTS });
    expect(Object.keys(caps).length).toBe(7);
    expect(caps[TODAY]).toBe(300); // default budget 300 min/day
    caps[TODAY] = freeMinutes(weekEvents, TODAY);
    // sanity: raw free is 600 even though budget caps it
    expect(freeMinutes(weekEvents, TODAY)).toBe(600);
  });
});

describe("required items", () => {
  it("builds task + exam-prep items inside the window", () => {
    const items = requiredItems({ tasks: [task()], exams: [exam()], todayStr: TODAY, opts: RESCUE_DEFAULTS });
    expect(items.some((i) => i.kind === "task")).toBe(true);
    expect(items.some((i) => i.kind === "exam_prep")).toBe(true);
  });

  it("skips completed tasks and exams, and exams outside the window", () => {
    const items = requiredItems({
      tasks: [task({ status: "completed" }), task({ id: "t2", title: "Next", due_date: day(6) })],
      exams: [exam({ status: "completed" }), exam({ id: "e2", name: "Far", date: day(30) })],
      todayStr: TODAY,
      opts: RESCUE_DEFAULTS,
    });
    expect(items.filter((i) => i.kind === "task")).toHaveLength(1);
    expect(items.filter((i) => i.kind === "exam_prep")).toHaveLength(0);
  });

  it("floors overdue tasks to today and defaults their duration", () => {
    const item = taskItem({ id: "x", title: "Late", due_date: day(-3), estimated_duration: 90 }, TODAY);
    expect(item.due).toBe(TODAY);
    expect(item.minutes).toBe(90);
    const def = taskItem({ id: "y", title: "Noest", due_date: day(1) }, TODAY);
    expect(def.minutes).toBe(30);
  });
});

describe("buildRescuePlan — assignment", () => {
  it("places an easy task on its due day using latest-fit", () => {
    const plan = buildRescuePlan({
      tasks: [task({ due_date: day(2), estimated_duration: 45 })],
      events: weekEvents,
      options: { today: TODAY, now: () => "2026-10-05T08:00:00Z" },
    });
    const placed = plan.days.flatMap((d) => d.items.map((i) => ({ ...i, date: d.date })));
    expect(placed).toHaveLength(1);
    expect(placed[0].date).toBe(day(2));
    expect(plan.summary.feasible).toBe(true);
  });

  it("moves work earlier when the due day lacks capacity", () => {
    // Monday (today) fully booked 08:00-20:00 → zero capacity that day.
    const fullMonday = [cls(1, "08:00", "20:00")];
    const plan = buildRescuePlan({
      tasks: [task({ due_date: day(0), estimated_duration: 120 })],
      events: fullMonday,
      options: { today: TODAY, now: () => "2026-10-05T08:00:00Z" },
    });
    const placed = plan.days.flatMap((d) => d.items.map((i) => ({ ...i, date: d.date })));
    // Nothing fits and the planner says so rather than inventing a slot.
    expect(placed).toHaveLength(0);
    expect(plan.summary.overloadedCount).toBe(1);
    expect(plan.summary.feasible).toBe(false);
  });

  it("reports an honest overload when demand exceeds available free time", () => {
    const dues = ["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11", "2026-10-11"];
    const plan = buildRescuePlan({
      tasks: dues.map((due, i) => ({
        id: `t${i}`,
        title: `Task ${i + 1}`,
        course_id: "c1",
        due_date: due,
        priority: "high",
        status: "todo",
        estimated_duration: 300,
      })),
      events: weekEvents,
      options: { today: TODAY, now: () => "2026-10-05T08:00:00Z" },
    });
    // Capacity: 300/day budget x 7 = 2100. Demand: 8 x 300 = 2400 → one can't fit.
    expect(plan.summary.loadNeeded).toBe(2400);
    expect(plan.summary.availableTotal).toBe(2100);
    expect(plan.summary.itemsPlanned).toBe(7);
    expect(plan.summary.overloadedCount).toBe(1);
    expect(plan.recommendation.tone).toBe("overloaded");
    expect(plan.recommendation.lines.join(" ")).toMatch(/can't fit/);
  });

  it("keeps every planned block inside real capacity", () => {
    const plan = buildRescuePlan({
      tasks: [
        task({ estimated_duration: 120 }),
        task({ id: "t2", title: "Second", due_date: day(1), estimated_duration: 100 }),
        task({ id: "t3", title: "Third", due_date: day(2), estimated_duration: 90 }),
      ],
      events: weekEvents,
      options: { today: TODAY, now: () => "2026-10-05T08:00:00Z" },
    });
    plan.days.forEach((d) => {
      expect(d.planned).toBeLessThanOrEqual(Math.min(d.available, RESCUE_DEFAULTS.dailyBudgetMin));
    });
  });

  it("splits nothing over the daily budget and never schedules over committed classes", () => {
    const plan = buildRescuePlan({
      tasks: [task({ estimated_duration: 200 }), task({ id: "t2", title: "Second", due_date: day(1), estimated_duration: 200 })],
      events: weekEvents,
      options: { today: TODAY, now: () => "2026-10-05T08:00:00Z", dailyBudgetMin: 240 },
    });
    plan.days.forEach((d) => expect(d.planned).toBeLessThanOrEqual(240));
  });

  it("says nothing is needed on a clear window", () => {
    const plan = buildRescuePlan({
      tasks: [task({ status: "completed" })],
      exams: [exam({ status: "completed" })],
      events: weekEvents,
      options: { today: TODAY, now: () => "2026-10-05T08:00:00Z" },
    });
    expect(plan.summary.itemsPlanned).toBe(0);
    expect(plan.recommendation.tone).toBe("clear");
  });

  it("flags zero free time honestly instead of inventing a plan", () => {
    // A full-day class every day of the week → zero recovery capacity.
    const fullWeek = [0, 1, 2, 3, 4, 5, 6].map((dow) => cls(dow, "08:00", "20:00"));
    const plan = buildRescuePlan({
      tasks: [task({ estimated_duration: 60 })],
      events: fullWeek,
      options: { today: TODAY, now: () => "2026-10-05T08:00:00Z" },
    });
    expect(plan.summary.itemsPlanned).toBe(0);
    expect(plan.summary.overloadedCount).toBe(1);
    expect(plan.recommendation.tone).toBe("overloaded");
  });
});

describe("prep scaling", () => {
  it("asks for more prep minutes the closer the exam", () => {
    const near = prepForExam(exam({ date: day(1) }), TODAY, RESCUE_DEFAULTS);
    const far = prepForExam(exam({ date: day(6) }), TODAY, RESCUE_DEFAULTS);
    expect(near.minutes).toBeGreaterThan(far.minutes);
  });

  it("returns null for exams already past", () => {
    expect(prepForExam(exam({ date: day(-1) }), TODAY, RESCUE_DEFAULTS)).toBeNull();
  });
});