// Habit consistency signals — the numbers behind "consistency compounds".
// Pure string-based day arithmetic (ISO `YYYY-MM-DD`) so streaks and weekly
// tallies never drift across timezones: the UI passes a local day string
// (e.g. `todayISO()`) and every boundary is computed on strings.
import { todayISO } from "@/lib/format";

const pad = (n) => String(n).padStart(2, "0");

const parse = (s) => {
  const [y, m, d] = String(s).split("-").map(Number);
  return new Date(y, m - 1, d);
};

const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/**
 * Day string exactly n days before a given day string.
 * @param {string} dateStr
 * @param {number} [days]
 * @returns {string}
 */
export const prevDayStr = (dateStr, days = 1) => {
  const d = parse(dateStr);
  d.setDate(d.getDate() - days);
  return fmt(d);
};

/**
 * The last n day strings, oldest first, ending with todayStr.
 * @param {number} n
 * @param {string} [todayStr]
 * @returns {string[]}
 */
export const lastNDayStrings = (n, todayStr = todayISO()) => {
  if (!(n > 0)) return [];
  const end = parse(todayStr);
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setDate(end.getDate() - i);
    out.push(fmt(d));
  }
  return out;
};

/**
 * Current streak for one habit: consecutive completed days ending today, or
 * ending yesterday (still "alive" until the day is over).
 * @param {Array<{habit_id: string, date: string, completed: boolean}>} logs
 * @param {string} habitId
 * @param {string} [todayStr]
 * @returns {number}
 */
export const habitStreak = (logs, habitId, todayStr = todayISO()) => {
  const done = new Set(
    (logs || [])
      .filter((l) => String(l.habit_id) === habitId && l.completed === true)
      .map((l) => String(l.date))
  );
  let cur = todayStr;
  if (!done.has(cur)) {
    cur = prevDayStr(cur);
    if (!done.has(cur)) return 0;
  }
  let streak = 0;
  while (done.has(cur)) {
    streak += 1;
    cur = prevDayStr(cur);
  }
  return streak;
};

/**
 * How many of the given day strings a habit was completed on.
 * @param {Array<{habit_id: string, date: string, completed: boolean}>} logs
 * @param {string} habitId
 * @param {string[]} dayStrings
 * @returns {number}
 */
export const habitWeekDone = (logs, habitId, dayStrings) => {
  const done = new Set(
    (logs || [])
      .filter((l) => String(l.habit_id) === habitId && l.completed === true)
      .map((l) => String(l.date))
  );
  return dayStrings.filter((d) => done.has(String(d))).length;
};