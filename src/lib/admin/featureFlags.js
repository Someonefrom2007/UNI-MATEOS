// UNI·MATE Control Center — feature flags.
//
// Centralized, admin-managed feature control. A flag can be OFF/ON, limited to
// environments, restricted to a plan floor (or admins only), and rolled out to
// a deterministic percentage of users. Flags are NOT authorization: they never
// gate access to protected data and can never grant a permission. Enforcing
// plans/roles still happens in plans.js + the RLS/admin layer.

import { planTier, planOf, PLAN_TIERS } from "@/lib/plans";

// Canonical flags the app ships. Stored rows may add/remove keys freely.
export const DEFAULT_FLAGS = Object.freeze({
  community: { enabled: true, planFloor: "free", rolloutPct: 100, envs: [], description: "Community: posts, feeds, study groups" },
  ai_assistant: { enabled: true, planFloor: "pro", rolloutPct: 100, envs: [], description: "AI assistant edge function availability" },
  google_calendar: { enabled: true, planFloor: "free", rolloutPct: 100, envs: [], description: "Google Calendar sync connector" },
  google_drive: { enabled: true, planFloor: "pro", rolloutPct: 100, envs: [], description: "Google Drive sync connector" },
  advanced_planner: { enabled: true, planFloor: "pro", rolloutPct: 100, envs: [], description: "Rescue My Week + study planner" },
  experimental_analytics: { enabled: false, planFloor: "admins", rolloutPct: 100, envs: ["development", "preview"], description: "Experimental analytics features (admins only)" },
  new_dashboard: { enabled: true, planFloor: "free", rolloutPct: 100, envs: [], description: "New dashboard experience" },
});

export const PLAN_FLOORS = ["free", "pro", "ultimate", "admins"];

// FNV-1a — stable, dependency-free string hash for percentage rollouts.
export const hashPct = (key, id) => {
  let h = 0x811c9dc5;
  const s = `${String(key)}:${String(id) || ""}`;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return Math.abs(h) % 100;
};

/**
 * Normalize a stored (snake_case) flag row into the canonical shape.
 * @param {object} row
 * @returns {{ key: string, enabled: boolean, planFloor: string, rolloutPct: number, envs: string[], description: string }}
 */
export const normalizeFlag = (row = {}) => ({
  key: row.key,
  enabled: Boolean(row.enabled),
  planFloor: row.plan_floor || row.planFloor || "free",
  rolloutPct: Number(row.rollout_pct ?? row.rolloutPct ?? 100),
  envs: Array.isArray(row.envs) ? row.envs : [],
  description: row.description || "",
});

const planRankOf = (value) => (planTier(value) || PLAN_TIERS[0]).rank;

/**
 * Evaluate a flag for a context. Never throws; always returns an explicit reason.
 * @param {object} flag - normalized flag (see normalizeFlag)
 * @param {object} [ctx]
 * @param {string} [ctx.env]          - 'development' | 'preview' | 'production'
 * @param {string} [ctx.plan]         - the user's plan value
 * @param {string} [ctx.userId]       - used for deterministic percentage rollout
 * @param {boolean} [ctx.isAdmin]
 * @returns {{ enabled: boolean, reason: string }}
 */
export const evaluateFlag = (flag = {}, ctx = {}) => {
  if (!flag || typeof flag !== "object") return { enabled: false, reason: "missing" };
  if (!flag.enabled) return { enabled: false, reason: "disabled" };

  if (Array.isArray(flag.envs) && flag.envs.length > 0) {
    const env = ctx.env || "production";
    if (!flag.envs.includes(env)) {
      return { enabled: false, reason: `env:${env}` };
    }
  }

  const floor = flag.planFloor || "free";
  if (floor === "admins") {
    if (!ctx.isAdmin) return { enabled: false, reason: "admins_only" };
  } else if (planRankOf(floor) > 1) {
    if (planRankOf(ctx.plan) < planRankOf(floor)) {
      return { enabled: false, reason: `plan:${planOf(ctx.plan)}` };
    }
  }

  const pct = Number(flag.rolloutPct ?? 100);
  if (pct >= 100) return { enabled: true, reason: "on" };
  if (ctx.userId == null) return { enabled: false, reason: "rollout_no_user" };
  if (hashPct(flag.key, ctx.userId) < pct) return { enabled: true, reason: "rollout" };
  return { enabled: false, reason: "rollout" };
};

/**
 * Evaluate a whole flag set into a { key: { enabled, reason } } map.
 * @param {Array<object>} flags - stored rows (normalized inside)
 * @param {object} ctx
 * @returns {Record<string, { enabled: boolean, reason: string }>}
 */
export const featuresEnabled = (flags = [], ctx = {}) => {
  const out = {};
  (Array.isArray(flags) ? flags : []).forEach((row) => {
    const flag = typeof row.key !== "undefined" ? normalizeFlag(row) : { key: "unnamed", ...row };
    out[flag.key] = evaluateFlag(flag, ctx);
  });
  return out;
};

/**
 * Merge a flag definition into an array of flag rows (idempotent by key), so the
 * UI can switch a flag ON/OFF without worrying about create-vs-update.
 * @param {Array<object>} flags
 * @param {object} next - { key, enabled, planFloor, rolloutPct, envs, description }
 * @returns {Array<object>}
 */
export const upsertFlag = (flags = [], next = {}) => {
  const merged = { ...normalizeFlag(next), key: next.key };
  const i = (Array.isArray(flags) ? flags : []).findIndex((f) => f.key === merged.key);
  if (i >= 0) {
    const copy = flags.slice();
    copy.splice(i, 1, { ...normalizeFlag(copy[i]), ...merged });
    return copy;
  }
  return [...(Array.isArray(flags) ? flags : []), merged];
};

/**
 * Turn an upserted flag back into a writeable snake_case row.
 * @param {object} flag
 * @returns {object}
 */
export const flagRow = (flag = {}) => ({
  key: flag.key,
  enabled: Boolean(flag.enabled),
  plan_floor: flag.planFloor || "free",
  rollout_pct: Number(flag.rolloutPct ?? 100),
  envs: Array.isArray(flag.envs) ? flag.envs : [],
  description: flag.description || "",
});