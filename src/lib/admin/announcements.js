// UNI·MATE Control Center — announcements.
//
// Operational messaging to users. Announcements carry severity, an audience
// (all / a plan floor / admins only), and an optional active window. This module
// decides who sees what and manages the lifecycle — the actual persistence goes
// through the "Announcements" repo table (RLS: authenticated read, admin write).

export const SEVERITIES = Object.freeze(["info", "notice", "maintenance", "important"]);
export const AUDIENCES = Object.freeze(["all", "free", "pro", "ultimate", "admins"]);

const planRank = (p) => (p === "ultimate" ? 3 : p === "pro" ? 2 : 1);

/**
 * Does an announcement currently apply to a context?
 * @param {object} ann - { audience, startAt/start_at, endAt/end_at }
 * @param {object} ctx - { now, plan, isAdmin }
 * @returns {boolean}
 */
export const isActive = (ann = {}, ctx = {}) => {
  const now = ctx.now || new Date().toISOString();
  const start = ann.start_at || ann.startAt;
  const end = ann.end_at || ann.endAt;
  if (start && now < start) return false;
  if (end && now > end) return false;
  return true;
};

/**
 * Does the audience include this user context? Admins never receive
 * admin-only broad announcements leaking internal detail; audience=admins means
 * console staff.
 * @param {object} ann - { audience }
 * @param {object} ctx - { plan, isAdmin }
 * @returns {boolean}
 */
export const audienceMatches = (ann = {}, ctx = {}) => {
  const audience = ann.audience || "all";
  if (audience === "all") return true;
  if (audience === "admins") return Boolean(ctx.isAdmin);
  return planRank(String(ctx.plan || "free").toLowerCase()) >= planRank(audience);
};

/** Announcements for a context: active + audience-matched, severity/start sorted. */
export const activeFor = (announcements = [], ctx = {}) =>
  (Array.isArray(announcements) ? announcements : [])
    .filter((a) => isActive(a, ctx) && audienceMatches(a, ctx))
    .sort((a, b) => {
      const s = SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity);
      if (s !== 0) return -s;
      return String(b.start_at || b.created_at || "").localeCompare(String(a.start_at || a.created_at || ""));
    });

/** Normalize an announcement row for the console editor. */
export const normalizeAnnouncement = (a = {}) => ({
  id: a.id,
  title: a.title,
  body: a.body || "",
  severity: SEVERITIES.includes(a.severity) ? a.severity : "info",
  audience: AUDIENCES.includes(a.audience) ? a.audience : "all",
  startAt: a.start_at || a.startAt || "",
  endAt: a.end_at || a.endAt || "",
});

/** Build a writeable row from editor values. */
export const announcementRow = (a = {}) => ({
  title: a.title,
  body: a.body || "",
  severity: a.severity || "info",
  audience: a.audience || "all",
  start_at: a.startAt || null,
  end_at: a.endAt || null,
});

/** Validation before persisting: title required; window ordering enforced. */
export const validateAnnouncement = (a = {}) => {
  const errors = [];
  if (!a.title || !String(a.title).trim()) errors.push("title");
  if (a.startAt && a.endAt && a.endAt < a.startAt) errors.push("window");
  return { ok: errors.length === 0, errors };
};