// UNI·MATE Control Center — user lifecycle management.
//
// Suspension/restore/disable/delete are modeled as a small state machine. There
// is deliberately NO one-click destructive path: deletion requires the operator
// to type a confirmation phrase, and `deleteConsequences` is shown before any
// write. Suspension/restore never delete data.

export const ACCOUNT_STATUS = Object.freeze(["active", "suspended", "disabled"]);

// Lifecycle:
//   active <-> suspended ; active -> disabled ; suspended -> disabled ; disabled -> active
export const ACCOUNT_TRANSITIONS = Object.freeze({
  active: ["suspended", "disabled"],
  suspended: ["active", "disabled"],
  disabled: ["active"],
});

export const ACTION_PHRASES = Object.freeze({
  SUSPEND: "SUSPEND USER",
  RESTORE: "RESTORE USER",
  DISABLE: "DISABLE USER",
  DELETE: "DELETE USER",
});

/** Apply an account status change. */
export const transitionAccount = (row = {}, next = "") => {
  const current = row.status || "active";
  if (!(ACCOUNT_TRANSITIONS[current] || []).includes(next)) {
    return { ok: false, error: `cannot move account from ${current} to ${next}` };
  }
  return { ok: true, row: { ...row, status: next }, reason: `account.${next}` };
};

/**
 * Pure preview of what deleting a user would remove, per content table.
 * Counts come from REAL data (the caller supplies them); this only formats and
 * totals them. Deletion is a hard operation — always shown, never implied.
 * @param {object} counts - { Table: n, ... } across the user's content tables
 * @returns {{ total: number, counts: Array<{ table: string, count: number }>, phrase: string }}
 */
export const deleteConsequences = (counts = {}) => {
  const rows = Object.entries(counts)
    .filter(([table, n]) => Number(n) > 0)
    .map(([table, n]) => ({ table, count: Number(n) }))
    .sort((a, b) => b.count - a.count);
  return { total: rows.reduce((s, r) => s + r.count, 0), counts: rows, phrase: ACTION_PHRASES.DELETE };
};

/**
 * Protective gate for destructive/sensitive actions: the operator must type an
 * exact phrase. Returns ok only on an exact (case-sensitive) match.
 * @param {string} typed
 * @param {string} required
 * @returns {boolean}
 */
export const confirmPhrase = (typed = "", required = "") => typed === required;

/**
 * Build the row write for a status transition via the app repository.
 * @param {{ repo: object }} deps
 * @param {string} userId
 * @param {string} next - ACCOUNT_STATUS value
 * @returns {Promise<{ ok: boolean, row: object|null, error?: unknown }>}
 */
export const applyStatus = async ({ repo }, userId, next) => {
  if (!repo) return { ok: false, row: null, error: "no repo" };
  const existing = (await repo.list("User")).find((u) => String(u.id) === String(userId));
  const from = existing?.status || "active";
  if (!(ACCOUNT_TRANSITIONS[from] || []).includes(next)) {
    return { ok: false, row: null, error: `cannot move account from ${from} to ${next}` };
  }
  try {
    const row = await repo.update("User", userId, { status: next });
    return { ok: Boolean(row), row: row || { ...existing, status: next }, error: undefined };
  } catch (e) {
    return { ok: false, row: null, error: e };
  }
};