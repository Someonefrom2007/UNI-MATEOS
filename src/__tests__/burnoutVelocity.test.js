import { describe, it, expect } from "vitest";
import { last7Days, weeklyVelocity, classifyIntensity, burnoutScore } from "@/lib/burnout";
import { toLocalISO } from "@/lib/format";

const TODAY = "2026-07-15";

const dayOffset = (iso, offset) => {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + offset);
  return toLocalISO(d);
};

const focusSession = (date, duration, completed = true) => ({ date, duration, completed });
const doneTask = (completed_date) => ({ status: "completed", completed_date });

describe("burnout: 7-day rolling windows", () => {
  it("produces 7 consecutive local days ending on today", () => {
    const days = last7Days(TODAY);
    expect(days).toHaveLength(7);
    expect(days[6]).toBe(TODAY);
    expect(days[1]).toBe(dayOffset(TODAY, -5));
    expect(days[0]).toBe(dayOffset(TODAY, -6));
    expect(new Set(days).size).toBe(7);
  });

  it("aggregates focus minutes per day into weekly hours", () => {
    const v = weeklyVelocity({
      todayStr: TODAY,
      focusSessions: [
        focusSession(dayOffset(TODAY, -1), 90),
        focusSession(dayOffset(TODAY, -6), 30),
        focusSession(TODAY, 60),
      ],
    });
    expect(v.focusMinWeek).toBe(180);
    expect(v.focusHoursWeek).toBeCloseTo(3, 10);
    expect(v.focus[6]).toBe(60);
    expect(v.focus[0]).toBe(30);
  });

  it("counts completed tasks only on their completed_date", () => {
    const v = weeklyVelocity({
      todayStr: TODAY,
      tasks: [
        doneTask(dayOffset(TODAY, -2)),
        doneTask(dayOffset(TODAY, -1)),
        doneTask(dayOffset(TODAY, -1)),
        { status: "todo", completed_date: TODAY }, // not completed
      ],
    });
    expect(v.completionsWeek).toBe(3);
    expect(v.completions[5]).toBe(2);
  });

  it("ignores sessions and completions outside the window or unfinished", () => {
    const v = weeklyVelocity({
      todayStr: TODAY,
      focusSessions: [
        focusSession(dayOffset(TODAY, -7), 500), // yesterday of the window
        focusSession(TODAY, 120, false), // interrupted
        focusSession(dayOffset(TODAY, 3), 999), // future
      ],
      tasks: [doneTask(dayOffset(TODAY, -8))],
    });
    expect(v.focusMinWeek).toBe(0);
    expect(v.completionsWeek).toBe(0);
  });

  it("classifies intensity at exact boundaries", () => {
    expect(classifyIntensity(30, 0)).toBe("overdrive");
    expect(classifyIntensity(0, 25)).toBe("overdrive");
    expect(classifyIntensity(15, 12)).toBe("overdrive");
    expect(classifyIntensity(29, 11)).toBe("balanced");
    expect(classifyIntensity(7, 4)).toBe("low");
    expect(classifyIntensity(0, 0)).toBe("low");
  });

  it("scores the combined load 0–100 with caps", () => {
    expect(burnoutScore(30, 25)).toBe(100);
    expect(burnoutScore(0, 0)).toBe(0);
    expect(burnoutScore(15, 12.5)).toBe(50);
    expect(burnoutScore(60, 60)).toBe(100);
  });

  it("weeklyVelocity wires intensity + score to the window", () => {
    const v = weeklyVelocity({
      todayStr: TODAY,
      focusSessions: Array.from({ length: 5 }, (_, i) => focusSession(dayOffset(TODAY, -i), 180)),
      tasks: Array.from({ length: 12 }, () => doneTask(TODAY)),
    });
    expect(v.focusHoursWeek).toBeCloseTo(15, 10);
    expect(v.completionsWeek).toBe(12);
    expect(v.intensity).toBe("overdrive");
    expect(v.score).toBe(49);
  });

  it("keeps datetimes with time parts on the right day bucket", () => {
    const v = weeklyVelocity({
      todayStr: TODAY,
      focusSessions: [focusSession(`${TODAY}T14:30:00.000Z`, 45)],
      tasks: [doneTask(`${dayOffset(TODAY, -1)}T23:59:59.000Z`)],
    });
    expect(v.focus[6]).toBe(45);
    expect(v.completions[5]).toBe(1);
  });
});

describe("burnout: calendar-day helper (format integration)", () => {
  it("toLocalISO formats Date objects without UTC drift", () => {
    const d = new Date(2026, 6, 15, 12, 0, 0);
    expect(toLocalISO(d)).toBe("2026-07-15");
  });
});