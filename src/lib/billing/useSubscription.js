// useSubscription — the client's only view into billing state. Resolves the
// deployment mode, then either reports the local/demo sandbox (simulated) or
// asks the server-side billing endpoint for the real subscription. Never
// fabricates a subscription in hosted mode.

import { useEffect, useCallback, useState } from "react";
import { isLocalWorkspace } from "@/lib/repo/select";
import { loadLocalProfile } from "@/lib/repo/select";
import { getBillingService } from "./lemonSqueezy";
import { planOf, planTier } from "@/lib/plans";

export const useSubscription = () => {
  const local = isLocalWorkspace();
  const [state, setState] = useState({
    loading: local ? false : true,
    configured: false,
    subscription: null,
    plan: local ? planOf((loadLocalProfile() || {}).plan) : "free",
    // Server-decided access, kept apart from `plan` (the billing fact). Starts
    // false so a hosted user is never briefly entitled before the server has
    // actually answered.
    entitled: false,
    admin: false,
    mode: local ? "local" : "hosted",
  });

  const refresh = useCallback(async () => {
    if (local) return state;
    const status = await getBillingService().status();
    setState({
      loading: false,
      configured: status.configured,
      subscription: status.subscription,
      plan: status.plan,
      entitled: Boolean(status.entitled),
      admin: Boolean(status.admin),
      mode: "hosted",
    });
    return status;
  }, [local, state]);

  useEffect(() => {
    if (local) return;
    getBillingService()
      .status()
      .then((status) =>
        setState({
          loading: false,
          configured: status.configured,
          subscription: status.subscription,
          plan: status.plan,
          entitled: Boolean(status.entitled),
          admin: Boolean(status.admin),
          mode: "hosted",
        })
      )
      .catch(() => setState((s) => ({ ...s, loading: false })));
  }, [local]);

  return { ...state, tier: planTier(state.plan), refresh };
};

/** Whether an upgrade can start right now (real checkout in hosted config). */
export const canUpgrade = (state) => state.mode === "hosted" && state.configured;