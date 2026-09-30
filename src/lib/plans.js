// Plan entitlement engine — tiers, feature flags and upgrade math. Pure and
// injectable; the single source of truth for "is this feature allowed on this
// plan?" across the app (page gates, edge-function guards, Plans UI).

export const PLAN_TIERS = Object.freeze([
  { value: "free", rank: 1, label: "Free", tag: "Organize" },
  { value: "pro", rank: 2, label: "Pro", tag: "Understand" },
  { value: "ultimate", rank: 3, label: "Ultimate", tag: "Connect" },
]);

// Pre-2.0 profiles persisted the top tier as "ultra" (and, before that, as
// uppercase). Normalize every legacy spelling to the canonical value so no
// stored plan is silently downgraded to Free.
const LEGACY_ALIASES = { ultra: "ultimate" };

// Each PRO/ULTRA feature maps to the minimum tier that unlocks it. Gating is
// rank-based so a tier inherits every feature of the tiers below it.
export const PLAN_FEATURES = Object.freeze({
  ai_assistant: "pro",
  flashcards: "pro",
  smart_planning: "pro",
  exam_intelligence: "pro",
  advanced_analytics: "pro",
  study_groups: "ultimate",
  university_integrations: "ultimate",
});

export const FEATURE_LABELS = Object.freeze({
  ai_assistant: "AI Assistant",
  flashcards: "Flashcards & quizzes",
  smart_planning: "Smart study planning",
  exam_intelligence: "Exam intelligence",
  advanced_analytics: "Advanced analytics",
  study_groups: "Study groups & collaboration",
  university_integrations: "University integrations",
});

/**
 * Tier descriptor for a plan value, or null when unknown. Legacy spellings
 * ("ultra", "ULTRA", …) normalize to their canonical value.
 * @param {string} value
 * @returns {{value: string, rank: number, label: string, tag: string}|null}
 */
export const planTier = (value) => {
  const raw = String(value || "").toLowerCase();
  const canonical = LEGACY_ALIASES[raw] || raw;
  return PLAN_TIERS.find((t) => t.value === canonical) || null;
};

/**
 * Numeric rank of a plan (free 1, pro 2, ultimate 3); unknown values rank as free.
 * @param {string} value
 * @returns {number}
 */
export const planRank = (value) => (planTier(value) || PLAN_TIERS[0]).rank;

/**
 * Normalize a plan value — accepts a plan string or a profile-ish object with a
 * `.plan` field and always returns a valid tier value
 * ("free" | "pro" | "ultimate").
 * @param {string|object|null|undefined} profile
 * @returns {string}
 */
export const planOf = (profile) => {
  const raw = typeof profile === "string" ? profile : profile?.plan;
  return (planTier(raw) || PLAN_TIERS[0]).value;
};

/**
 * Whether the plan is paid (pro or ultimate).
 * @param {string} value
 * @returns {boolean}
 */
export const isPremium = (value) => planRank(value) >= planTier("pro").rank;

/**
 * Feature gate — true when the profile's plan unlocks the feature. Unknown
 * features default to unlocked so new capabilities never break old profiles.
 * @param {string|object|null|undefined} profileOrPlan
 * @param {string} feature
 * @returns {boolean}
 */
export const can = (profileOrPlan, feature) => {
  const needed = PLAN_FEATURES[feature];
  if (!needed) return true;
  return planRank(planOf(profileOrPlan)) >= planTier(needed).rank;
};

/**
 * Minimum tier value required to unlock a feature ("free" when unlisted).
 * @param {string} feature
 * @returns {string}
 */
export const neededTier = (feature) => PLAN_FEATURES[feature] || "free";

/**
 * Next paid tier above the given plan, or null when already on the highest.
 * @param {string} value
 * @returns {{value: string, rank: number, label: string, tag: string}|null}
 */
export const upgradeTo = (value) => PLAN_TIERS.find((t) => t.rank > planRank(value)) || null;

/**
 * Nearest tier below the given plan, or null when already free.
 * @param {string} value
 * @returns {{value: string, rank: number, label: string, tag: string}|null}
 */
export const downgradeTo = (value) => [...PLAN_TIERS].reverse().find((t) => t.rank < planRank(value)) || null;

/**
 * The plan to run feature gates against — which is NOT always the plan the
 * customer actually bought.
 *
 * Staff hold an enabled `admin_accounts` row rather than a subscription, and
 * Postgres has always counted that as paid: `has_paid_entitlement()` is
 * `is_admin() OR <live subscription>`. Gating a staff member on their billing
 * plan would therefore paywall someone the database already serves, so the
 * client follows the server's `entitled` answer instead.
 *
 * The floor is "ultimate" because the pro/ultimate split is a UI concept the
 * database does not implement: has_paid_entitlement() is boolean, and every paid
 * table carries the same own-row policies regardless of tier, so an entitled
 * staff member can already read and write exactly the rows an Ultimate
 * subscriber can. Flooring at "pro" would show a lock the API never enforced,
 * and would hide paid surfaces from the account that most needs to exercise
 * them. Nothing here fabricates a purchase — the billing plan is returned
 * untouched for the Plans/Profile UI.
 *
 * Not a security boundary: RLS and has_paid_entitlement() remain authoritative,
 * and `entitled` is server-owned, never client-set.
 *
 * @param {string|object|null|undefined} profileOrPlan billing plan
 * @param {boolean} entitled server-decided paid access
 * @returns {string} canonical tier value: "free", "pro" or "ultimate"
 */
export const gatePlanFor = (profileOrPlan, entitled) => {
  const plan = planOf(profileOrPlan);
  return entitled && !isPremium(plan) ? "ultimate" : plan;
};