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