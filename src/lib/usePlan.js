// Plan tier hook — the app-side entitlement surface. Reads the plan from the
// auth profile (hosted user_metadata / local persisted profile) and exposes
// gates + a persisted plan switcher for the Plans page.
import { useCallback } from "react";
import { useAuth } from "@/lib/AuthContext";
import { supabase } from "@/lib/supabase";
import { isLocalWorkspace, loadLocalProfile, saveLocalProfile } from "@/lib/repo/select";
import { planOf, planTier, can as canFeature, isPremium as isPaid } from "@/lib/plans";

// Local/demo sandbox defaults to Ultimate so every Pro/Ultimate feature is
// explorable offline; hosted starts everyone on Free. Switching works either
// way, which is exactly what the demo needs.
const LOCAL_DEFAULT_PLAN = "ultimate";

export const usePlan = () => {
  const { user } = useAuth();
  const local = isLocalWorkspace();

  const rawPlan = local ? (loadLocalProfile() || {}).plan : user?.user_metadata?.plan;
  const plan = planOf(rawPlan == null && local ? LOCAL_DEFAULT_PLAN : rawPlan);

  const setPlan = useCallback(
    async (next) => {
      const value = planOf(next);
      if (local) {
        const profile = loadLocalProfile() || {};
        saveLocalProfile({ ...profile, plan: value });
      } else {
        const { error } = await supabase.auth.updateUser({ data: { plan: value } });
        if (error) throw error;
      }
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
    defaultPlan: local ? LOCAL_DEFAULT_PLAN : "free",
  };
};