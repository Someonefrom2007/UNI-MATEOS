import { describe, it, expect } from "vitest";
import {
  buildRescuePlan,
  collectWork,
  examPrepMinutes,
  taskWorkMinutes,
  daysOut,
  planDays,
  sittingsFor,
} from "@/lib/rescuePlan";

// A Monday, so the week window is stable.
const TODAY = "2026-03-09";

const task = (over = {}) => ({
  id: "t1",
  title: "Essay",
  status: "todo",
  priority: "medium",
  due_date: "2026-03-11",
  estimated_duration: 60,
  course_id: "c1",
  ...over,
});

const exam = (over = {}) => ({
  id: "e1",
  name: "Midterm",
  date: "2026-03-12",
  status: "upcoming",
  weight: 30,
  course_id: "c1",
  topics: [],
  ...over,
});

const klass = (dow, start, end, over = {}) => ({
  id: `ev-${dow}-${start}`,
  title: "Class",
  type: "class",
  day_of_week: dow,
  start_time: start,
  end_time: end,
  recurring: true,
  ...over,
});

describe("rescuePlan: work estimation", () => {
  it("uses the task's own estimate, with a sane floor", () => {
    expect(taskWorkMinutes({ estimated_duration: 90 })).toBe(90);
    expect(taskWorkMinutes({ estimated_duration: 0 })).toBe(30);
    expect(taskWorkMinutes({})).toBe(30);
    expect(taskWorkMinutes({ estimated_duration: 3 })).toBe(15);
  });

  it("estimates exam prep from topic mastery and agrees with the workload engine", () => {
    // Full mastery means nothing left to do.
    expect(examPrepMinutes({ topics: [{ mastery: 100, reviewed: true }] })).toBe(0);
    // No topics at all is treated as "the whole thing is left".
    expect(examPrepMinutes({ topics: [] })).toBe(180);
    // Half mastery leaves half of the cap.
    expect(examPrepMinutes({ topics: [{ mastery: 50 }, { mastery: 50 }] })).toBe(90);
    // A tiny gap still needs a real sitting.
    expect(examPrepMinutes({ topics: [{ mastery: 99 }] })).toBe(60);
    // Completed exams need nothing.
    expect(examPrepMinutes({ status: "completed", topics: [] })).toBe(0);
  });

  it("counts days out and handles a missing date", () => {
    expect(daysOut("2026-03-10", TODAY)).toBe(1);
    expect(daysOut("2026-03-09", TODAY)).toBe(0);
    expect(daysOut("2026-03-08", TODAY)).toBe(-1);
    expect(daysOut(null, TODAY)).toBeNull();
  });

  it("builds a contiguous horizon", () => {
    const days = planDays(TODAY, 3);
    expect(days).toEqual(["2026-03-09", "2026-03-10", "2026-03-11"]);
  });
});

describe("rescuePlan: sitting sizes", () => {
  it("returns nothing for no work", () => {
    expect(sittingsFor(0)).toEqual([]);
    expect(sittingsFor(-5)).toEqual([]);
  });

  it("keeps a short task as one sitting, never below the minimum", () => {
    expect(sittingsFor(30)).toEqual([30]);
    expect(sittingsFor(45)).toEqual([45]);
    expect(sittingsFor(5)).toEqual([15]);
  });

  it("caps a long task at the maximum sitting length", () => {
    expect(sittingsFor(120)).toEqual([120]);
    expect(sittingsFor(121)).toEqual([61, 60]);
    expect(sittingsFor(240)).toEqual([120, 120]);
  });

  it("balances uneven totals instead of leaving a sliver", () => {
    // The bug this guards: a 6-minute remainder session.
    expect(sittingsFor(121)).toEqual([61, 60]);
    expect(sittingsFor(200)).toEqual([100, 100]);
    expect(sittingsFor(250)).toEqual([84, 83, 83]);
    expect(sittingsFor(601).every((s) => s >= 100)).toBe(true);
  });

  it("always sums back to the original work", () => {
    [7, 15, 60, 119, 120, 121, 240, 250, 601, 1000].forEach((m) => {
      const sum = sittingsFor(m).reduce((s, x) => s + x, 0);
      expect(sum).toBe(Math.max(m, 15));
    });
  });

  it("never exceeds the maximum and never drops below the minimum", () => {
    for (let m = 15; m <= 600; m += 7) {
      sittingsFor(m).forEach((s) => {
        expect(s).toBeLessThanOrEqual(120);
        expect(s).toBeGreaterThanOrEqual(15);
      });
    }
  });
});

