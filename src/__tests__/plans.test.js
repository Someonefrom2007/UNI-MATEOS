// Tier entitlement engine — pure.
import { describe, it, expect } from "vitest";
import { PLAN_TIERS, PLAN_FEATURES, planTier, planRank, planOf, isPremium, can, neededTier, upgradeTo, downgradeTo } from "@/lib/plans";

describe("planTier / planRank / planOf", () => {
  it("normalizes valid tiers (case-insensitive) and rejects unknown values", () => {
    expect(planTier("pro").rank).toBe(2);
    expect(planTier("ULTRA").value).toBe("ultra");
    expect(planTier("enterprise")).toBeNull();
    expect(planRank("free")).toBe(1);
    expect(planRank("something-weird")).toBe(1);
    expect(planRank(undefined)).toBe(1);
  });

  it("planOf accepts a plan string or a profile object and always returns a valid tier", () => {
    expect(planOf("pro")).toBe("pro");
    expect(planOf({ plan: "ultra" })).toBe("ultra");
    expect(planOf({ plan: "hacker" })).toBe("free");
    expect(planOf(null)).toBe("free");
    expect(planOf(undefined)).toBe("free");
    expect(planOf(42)).toBe("free");
  });
});

describe("isPremium", () => {
  it("treats pro and ultra as premium, free as not", () => {
    expect(isPremium("free")).toBe(false);
    expect(isPremium("pro")).toBe(true);
    expect(isPremium("ultra")).toBe(true);
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
    expect(can("ultra", "flashcards")).toBe(true);
  });

  it("locks the Phase 10-12 Pro features behind pro", () => {
    for (const feature of ["smart_planning", "exam_intelligence", "advanced_analytics"]) {
      expect(can("free", feature), `free:${feature}`).toBe(false);
      expect(can("pro", feature), `pro:${feature}`).toBe(true);
      expect(can("ultra", feature), `ultra:${feature}`).toBe(true);
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
    expect(neededTier("study_groups")).toBe("ultra");
    expect(neededTier("no_such_feature")).toBe("free");
  });

  it("upgradeTo walks one tier at a time", () => {
    expect(upgradeTo("free").value).toBe("pro");
    expect(upgradeTo("pro").value).toBe("ultra");
    expect(upgradeTo("ultra")).toBeNull();
    expect(upgradeTo("bogus").value).toBe("pro");
  });

  it("downgradeTo walks one tier down", () => {
    expect(downgradeTo("ultra").value).toBe("pro");
    expect(downgradeTo("pro").value).toBe("free");
    expect(downgradeTo("free")).toBeNull();
  });
});