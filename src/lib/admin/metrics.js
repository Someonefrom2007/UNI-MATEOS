// UNI·MATE Control Center — analytics / product usage.
//
// Pure aggregation over REAL rows. Every function takes plain arrays and returns
// plain numbers; nothing is invented. If a data source does not exist (e.g. AI
// request logs), the caller reports "no telemetry" instead of a guessed number.

const EMPTY = {};

const num = (v) => Number(v) || 0;

const iso = (v) => String(v || "").slice(0, 10);

const asArray = (rows) => (Array.isArray(rows) ? rows : []);

/**
 * Daily buckets over rows that carry a timestamp/date field.
 * @param {Array<object>} rows
 * @param {string} [dateField='created_at']
 * @param {number} [days=14]
 * @returns {Array<{ date: string, count: number }>} oldest → newest
 */
export const countsByDay = (rows = [], dateField = "created_at", days = 14) => {
  const buckets = {};
  const today = iso(new Date().toISOString());
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    buckets[iso(d.toISOString())] = 0;
  }
  asArray(rows).forEach((r) => {
    const d = iso(r[dateField]);
    if (d && d <= today && d in buckets) buckets[d] += 1;
  });
  return Object.entries(buckets).map(([date, count]) => ({ date, count }));
};

/**
 * Total rows per entity. AI has no table today — pass a null array and it is
 * reported as null (meaning "no telemetry"), never as 0 pretending.
 * @param {Record<string, Array<object>|null|undefined>} tables
 * @returns {Record<string, number|null>}
 */
export const totals = (tables = {}) => {
  const out = {};
  Object.entries(tables).forEach(([name, rows]) => {
    out[name] = rows == null ? null : asArray(rows).length;
  });
  return out;
};

/**
 * Plan distribution from user rows (read `plan` or user_metadata.plan).
 * @param {Array<object>} users
 * @returns {Record<'free'|'pro'|'ultimate', number>}
 */
export const planDistribution = (users = []) => {
  const out = { free: 0, pro: 0, ultimate: 0 };
  asArray(users).forEach((u) => {
    const plan = (u.plan || u.user_metadata?.plan || "free").toLowerCase();
    if (plan === "pro") out.pro += 1;
    else if (plan === "ultimate" || plan === "ultra") out.ultimate += 1;
    else out.free += 1;
  });
  return out;
};

/**
 * Sum a numeric field across rows (e.g. focus minutes).
 * @param {Array<object>} rows
 * @param {string} field
 * @returns {number}
 */
export const sumField = (rows = [], field) =>
  asArray(rows).reduce((sum, r) => sum + num(r[field]), 0);

/**
 * Rank feature usage deltas as plain { label, count } pairs — for the bar list.
 * Only includes entities actually measured (rows != null).
 * @param {object} counts  - output of totals()
 * @param {Record<string,string>} labels
 * @returns {Array<{ label: string, count: number }>} sorted desc
 */
export const usageBars = (counts = {}, labels = {}) =>
  Object.entries(counts)
    .filter(([, n]) => n != null)
    .map(([key, n]) => ({ label: labels[key] || key, count: num(n) }))
    .sort((a, b) => b.count - a.count);

/** New users in the last N days (from user rows with created_at). */
export const newUsers = (users = [], days = 7) =>
  countsByDay(users, "created_at", days).reduce((s, b) => s + b.count, 0);

/** Users with activity since a cutoff (caller supplies lastActivityAt per user). */
export const activeUsers = (users = [], { since, activityField = "last_active_at" } = {}) => {
  if (!since) return null;
  const cutoff = new Date(since).getTime();
  return asArray(users).filter((u) => {
    const at = u[activityField] || u.last_active_at;
    return at && new Date(at).getTime() >= cutoff;
  }).length;
};

/** Onboarding completion: users carrying an onboarding flag/field set. */
export const onboarding = (users = [], { field = "onboarded" } = {}) => {
  const done = asArray(users).filter((u) => Boolean(u[field]) || u.onboarded_at || u.onboarding_completed).length;
  return { completed: done, total: asArray(users).length };
};