describe("rescuePlan: collecting work", () => {
  it("skips completed and undated tasks", () => {
    const items = collectWork({
      tasks: [
        task({ id: "a" }),
        task({ id: "b", status: "completed" }),
        task({ id: "c", due_date: null }),
      ],
      todayStr: TODAY,
    });
    expect(items.map((i) => i.refId)).toEqual(["a"]);
  });

  it("plans exam prep up to the day before the exam", () => {
    const items = collectWork({ exams: [exam()], todayStr: TODAY });
    expect(items).toHaveLength(1);
    expect(items[0].lastDay).toBe("2026-03-11");
    expect(items[0].deadline).toBe("2026-03-12");
  });

  it("orders by deadline, then priority, then size", () => {
    const items = collectWork({
      tasks: [
        task({ id: "later", due_date: "2026-03-12", priority: "urgent" }),
        task({ id: "soon-low", due_date: "2026-03-10", priority: "low" }),
        task({ id: "soon-high", due_date: "2026-03-10", priority: "high" }),
        task({ id: "soon-high-big", due_date: "2026-03-10", priority: "high", estimated_duration: 300 }),
      ],
      todayStr: TODAY,
    });
    expect(items.map((i) => i.refId)).toEqual(["soon-high-big", "soon-high", "soon-low", "later"]);
  });

  it("ranks an exam above a task sharing its deadline", () => {
    const items = collectWork({
      tasks: [task({ id: "t", due_date: "2026-03-12" })],
      exams: [exam({ date: "2026-03-12" })],
      todayStr: TODAY,
    });
    expect(items[0].kind).toBe("exam");
  });
});

