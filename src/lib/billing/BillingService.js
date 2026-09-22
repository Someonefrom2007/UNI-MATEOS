// BillingService — provider-independent billing abstraction.
//
// UNI·MATE never talks to a payment provider directly from the UI. The only
// billing surface the app knows about is this service interface:
//
//   startCheckout(tier) -> { checkoutUrl }      begin an upgrade
//   manage()            -> { portalUrl | null } manage a subscription
//   status()            -> { configured, subscription, plan }
//
// Each provider (currently Lemon Squeezy only) implements this contract behind
// a server-side edge function. No Stripe, no provider SDKs in the client, no
// client-side trust of plan values — the edge function is the source of truth.
//
// Pure & injectable: tests can substitute a fake provider.

/**
 * @typedef {{
 *   configured: boolean,
 *   subscription?: {
 *     id?: string,
 *     status?: string,
 *     plan?: string,
 *     renews_at?: string,
 *     cancel_at_period_end?: boolean,
 *     customer_id?: string,
 *   } | null,
 *   plan?: string,
 *   legacy_tiers?: string[],
 * }} BillingStatus
 */

/**
 * Typed billing error. `code` distinguishes honest causes for the UI:
 *   "BILLING_UNCONFIGURED" — provider has no credentials on this deployment.
 *   "BILLING_LOCAL"        — called from the local workspace demo.
 *   "BILLING_UNAVAILABLE"  — network/function failure.
 */
export class BillingError extends Error {
  /**
   * @param {string} message
   * @param {string} [code]
   */
  constructor(message, code) {
    super(message);
    this.name = "BillingError";
    this.code = code || "BILLING_ERROR";
  }
}

/**
 * The provider contract every billing backend must satisfy.
 * @typedef {object} BillingProvider
 * @property {string} name
 * @property {boolean} [configured]
 * @property {(tier: string) => Promise<{checkoutUrl: string}>} startCheckout
 * @property {() => Promise<{portalUrl: string | null}>} manage
 * @property {() => Promise<BillingStatus>} status
 */

class BillingService {
  /**
   * @param {BillingProvider} provider
   */
  constructor(provider) {
    this.provider = provider;
  }

  get configured() {
    return Boolean(this.provider && this.provider.configured);
  }

  /** Whether the service is ready, i.e. a provider is attached. */
  get ready() {
    return Boolean(this.provider);
  }

  /**
   * Begin a checkout for a given tier ("pro" | "ultimate").
   * @param {string} tier
   * @returns {Promise<{checkoutUrl: string}>}
   */
  async startCheckout(tier) {
    if (!this.provider) throw new Error("No billing provider configured");
    return this.provider.startCheckout(tier);
  }

  /**
   * Open the customer's subscription management surface (portal/update link),
   * or null when the provider exposes none.
   * @returns {Promise<{portalUrl: string | null}>}
   */
  async manage() {
    if (!this.provider) return { portalUrl: null };
    return this.provider.manage();
  }

  /**
   * Current billing status — configured flag, the subscription row (if any)
   * and the resulting entitlement plan.
   * @returns {Promise<BillingStatus>}
   */
  async status() {
    if (!this.provider) {
      return { configured: false, subscription: null, plan: "free" };
    }
    return this.provider.status();
  }
}

export default BillingService;