// UNI·MATE Control Center — community moderation.
//
// Every moderation action goes through here so it produces (a) a valid content
// state transition and (b) an audit-friendly reason string. Content is hidden,
// not silently destroyed; removal keeps an audit record of who and why.

import { ROLES } from "@/lib/admin/permissions";
import { PERMISSIONS } from "@/lib/admin/permissions";

// community_reports.status CHECK: ('open','reviewed','dismissed')
export const REPORT_STATUS = Object.freeze(["open", "reviewed", "dismissed"]);

// Report state machine: open -> reviewed, open -> dismissed; both can reopen.
export const REPORT_TRANSITIONS = Object.freeze({
  open: ["reviewed", "dismissed"],
  reviewed: ["dismissed", "open"],
  dismissed: ["open", "reviewed"],
});

// Community content lifecycle (posts/replies): active -> hidden -> active,
// active -> removed; removed is terminal for a session.
export const CONTENT_TRANSITIONS = Object.freeze({
  active: ["hidden", "removed"],
  hidden: ["active", "removed"],
  removed: [],
});

/** Valid next status for a report, or [] when the move is not allowed. */
export const nextReportStatuses = (current) => REPORT_TRANSITIONS[current] || [];

/** Valid next status for content, or [] when the move is not allowed. */
export const nextContentStatuses = (current) => CONTENT_TRANSITIONS[current] || [];

/**
 * May this moderator perform the action on the target? Requires an admin role;
 * founder and super_admin additionally may remove content outright.
 */
export const canModerate = (principal = {}, action = "") => {
  if (!principal?.isAdmin) return false;
  if (action === "remove") return principal.role === ROLES.SUPER_ADMIN || principal.role === ROLES.FOUNDER || principal.isSuper === true;
  return true;
};

/**
 * Apply a moderation action to a report, returning { ok, status, reason }.
 * The reason doubles as the audit summary.
 * @param {object} report - { status }
 * @param {string} action - nextReportStatuses value
 * @param {object} [meta] - { admin, note } available for reason detail
 * @returns {{ ok: boolean, status?: string, reason?: string, error?: string }}
 */
export const moderateReport = (report = {}, action = "", meta = {}) => {
  const current = report.status || "open";
  if (!nextReportStatuses(current).includes(action)) {
    return { ok: false, error: `cannot move report from ${current} to ${action}` };
  }
  return {
    ok: true,
    status: action,
    reason: `report.${action}${meta.note ? `: ${meta.note}` : ""}`,
  };
};

/**
 * Apply a moderation action to a piece of community content (post/reply).
 * @param {{ status?: string }} content
 * @param {string} action - nextContentStatuses value
 * @param {object} [meta]
 * @returns {{ ok: boolean, status?: string, reason?: string, error?: string }}
 */
export const moderateContent = (content = {}, action = "", meta = {}) => {
  const current = content.status || "active";
  if (!nextContentStatuses(current).includes(action)) {
    return { ok: false, error: `cannot move content from ${current} to ${action}` };
  }
  return {
    ok: true,
    status: action,
    reason: `content.${action}${meta.note ? `: ${meta.note}` : ""}`,
  };
};

/** Blocked users set — merge/diff helpers (blocked user ids). */
export const toggleBlocked = (blocked = [], userId) =>
  blocked.includes(userId) ? blocked.filter((id) => id !== userId) : [...blocked, userId];

/** Moderation history entry shape (stored alongside in audit). */
export const historyEntry = ({ actor, action, targetType, targetId, reason, now = () => new Date().toISOString() }) => ({
  actor,
  action,
  target_type: targetType,
  target_id: targetId,
  reason,
  at: typeof now === "function" ? now() : now,
});