// Smart academic scheduler helpers — exam horizon filtering and free-block
// selection on top of the pinned scheduleEngine. Pure and unit-testable.
import { toLocalISO } from "@/lib/format";
import { freeBlocks, durationMin } from "@/lib/scheduleEngine";

// Exams on or before the horizon (inclusive), sorted soonest first.
/**
 * @param {Array<object>} exams
 * @param {{ horizonDays?: number, todayStr?: string }} [opts]
 */
export const urgentExamsWithin = (exams = [], { horizonDays = 3, todayStr } = {}) => {
  const base = todayStr ? new Date(todayStr + "T00:00:00") : new Date();
  base.setHours(0, 0, 0, 0);
  const horizon = new Date(base);
  horizon.setDate(horizon.getDate() + horizonDays);
  const horizonStr = toLocalISO(horizon);
  return exams
    .filter((e) => e.date && e.date <= horizonStr)
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""));
};

// First free block on a date long enough for the requested study minutes.
export const pickFreeBlock = (events = [], dateStr, blockMin) => {
  const free = freeBlocks(events, dateStr);
  return free.find((b) => durationMin(b.start, b.end) >= blockMin) || null;
};

// Wall-clock end "HH:MM" for a "HH:MM" start plus minutes (handles overflow).
export const addMinutes = (start, minutes) => {
  const [h, m] = start.split(":").map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};