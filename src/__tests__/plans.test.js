// Tier entitlement engine — pure.
import { describe, it, expect } from "vitest";
import { PLAN_TIERS, PLAN_FEATURES, planTier, planRank, planOf, isPremium, can, neededTier, upgradeTo, downgradeTo, gatePlanFor } from "@/lib/plans";

describe("planTier / planRank / planOf", () => {
  it("normalizes valid tiers (case-insensitive) and rejects unknown values", () => {
    expect(planTier("pro").rank).toBe(2);
    expect(planTier("ULTIMATE").value).toBe("ultimate");
    expect(planTier("enterprise")).toBeNull();
    expect(planRank("free")).toBe(1);
    expect(planRank("something-weird")).toBe(1);
    expect(planRank(undefined)).toBe(1);
  });

  it("maps the legacy 'ultra' spelling to the canonical 'ultimate' tier", () => {
    expect(planTier("ultra").value).toBe("ultimate");
    expect(planTier("ULTRA").label).toBe("Ultimate");
    expect(planOf({ plan: "ultra" })).toBe("ultimate");
    expect(planRank("ultra")).toBe(3);
  });

  it("planOf accepts a plan string or a profile object and always returns a valid tier", () => {
    expect(planOf("pro")).toBe("pro");
    expect(planOf({ plan: "ultimate" })).toBe("ultimate");
    expect(planOf({ plan: "hacker" })).toBe("free");
    expect(planOf(null)).toBe("free");
    expect(planOf(undefined)).toBe("free");
    expect(planOf(42)).toBe("free");
  });
});

describe("isPremium", () => {
  it("treats pro and ultimate as premium, free as not", () => {
    expect(isPremium("free")).toBe(false);
    expect(isPremium("pro")).toBe(true);
    expect(isPremium("ultimate")).toBe(true);
    expect(isPremium("bogus")).toBe(false);
  });
});

describe("can", () => {
  it("follows the rank matrix across all tiers and features", () => {
    for (const tier of PLAN_TIERS) {
      for (const [feature, minTier] of Object.entries(PLAN_FEATURES)) {
        const expected = planRank(tier.value) >= planRank(minTier);
        expect(can(tier.value, feature), `${tier.value}:${feature}`).toBe(expected);
        expect(can({ plan: tier.value }, feature), `${tier.value}:${feature}`).toBe(expected);
      }
    }
  });

  it("pro inherits free features and unlocks pro features", () => {
    expect(can("free", "ai_assistant")).toBe(false);
    expect(can("pro", "ai_assistant")).toBe(true);
    expect(can("pro", "flashcards")).toBe(true);
    expect(can("ultimate", "flashcards")).toBe(true);
  });

  it("locks the Phase 10-12 Pro features behind pro", () => {
    for (const feature of ["smart_planning", "exam_intelligence", "advanced_analytics"]) {
      expect(can("free", feature), `free:${feature}`).toBe(false);
      expect(can("pro", feature), `pro:${feature}`).toBe(true);
      expect(can("ultimate", feature), `ultimate:${feature}`).toBe(true);
    }
    expect(neededTier("exam_intelligence")).toBe("pro");
  });

  it("unlisted features are unlocked on every plan", () => {
    expect(can("free", "dashboard")).toBe(true);
    expect(can("free", undefined)).toBe(true);
  });

  it("degrades safely for empty profiles", () => {
    expect(can(null, "ai_assistant")).toBe(false);
    expect(can(undefined, "ai_assistant")).toBe(false);
  });
});

describe("neededTier / upgrade math", () => {
  it("maps features to their minimum tier", () => {
    expect(neededTier("flashcards")).toBe("pro");
    expect(neededTier("study_groups")).toBe("ultimate");
    expect(neededTier("no_such_feature")).toBe("free");
  });

  it("upgradeTo walks one tier at a time", () => {
    expect(upgradeTo("free").value).toBe("pro");
    expect(upgradeTo("pro").value).toBe("ultimate");
    expect(upgradeTo("ultimate")).toBeNull();
    expect(upgradeTo("bogus").value).toBe("pro");
  });

  it("downgradeTo walks one tier down", () => {
    expect(downgradeTo("ultimate").value).toBe("pro");
    expect(downgradeTo("pro").value).toBe("free");
    expect(downgradeTo("free")).toBeNull();
  });
});

// Staff hold an enabled `admin_accounts` row instead of a subscription, and
// has_paid_entitlement() has always counted that as paid. These lock the two
// properties that matter: an entitled staff member is not paywalled, and
// entitlement NEVER fabricates a purchased plan for display.
describe("gatePlanFor — staff entitlement", () => {
  it("unlocks the paid features for an entitled staff member on no subscription", () => {
    expect(gatePlanFor("free", true)).toBe("ultimate");
    expect(can(gatePlanFor("free", true), "flashcards")).toBe(true);
    expect(can(gatePlanFor("free", true), "advanced_analytics")).toBe(true);
    expect(can(gatePlanFor("free", true), "ai_assistant")).toBe(true);
  });

  it("also unlocks the ultimate-only surfaces, because the DB never separated them", () => {
    // has_paid_entitlement() is boolean and every paid table has the same
    // own-row policies, so staff can already reach these rows. Flooring at "pro"
    // would show a lock the API never enforced and would hide /integrations and
    // study groups from the account that most needs to test them.
    expect(can(gatePlanFor("free", true), "study_groups")).toBe(true);
    expect(can(gatePlanFor("free", true), "university_integrations")).toBe(true);
  });

  it("still paywalls a non-entitled free user", () => {
    expect(gatePlanFor("free", false)).toBe("free");
    expect(can(gatePlanFor("free", false), "flashcards")).toBe(false);
    expect(can(gatePlanFor("free", false), "advanced_analytics")).toBe(false);
  });

  it("never downgrades or fabricates a real subscription", () => {
    expect(gatePlanFor("pro", true)).toBe("pro");
    expect(gatePlanFor("pro", false)).toBe("pro");
    expect(gatePlanFor("ultimate", false)).toBe("ultimate");
    expect(gatePlanFor("ultimate", true)).toBe("ultimate");
  });

  it("treats a missing or unknown plan as free", () => {
    expect(gatePlanFor(undefined, true)).toBe("ultimate");
    expect(gatePlanFor("nonsense", true)).toBe("ultimate");
    expect(gatePlanFor(null, false)).toBe("free");
  });
});