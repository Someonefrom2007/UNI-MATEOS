// Plan entitlement engine — tiers, feature flags and upgrade math. Pure and
// injectable; the single source of truth for "is this feature allowed on this
// plan?" across the app (page gates, edge-function guards, Plans UI).

export const PLAN_TIERS = Object.freeze([
  { value: "free", rank: 1, label: "Free", tag: "Organize me" },
  { value: "pro", rank: 2, label: "Pro", tag: "Help me" },
  { value: "ultra", rank: 3, label: "Ultra", tag: "Work with me" },
]);

// Each PRO/ULTRA feature maps to the minimum tier that unlocks it. Gating is
// rank-based so a tier inherits every feature of the tiers below it.
export const PLAN_FEATURES = Object.freeze({
  ai_assistant: "pro",
  flashcards: "pro",
  smart_planning: "pro",
  exam_intelligence: "pro",
  advanced_analytics: "pro",
  study_groups: "ultra",
  university_integrations: "ultra",
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
 * Tier descriptor for a plan value, or null when unknown.
 * @param {string} value
 * @returns {{value: string, rank: number, label: string, tag: string}|null}
 */
export const planTier = (value) => PLAN_TIERS.find((t) => t.value === String(value).toLowerCase()) || null;

/**
 * Numeric rank of a plan (free 1, pro 2, ultra 3); unknown values rank as free.
 * @param {string} value
 * @returns {number}
 */
export const planRank = (value) => (planTier(value) || PLAN_TIERS[0]).rank;

/**
 * Normalize a plan value — accepts a plan string or a profile-ish object with a
 * `.plan` field and always returns a valid tier value ("free" | "pro" | "ultra").
 * @param {string|object|null|undefined} profile
 * @returns {string}
 */
export const planOf = (profile) => {
  const raw = typeof profile === "string" ? profile : profile?.plan;
  return (planTier(raw) || PLAN_TIERS[0]).value;
};

/**
 * Whether the plan is paid (pro or ultra).
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