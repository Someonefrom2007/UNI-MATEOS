// Focus session signals — consistent minutes math over saved session rows.
// Dates are ISO `YYYY-MM-DD` strings (local time, via todayISO), so range
// comparisons are plain string comparisons about a timezone-safe axis.

/** @typedef {{ id?: string, date?: string, duration?: number, course_id?: string, label?: string, created_at?: string }} FocusSessionRow */

const minutes = (s) => Math.max(0, Number(s?.duration) || 0);

/**
 * Total focus minutes recorded on a single day.
 * @param {FocusSessionRow[]} sessions
 * @param {string} dateStr
 * @returns {number}
 */
export const minutesOnDate = (sessions, dateStr) =>
  (sessions || []).reduce((sum, s) => sum + (String(s.date) === dateStr ? minutes(s) : 0), 0);

/**
 * Total focus minutes within an inclusive [from, to] day range.
 * @param {FocusSessionRow[]} sessions
 * @param {string} fromStr
 * @param {string} toStr
 * @returns {number}
 */
export const minutesInRange = (sessions, fromStr, toStr) =>
  (sessions || []).reduce(
    (sum, s) => sum + (String(s.date) >= fromStr && String(s.date) <= toStr ? minutes(s) : 0),
    0
  );

/**
 * Newest n sessions, newest first (date, then created_at as tiebreak).
 * @param {FocusSessionRow[]} sessions
 * @param {number} [n]
 * @returns {FocusSessionRow[]}
 */
export const recentSessions = (sessions, n = 5) =>
  [...(sessions || [])]
    .sort(
      (a, b) =>
        String(b.date || "").localeCompare(String(a.date || "")) ||
        String(b.created_at || "").localeCompare(String(a.created_at || ""))
    )
    .slice(0, n);