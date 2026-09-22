// Lemon Squeezy billing provider — the only BillingProvider implementation.
//
// Every network interaction goes through the server-side `lemon-squeezy` Edge
// Function, which holds the API key, validates the request, creates checkouts
// and verifies webhook signatures. The client only ever sees a neutral
// response ({ checkoutUrl }, { configured }, …) — secret configuration never
// touches the browser, and no NEXT_PUBLIC_*/VITE_* billing variable exists.
//
// When the deployment has no Lemon Squeezy environment configured the edge
// function answers { configured: false } and this provider reports exactly
// that — the UI shows "Coming soon" instead of a fake checkout.

import { supabase } from "@/lib/supabase";
import { isLocalWorkspace } from "@/lib/repo/select";
import { planOf } from "@/lib/plans";
import BillingService, { BillingError } from "./BillingService.js";

const FUNCTION = "lemon-squeezy";

const invoke = async (payload) => {
  const { data, error } = await supabase.functions.invoke(FUNCTION, {
    body: payload,
    headers: { "x-client-info": "unimate-billing" },
  });
  if (error) {
    throw new BillingError(error.message || "Billing service unavailable", "BILLING_UNAVAILABLE");
  }
  return data || {};
};

const name = "lemon-squeezy";

export const LemonSqueezyBillingProvider = {
  name,

  /** Checkout for a tier. Throws with an honest message when unconfigured. */
  async startCheckout(tier) {
    if (isLocalWorkspace()) throw new BillingError("Billing is not available in the local workspace", "BILLING_LOCAL");
    const normalized = planOf(tier);
    if (normalized === "free") {
      throw new BillingError("Free has no checkout — it's already yours.", "BILLING_FREE_TIER");
    }
    const res = await invoke({ action: "checkout", tier: normalized });
    if (!res.configured) {
      throw new BillingError("Lemon Squeezy isn't configured for this deployment yet.", "BILLING_UNCONFIGURED");
    }
    if (!res.checkoutUrl) {
      throw new BillingError("Could not create the checkout. Please try again.", "BILLING_CHECKOUT_FAILED");
    }
    return { checkoutUrl: res.checkoutUrl };
  },

  async manage() {
    if (isLocalWorkspace()) return { portalUrl: null };
    const res = await invoke({ action: "manage" });
    return { portalUrl: (res && res.portalUrl) || null };
  },

  async status() {
    if (isLocalWorkspace()) {
      return { configured: false, subscription: null, plan: "free" };
    }
    try {
      const res = await invoke({ action: "status" });
      return {
        configured: Boolean(res && res.configured),
        subscription: (res && res.subscription) || null,
        plan: (res && res.plan) || "free",
      };
    } catch {
      return { configured: false, subscription: null, plan: "free" };
    }
  },
};

// Provider-independent facade used across the app. Swapping in another
// provider later is a one-line change here.
let singleton = null;
export const getBillingService = () => {
  if (!singleton) singleton = new BillingService(LemonSqueezyBillingProvider);
  return singleton;
};