describe("rescuePlan: building the plan", () => {
  it("never books a session over a class", () => {
    // Classes every weekday 09:00–11:00 and 14:00–16:00.
    const events = [1, 2, 3, 4, 5].flatMap((dow) => [
      klass(dow, "09:00", "11:00"),
      klass(dow, "14:00", "16:00"),
    ]);
    const plan = buildRescuePlan({
      tasks: [task({ due_date: "2026-03-13", estimated_duration: 600 })],
      events,
      todayStr: TODAY,
      days: 5,
    });
    expect(plan.sessions.length).toBeGreaterThan(0);
    plan.sessions.forEach((s) => {
      events.forEach((e) => {
        if (e.day_of_week !== new Date(s.date + "T00:00:00").getDay()) return;
        const overlaps = s.start < e.end_time && e.start_time < s.end;
        expect(overlaps).toBe(false);
      });
    });
  });

  it("places work before its deadline and never after", () => {
    const plan = buildRescuePlan({
      tasks: [task({ due_date: "2026-03-11", estimated_duration: 120 })],
      todayStr: TODAY,
      days: 7,
    });
    plan.sessions.forEach((s) => expect(s.date <= "2026-03-11").toBe(true));
  });

  it("splits long work into sittings rather than one marathon block", () => {
    const plan = buildRescuePlan({
      tasks: [task({ due_date: "2026-03-15", estimated_duration: 300 })],
      todayStr: TODAY,
      days: 7,
    });
    expect(plan.sessions.length).toBeGreaterThan(1);
    plan.sessions.forEach((s) => expect(s.minutes).toBeLessThanOrEqual(120));
  });

  it("never proposes a session shorter than the minimum", () => {
    const plan = buildRescuePlan({
      tasks: [task({ due_date: "2026-03-15", estimated_duration: 30 })],
      todayStr: TODAY,
      days: 7,
    });
    plan.sessions.forEach((s) => expect(s.minutes).toBeGreaterThanOrEqual(15));
  });

  it("plans overdue work from today instead of giving up on it", () => {
    const plan = buildRescuePlan({
      tasks: [task({ due_date: "2026-03-01", estimated_duration: 60 })],
      todayStr: TODAY,
      days: 7,
    });
    expect(plan.sessions.length).toBeGreaterThan(0);
    expect(plan.sessions.every((s) => s.overdue)).toBe(true);
    expect(plan.sessions.every((s) => s.date === TODAY)).toBe(true);
  });

  it("reports work it cannot place, with the shortfall, instead of dropping it", () => {
    // One tiny free block, far more work than fits.
    const plan = buildRescuePlan({
      tasks: [task({ due_date: "2026-03-09", estimated_duration: 600 })],
      events: [
        klass(1, "08:00", "11:55"),
        klass(1, "12:05", "20:00"),
      ],
      todayStr: TODAY,
      days: 1,
    });
    expect(plan.unplaced.length).toBe(1);
    expect(plan.unplaced[0].remaining).toBeGreaterThan(0);
    expect(plan.placedTotal + plan.unplaced[0].remaining).toBe(600);
  });

  it("flags an overloaded week and says so, rather than silently truncating", () => {
    const plan = buildRescuePlan({
      tasks: [task({ due_date: "2026-03-09", estimated_duration: 5000 })],
      todayStr: TODAY,
      days: 1,
    });
    expect(plan.overloaded).toBe(true);
  });

  it("suggests a concrete deadline extension for unplaced work", () => {
    const plan = buildRescuePlan({
      tasks: [task({ due_date: "2026-03-09", estimated_duration: 900 })],
      events: [klass(1, "08:00", "19:00")],
      todayStr: TODAY,
      days: 3,
    });
    expect(plan.deferrals.length).toBeGreaterThan(0);
    const d = plan.deferrals[0];
    expect(d.extendByDays).toBeGreaterThan(0);
    expect(d.suggestedDeadline > d.deadline).toBe(true);
  });

  it("places everything when there is ample room, leaving no unplaced work", () => {
    const plan = buildRescuePlan({
      tasks: [task({ due_date: "2026-03-14", estimated_duration: 120 })],
      todayStr: TODAY,
      days: 7,
    });
    expect(plan.unplaced).toHaveLength(0);
    expect(plan.placedTotal).toBe(120);
    expect(plan.overloaded).toBe(false);
  });

  it("uses the first free block of the day rather than wasting it", () => {
    // A single 60-minute gap at 08:00 and nothing else scheduled.
    const plan = buildRescuePlan({
      tasks: [task({ due_date: "2026-03-14", estimated_duration: 60 })],
      todayStr: TODAY,
      days: 7,
    });
    // The earliest session must start at the start of the day's free time.
    const earliest = plan.sessions.reduce(
      (best, s) => (s.date < best.date || (s.date === best.date && s.start < best.start) ? s : best),
      plan.sessions[0],
    );
    expect(earliest.start).toBe("08:00");
    expect(earliest.minutes).toBe(60);
  });

  it("places nothing below the minimum sitting length", () => {
    const plan = buildRescuePlan({
      tasks: [task({ due_date: "2026-03-14", estimated_duration: 130 })],
      todayStr: TODAY,
      days: 7,
    });
    plan.sessions.forEach((s) => expect(s.minutes).toBeGreaterThanOrEqual(15));
  });

  it("returns sessions in chronological order", () => {
    const plan = buildRescuePlan({
      tasks: [
        task({ id: "a", due_date: "2026-03-10", estimated_duration: 120 }),
        task({ id: "b", due_date: "2026-03-14", estimated_duration: 180 }),
      ],
      todayStr: TODAY,
      days: 7,
    });
    const keys = plan.sessions.map((s) => `${s.date} ${s.start}`);
    expect(keys).toEqual([...keys].sort());
  });

  it("reports an honest empty state when there is no work", () => {
    const plan = buildRescuePlan({ todayStr: TODAY, days: 7 });
    expect(plan.hasWork).toBe(false);
    expect(plan.sessions).toHaveLength(0);
    expect(plan.demandTotal).toBe(0);
  });

  it("reserves headroom instead of booking every free minute", () => {
    const wide = buildRescuePlan({
      tasks: [task({ due_date: "2026-03-09", estimated_duration: 10000 })],
      todayStr: TODAY,
      days: 1,
      fillRatio: 0.8,
    });
    const full = buildRescuePlan({
      tasks: [task({ due_date: "2026-03-09", estimated_duration: 10000 })],
      todayStr: TODAY,
      days: 1,
      fillRatio: 1,
    });
    expect(wide.capacityTotal).toBeLessThan(full.capacityTotal);
  });

  it("gives every session a real title and a course link when the work has one", () => {
    const plan = buildRescuePlan({
      tasks: [task({ title: "Lab report", course_id: "c9", due_date: "2026-03-14" })],
      exams: [exam({ name: "Final", course_id: "c9", date: "2026-03-14" })],
      courses: [{ id: "c9", name: "Physics" }],
      todayStr: TODAY,
      days: 7,
    });
    expect(plan.sessions.every((s) => s.title && s.title.length > 0)).toBe(true);
    expect(plan.sessions.every((s) => s.courseId === "c9")).toBe(true);
    expect(plan.sessions.some((s) => s.title.startsWith("Study: "))).toBe(true);
    expect(plan.courseById.c9.name).toBe("Physics");
  });

  it("keeps start and end times consistent with the session length", () => {
    const plan = buildRescuePlan({
      tasks: [task({ due_date: "2026-03-15", estimated_duration: 240 })],
      todayStr: TODAY,
      days: 7,
    });
    plan.sessions.forEach((s) => {
      const [sh, sm] = s.start.split(":").map(Number);
      const [eh, em] = s.end.split(":").map(Number);
      expect(eh * 60 + em - (sh * 60 + sm)).toBe(s.minutes);
    });
  });
});
