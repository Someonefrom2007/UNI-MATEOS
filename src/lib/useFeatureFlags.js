// Student-app feature flags.
//
// The admin console owns the values in the `feature_flags` table; the app reads
// them through the shared repository and evaluates them with the same pure
// engine (`@/lib/admin/featureFlags`). Unpersisted keys fall back to their
// shipped defaults so the app works identically before the schema is applied.
//
// RULE: flags are NOT authorization. They only add rollouts/kill-switches on
// top of the plan gate in plans.js and the server-side enforcement in the edge
// functions. A flag can never grant or remove a plan entitlement.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { getAppRepo, isLocalWorkspace } from "@/lib/repo/select";
import { DEFAULT_FLAGS, featuresEnabled, normalizeFlag } from "@/lib/admin/featureFlags";
import { usePlan } from "@/lib/usePlan";

/** Environment name the app reports to the flag engine. */
export const appEnvName = () => (isLocalWorkspace() ? "local" : "production");

/**
 * Build the evaluation context for one user.
 * @param {{ plan?: string, userId?: string|null, isAdmin?: boolean }} [input={}]
 * @returns {{ env: string, plan: string, userId: string|null, isAdmin: boolean }}
 */
export const featureContext = ({ plan = "free", userId = null, isAdmin = false } = {}) => ({
  env: appEnvName(),
  plan: String(plan || "free").toLowerCase(),
  userId: isLocalWorkspace() && userId == null ? "local-workspace" : userId || null,
  isAdmin: Boolean(isAdmin),
});

/**
 * Merge stored rows over the shipped defaults: stored values win, and keys the
 * console hasn't persisted yet keep their default definition.
 * @param {Array<object>} [rows=[]] - stored FeatureFlag rows
 * @returns {Array<object>} normalized flags, defaults filled in
 */
export const mergeFlags = (rows = []) => {
  const stored = (Array.isArray(rows) ? rows : []).map(normalizeFlag);
  const known = new Set(stored.map((f) => f.key));
  return [
    ...stored,
    ...Object.entries(DEFAULT_FLAGS)
      .filter(([key]) => !known.has(key))
      .map(([key, def]) => ({ key, ...def })),
  ];
};

/**
 * Live flag surface for the student app. Loads the feature_flags table through
 * the app repo, evaluates every flag for this user/environment, and exposes a
 * `can(feature)` helper. Safe before the console schema is applied: any read
 * failure keeps the shipped defaults (all flags on) and never breaks the UI.
 */
export const useFeatureFlags = () => {
  const { user } = useAuth();
  const { plan } = usePlan();
  const [flags, setFlags] = useState(() => mergeFlags());
  const [loaded, setLoaded] = useState(false);

  const repo = useMemo(() => {
    try {
      return getAppRepo();
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const rows = await repo?.list("FeatureFlag");
        if (mounted) setFlags(mergeFlags(rows));
      } catch {
        // Keep shipped defaults — never surface a broken flag state.
      } finally {
        if (mounted) setLoaded(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [repo]);

  const features = useMemo(
    () => featuresEnabled(flags, featureContext({ plan, userId: user?.id || null })),
    [flags, plan, user]
  );

  const can = useCallback((key) => Boolean(features[key]?.enabled), [features]);

  return { features, flags, can, loaded };
};