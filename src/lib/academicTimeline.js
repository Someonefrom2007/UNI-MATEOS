// Academic Timeline — a semester-level, week-by-week view of the term. The
// term window is derived strictly from real data: the academic-year window
// (Sep 1 – Aug 31) that the user's real rows fall into, clamped to the
// earliest and latest real dates among exams, task deadlines and scheduled
// events. No week is ever fabricated — only weeks that contain at least one
// real dated item (or the current week) are emitted. Pure + node-safe.
import { toLocalISO } from "@/lib/format";

export const DAY_MS = 86400000;

/** Academic year key ("2025") for a date — the September-start year. Months
 * May..Aug belong to the year that began the prior September, so they carry
 * that academic year (N-1); Sep..Dec carry calendar year N. */
export const academicYearKey = (iso) => {
  const d = new Date(iso + "T00:00:00");
  const y = d.getFullYear();
  return d.getMonth() >= 8 ? y : y - 1;
};

/** Academic-year window start for the year containing `iso` (Sep 1). */
export const academicYearStart = (iso) => `${academicYearKey(iso)}-09-01`;

/** Academic-year window end for the year containing `iso` (Aug 31). */
export const academicYearEnd = (iso) => `${academicYearKey(iso) + 1}-08-31`;

export const addDays = (iso, n) => {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return toLocalISO(d);
};

/** ISO date of the Monday beginning the week that contains `iso`. */
export const weekStartOf = (iso) => {
  const d = new Date(iso + "T00:00:00");
  const back = d.getDay() === 0 ? 6 : d.getDay() - 1;
  d.setDate(d.getDate() - back);
  return toLocalISO(d);
};

/** ISO date of the Sunday ending the week that contains `iso` (start + 6). */
export const weekEndOf = (iso) => addDays(weekStartOf(iso), 6);

/** Week label, e.g. "Sep 1 – Sep 7". */
export const weekLabel = (startISO, endISO) => {
  const fmt = (iso) => {
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };
  return `${fmt(startISO)} – ${fmt(endISO)}`;
};

const isoNow = (d = new Date()) => toLocalISO(d);

/**
 * Build the week buckets for the term. `items` is an array of { iso, ... }
 * dated rows; the window = [earliest real date, latest real date] clamped to
 * the academic-year window that contains today, and the current week is always
 * included so the "this week" marker stays honest. Returns
 * [{ start, end, label, isCurrent, isFuture, isPast }].
 */
export const buildWeeks = ({ items, nowISO = isoNow() }) => {
  if (!items || items.length === 0) return [];
  const dates = items.map((i) => i.iso).filter(Boolean);
  if (dates.length === 0) return [];
  const min = dates.reduce((a, b) => (a < b ? a : b));
  const max = dates.reduce((a, b) => (a > b ? a : b));
  const winStart = academicYearStart(nowISO);
  const winEnd = academicYearEnd(nowISO);
  const start = min < winStart ? winStart : min;
  const end = max > winEnd ? winEnd : max;
  const weeks = [];
  let cur = weekStartOf(start);
  const endWeek = weekStartOf(end);
  while (cur <= endWeek) {
    const s = cur;
    const e = weekEndOf(s);
    const isCurrent = nowISO >= s && nowISO <= e;
    weeks.push({
      start: s,
      end: e,
      label: weekLabel(s, e),
      isCurrent,
      isFuture: s > nowISO,
      isPast: e < nowISO,
    });
    cur = addDays(e, 1);
  }
  return weeks;
};
