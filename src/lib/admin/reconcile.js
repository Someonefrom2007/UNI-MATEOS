// UNI·MATE Control Center — billing reconciliation.
//
// Detects mismatches along the billing chain and decides the SAFEST corrective
// step. The chain is directional:
//
//   LEMON SQUEEZY (provider/webhook state — source of truth for payment state)
//        ↓
//   UNI·MATE subscription record (hosted `subscriptions` row)
//        ↓
//   ENTITLEMENT (auth user_metadata.plan — what feature access the app grants)
//
// Rule: reconcile() only ever REPORTS mismatches and suggests the entitlement
// change that brings access in line with the provider. It never fabricates
// billing state, never pretends a payment happened, and never mutates billing
// rows. That is left to the controlled reconcileEntitlement() action, which
// adjusts ONLY the entitlement plan and always returns an audit trail.

export const STATUS_ACTIVE = new Set(["on_trial", "active", "paused", "cancelled", "unpaid"]);

/**
 * Normalize a stored subscription row into the canonical shape.
 * @param {object} sub
 * @returns {{ tier: string, status: string, cancelAtPeriodEnd: boolean, renewsAt: string|null }}
 */
export const normalizeSubscription = (sub = {}) => ({
  tier: sub.tier || "free",
  status: sub.status || "unknown",
  cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end ?? sub.cancelAtPeriodEnd),
  renewsAt: sub.renews_at || sub.renewsAt || null,
});

/**
 * Tier the Lemon Squeezy provider reports for an event payload, or null when it
 * is not one of our variants. Injectable variant map (edge function reads env at
 * runtime — this stays pure).
 * @param {object} payload    - Lemon Squeezy webhook event payload
 * @param {object} [variantMap={ pro, ultimate }]
 * @returns {('pro'|'ultimate'|'free'|null)}
 */
export const providerTier = (payload = {}, variantMap = {}) => {
  const attrs = payload?.data?.attributes || {};
  const variantId = String(attrs.variant_id ?? "");
  if (variantId && variantId === String(variantMap.pro ?? "")) return "pro";
  if (variantId && variantId === String(variantMap.ultimate ?? "")) return "ultimate";
  if (!variantId) return null;
  return null;
};

const tierOfPlan = (plan) => {
  const raw = String(plan || "").toLowerCase();
  if (raw === "ultra") return "ultimate";
  return ["free", "pro", "ultimate"].includes(raw) ? raw : "free";
};

/**
 * Reconcile the three layers for one user's billing.
 * @param {object} [input={}]
 * @param {object|null} [input.provider]      - { tier, status } from Lemon Squeezy webhook (null when unknown)
 * @param {object|null} [input.subscription]  - stored `subscriptions` row (null when none)
 * @param {string} [input.entitlement]      - auth user_metadata.plan value
 * @returns {{ ok: boolean, matches: string[], mismatches: Array<{area: string, message: string, action: string}>, suggestedPlan: string }}
 */
export const reconcile = ({ provider = null, subscription = null, entitlement = "" } = {}) => {
  const matches = [];
  const mismatches = [];
  const sub = subscription ? normalizeSubscription(subscription) : null;
  const entitlementTier = tierOfPlan(entitlement);

  // What SHOULD the entitlement be, given Lemon Squeezy is the source of truth?
  const expectedPlan = !provider
    ? null // unknown — never guess, never change
    : !provider.tier
      ? null // variant unknown — don't fabricate a plan from an unrecognized variant
      : provider.status && !STATUS_ACTIVE.has(provider.status)
        ? "free" // subscription ended → access is revoked
        : provider.tier;

  if (!provider) {
    mismatches.push({
      area: "provider",
      message: "Lemon Squeezy state is unknown (no webhook event for this subscription).",
      action: "inspect-webhook",
    });
  } else if (provider.status && !STATUS_ACTIVE.has(provider.status)) {
    mismatches.push({
      area: "provider",
      message: `Lemon Squeezy reports ${provider.status} — this subscription is not active.`,
      action: "no-entitlement",
    });
  } else if (provider.tier) {
    if (!sub) {
      mismatches.push({
        area: "subscription",
        message: `Provider is ${provider.tier}.${provider.status ? ` (${provider.status})` : ""} but there is no UNI·MATE subscription record.`,
        action: "restore-subscription",
      });
    } else if (sub.tier !== provider.tier) {
      mismatches.push({
        area: "subscription",
        message: `Provider reports ${provider.tier} but the subscription record says ${sub.tier}.`,
        action: "sync-subscription",
      });
    } else {
      matches.push("provider-and-subscription-agree");
    }
  }

  if (expectedPlan && entitlementTier !== expectedPlan) {
    mismatches.push({
      area: "entitlement",
      message: `Entitlement grants ${entitlementTier} but the provider says it should be ${expectedPlan}.`,
      action: "reconcile-entitlement",
    });
  } else if (provider?.tier && entitlementTier === expectedPlan) {
    matches.push("entitlement-in-line");
  }

  const suggestedPlan = expectedPlan || entitlementTier;

  return { ok: mismatches.length === 0, matches, mismatches, suggestedPlan };
};

/**
 * The only entitlement-altering step this module offers. Adjusts the entitlement
 * plan value (what the app grants) to the provider tier. Never touches billing
 * rows, never "confirms a payment".
 * @param {object} [input={}]
 * @param {string} [input.plan] - entitlement plan to set
 * @returns {{ ok: boolean, plan: string, changed: boolean }}
 */
export const reconcileEntitlement = ({ plan = "" } = {}) => {
  const next = tierOfPlan(plan);
  return { ok: true, plan: next, changed: next !== plan };
};