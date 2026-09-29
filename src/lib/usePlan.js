// Plan tier hook — the app-side entitlement surface.
//
// SECURITY: the plan is READ-ONLY here. It used to be writable from the client
// via `supabase.auth.updateUser({ data: { plan } })`, which writes to
// `user_metadata` — a field any authenticated user can write to their own
// account. Because the `ai-assistant` edge function authorized on exactly that
// field, any user could self-upgrade to Pro/Ultimate with one console call.
//
// The authoritative source is now the server:
//   - hosted  -> `subscriptions.tier`, read through the `lemon-squeezy` edge
//                function. That table has RLS with SELECT-own and NO client
//                INSERT/UPDATE policy; only the service-role webhook writes it.
//   - local   -> the on-device profile, which is a demo sandbox and grants
//                nothing on any server.
//
// Nothing in this module can raise a hosted user's tier. Upgrades only happen
// through a real, webhook-confirmed subscription.
import { useCallback } from "react";
import { isLocalWorkspace, loadLocalProfile, saveLocalProfile } from "@/lib/repo/select";
import { useSubscription } from "@/lib/billing/useSubscription";
import { planOf, planTier, can as canFeature, isPremium as isPaid } from "@/lib/plans";

// Local/demo sandbox defaults to Ultimate so every Pro/Ultimate feature is
// explorable offline. This is device-local and carries no server entitlement.
const LOCAL_DEFAULT_PLAN = "ultimate";

export const usePlan = () => {
  const local = isLocalWorkspace();
  // Server-resolved on hosted; already handles the local sandbox internally.
  const { plan: serverPlan, loading, configured } = useSubscription();

  const localPlan = (() => {
    if (!local) return undefined;
    const raw = (loadLocalProfile() || {}).plan;
    return planOf(raw == null ? LOCAL_DEFAULT_PLAN : raw);
  })();

  // Local workspace takes precedence so the demo never waits on a network
  // round trip; hosted trusts whatever the server last reported.
  const plan = local ? localPlan : planOf(serverPlan);

  const setPlan = useCallback(
    async (next) => {
      if (!local) {
        // Deliberate hard stop. A hosted plan is a billing outcome, not a
        // client preference — the only way to change it is a real checkout.
        throw new Error(
          "Plan changes are not available on the hosted app — upgrade through billing."
        );
      }
      const value = planOf(next);
      const profile = loadLocalProfile() || {};
      saveLocalProfile({ ...profile, plan: value });
      return value;
    },
    [local]
  );

  return {
    plan,
    tier: planTier(plan),
    can: (feature) => canFeature(plan, feature),
    isPremium: isPaid(plan),
    setPlan,
    /** True while the hosted entitlement is still being resolved. */
    loading: local ? false : Boolean(loading),
    /** False on hosted until billing is configured — gates upgrade affordances. */
    billingConfigured: local ? true : Boolean(configured),
    /** Local plans are a demo sandbox; never treat them as real entitlement. */
    simulated: local,
    defaultPlan: local ? LOCAL_DEFAULT_PLAN : "free",
  };
};
