import { describe, it, expect } from "vitest";

import { appEnvName, featureContext, mergeFlags } from "@/lib/useFeatureFlags";
import { DEFAULT_FLAGS, featuresEnabled, normalizeFlag } from "@/lib/admin/featureFlags";

describe("student-app feature flags", () => {
  it("defaults fill in every shipped key; stored rows win", () => {
    const stored = [
      { key: "ai_assistant", enabled: false, plan_floor: "pro", rollout_pct: 100, envs: [], description: "off for ops" },
      { key: "custom_flag", enabled: true, plan_floor: "free", rollout_pct: 100, envs: [], description: "console-added" },
    ];
    const merged = mergeFlags(stored);
    const byKey = Object.fromEntries(merged.map((f) => [f.key, f]));
    expect(byKey.ai_assistant.enabled).toBe(false); // stored wins
    expect(byKey.ai_assistant.planFloor).toBe("pro");
    expect(byKey.custom_flag).toBeTruthy(); // unknown stored keys survive
    expect(Object.keys(DEFAULT_FLAGS).every((key) => byKey[key])).toBe(true); // defaults all present
    expect(byKey.community.enabled).toBe(true);
  });

  it("featureContext shapes the user/environment for the evaluator", () => {
    expect(featureContext({ plan: "ULTRA", userId: "u-1" }).plan).toBe("ultra");
    // In the local workspace a null userId resolves to the deterministic local identity;
    // hosted keeps null (rollout then can't bucket the user — honest).
    const nullUser = featureContext({ plan: "free" }).userId;
    expect(appEnvName() === "local" ? nullUser === "local-workspace" : nullUser === null).toBe(true);
    expect(featureContext({ plan: "pro", userId: "u-1", isAdmin: true }).isAdmin).toBe(true);
    expect(featureContext().env).toBe(appEnvName());
  });

  it("merged flags evaluate like the real app: plan gate, rollout and kill switch", () => {
    const flags = mergeFlags([
      { key: "ai_assistant", enabled: true, plan_floor: "pro", rollout_pct: 50, envs: [], description: "rollout" },
    ]);
    const asFree = featuresEnabled(flags, featureContext({ plan: "free", userId: "stu" }));
    expect(asFree.ai_assistant.enabled).toBe(false);
    expect(asFree.ai_assistant.reason).toBe("plan:free");

    // A pro user enters the deterministic 50% rollout (stu-1 hashes to 6 < 50).
    const inRollout = featuresEnabled(flags, featureContext({ plan: "pro", userId: "stu-1" }));
    expect(inRollout.ai_assistant.enabled).toBe(true);
    expect(inRollout.ai_assistant.reason).toBe("rollout");
    // Users outside the bucket stay out — the rollout is the gate.
    const outOfRollout = featuresEnabled(flags, featureContext({ plan: "pro", userId: "stu" }));
    expect(outOfRollout.ai_assistant.enabled).toBe(false);
    expect(outOfRollout.ai_assistant.reason).toBe("rollout");

    const killSwitch = mergeFlags([normalizeFlag({ key: "ai_assistant", enabled: false, plan_floor: "pro", rollout_pct: 100, envs: [], description: "" })]);
    expect(featuresEnabled(killSwitch, featureContext({ plan: "ultimate", userId: "stu" })).ai_assistant.enabled).toBe(false);
  });

  it("flags can never grant what a plan/rollout own — evaluation is additive, not abusive", () => {
    const flags = mergeFlags([
      { key: "experimental_analytics", enabled: true, plan_floor: "admins", rollout_pct: 100, envs: ["development"], description: "" },
    ]);
    // A regular user on any plan, even with the flag row enabled, stays out.
    expect(featuresEnabled(flags, featureContext({ plan: "ultimate", userId: "stu" })).experimental_analytics.enabled).toBe(false);
    // A non-existent flag simply isn't enabled.
    expect(featuresEnabled(flags, featureContext({ plan: "ultimate", userId: "stu" })).not_a_flag).toBeUndefined();
  });
});