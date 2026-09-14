import { describe, it, expect } from "vitest";
import { detectConflicts, freeBlocks, durationMin, eventsForDate } from "@/lib/scheduleEngine";
import { urgentExamsWithin, pickFreeBlock, addMinutes } from "@/lib/planner";

const event = (over = {}) => ({
  id: "e",
  title: "Class",
  start_time: "09:00",
  end_time: "10:00",
  date: "2026-03-10",
  ...over,
});

const EXAM_TODAY = "2026-07-15";
const exam = (date, over = {}) => ({ id: "x", name: "Exam", course_id: "c1", weight: 60, date, ...over });

describe("smart scheduler: conflict resolution", () => {
  it("detects overlapping timed events on the same date", () => {
    const conflicts = detectConflicts(
      [
        event({ id: "a", start_time: "09:00", end_time: "10:30" }),
        event({ id: "b", start_time: "10:00", end_time: "11:00" }),
      ],
      "2026-03-10"
    );
    expect(conflicts).toHaveLength(1);
    expect([conflicts[0].a.id, conflicts[0].b.id].sort()).toEqual(["a", "b"]);
  });

  it("ignores perfectly adjacent events (end === start)", () => {
    const conflicts = detectConflicts(
      [event({ id: "a", start_time: "09:00", end_time: "10:00" }), event({ id: "b", start_time: "10:00", end_time: "11:00" })],
      "2026-03-10"
    );
    expect(conflicts).toHaveLength(0);
  });

  it("flags triple overlaps as all pairwise pairs", () => {
    const conflicts = detectConflicts(
      [event({ start_time: "09:00", end_time: "10:00" }), event({ start_time: "09:30", end_time: "10:30" }), event({ start_time: "09:45", end_time: "10:45" })],
      "2026-03-10"
    );
    expect(conflicts.length).toBeGreaterThanOrEqual(3);
  });

  it("does not compare events across different dates", () => {
    const conflicts = detectConflicts(
      [event({ start_time: "09:00", end_time: "10:00", date: "2026-03-10" }), event({ start_time: "09:30", end_time: "10:30", date: "2026-03-11" })],
      "2026-03-10"
    );
    expect(conflicts).toHaveLength(0);
  });
});

describe("smart scheduler: free block detection", () => {
  it("finds gaps around a single class", () => {
    const blocks = freeBlocks([event({ start_time: "10:00", end_time: "11:00" })], "2026-03-10");
    expect(blocks).toEqual([
      { start: "08:00", end: "10:00" },
      { start: "11:00", end: "20:00" },
    ]);
  });

  it("returns a single block on a fully open day", () => {
    const blocks = freeBlocks([], "2026-03-10");
    expect(blocks).toEqual([{ start: "08:00", end: "20:00" }]);
  });

  it("drops sub-30-minute gaps", () => {
    const blocks = freeBlocks([event({ start_time: "08:20", end_time: "08:45" })], "2026-03-10");
    expect(blocks.every((b) => durationMin(b.start, b.end) >= 30)).toBe(true);
  });

  it("handles back-to-back busy blocks without a spurious gap", () => {
    const blocks = freeBlocks(
      [event({ start_time: "09:00", end_time: "11:00" }), event({ start_time: "11:00", end_time: "13:00" })],
      "2026-03-10"
    );
    expect(blocks.map((b) => b.start)).not.toContain("11:00");
  });

  it("only counts events for the requested date including recurring classes", () => {
    const recurring = { id: "r", title: "Lab", day_of_week: 2, start_time: "14:00", end_time: "15:00", recurring: true };
    const monday = eventsForDate([recurring], "2026-03-09");
    const tuesday = eventsForDate([recurring], "2026-03-10");
    expect(monday).toHaveLength(0);
    expect(tuesday).toHaveLength(1);
    const blocks = freeBlocks([recurring], "2026-03-10");
    expect(blocks.some((b) => b.start === "15:00" && b.end === "20:00")).toBe(true);
  });
});

describe("smart scheduler: exam horizon filter", () => {
  it("keeps exams through the inclusive horizon and sorts soonest first", () => {
    const out = urgentExamsWithin(
      [exam("2026-07-18"), exam("2026-07-15"), exam("2026-07-17"), exam("2026-07-19")],
      { horizonDays: 3, todayStr: EXAM_TODAY }
    );
    expect(out.map((e) => e.date)).toEqual(["2026-07-15", "2026-07-17", "2026-07-18"]);
  });

  it("drops exams outside the window and un-dated rows", () => {
    const out = urgentExamsWithin([exam("2026-08-01"), exam(null)], { horizonDays: 3, todayStr: EXAM_TODAY });
    expect(out).toHaveLength(0);
  });

  it("honours a custom horizon number", () => {
    const out = urgentExamsWithin([exam("2026-07-16")], { horizonDays: 0, todayStr: EXAM_TODAY });
    expect(out).toHaveLength(0);
    const out2 = urgentExamsWithin([exam("2026-07-16")], { horizonDays: 1, todayStr: EXAM_TODAY });
    expect(out2).toHaveLength(1);
  });
});

describe("smart scheduler: block selection for study", () => {
  it("picks the first free block long enough and computes an end time", () => {
    const events = [event({ start_time: "09:00", end_time: "10:00" }), event({ start_time: "14:00", end_time: "15:00" })];
    const block = pickFreeBlock(events, "2026-03-10", 60);
    expect(block).toEqual({ start: "08:00", end: "09:00" });
    expect(addMinutes(block.start, 60)).toBe("09:00");
  });

  it("returns null when no block is long enough (full day booked)", () => {
    const events = [event({ start_time: "08:00", end_time: "20:00" })];
    expect(pickFreeBlock(events, "2026-03-10", 120)).toBeNull();
  });

  it("addMinutes rolls past noon/midnight boundaries", () => {
    expect(addMinutes("20:30", 60)).toBe("21:30");
    expect(addMinutes("11:50", 20)).toBe("12:10");
  });

  it("integration: auto-schedule fills available slots across study days", () => {
    const examDate = "2026-07-17";
    const urgent = urgentExamsWithin([exam(examDate)], { horizonDays: 3, todayStr: EXAM_TODAY });
    expect(urgent).toHaveLength(1);
    const studyDays = 2;
    const blockMin = 60;
    const eventsByDay = {
      "2026-07-16": [event({ date: "2026-07-16", start_time: "09:00", end_time: "12:00" })],
      "2026-07-17": [],
    };
    let scheduled = 0;
    for (const e of urgent) {
      for (let i = 0; i < studyDays; i++) {
        const d = new Date(examDate + "T00:00:00");
        d.setDate(d.getDate() - i);
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        const block = pickFreeBlock(eventsByDay[dateStr] || [], dateStr, blockMin);
        if (block) scheduled++;
      }
    }
    expect(scheduled).toBe(2);
  });
});