import { describe, it, expect } from "vitest";
import {
  PLAN_IDS,
  PLANS,
  PLAN_FEATURES,
  CAPABILITY_PLANS,
  isPlanId,
  planById,
  entitlementFor,
  planForCapability,
  hasCapability,
  remainingAiMessages,
} from "@/lib/plans";

describe("plans: the three tiers the directive defines", () => {
  it("has exactly three tiers, named FREE / PRO / ULTIMATE", () => {
    expect(PLAN_IDS).toEqual(["free", "pro", "ultimate"]);
    expect(PLAN_IDS.map((id) => PLANS[id].name)).toEqual(["FREE", "PRO", "ULTIMATE"]);
  });

  it("keeps the directive's purpose wording", () => {
    expect(PLANS.free.purpose).toBe("ORGANIZE");
    expect(PLANS.pro.purpose).toBe("UNDERSTAND");
    expect(PLANS.ultimate.purpose).toBe("CONNECT");
  });

  it("gives every tier real limits, not just a feature list", () => {
    PLAN_IDS.forEach((id) => {
      const limits = PLANS[id].limits;
      expect(limits, `${id} has no limits`).toBeTypeOf("object");
      // §35: "All future tiers must have limits." A tier whose only constraints
      // are absent is a marketing page, not an entitlement.
      expect(Object.keys(limits).length).toBeGreaterThan(3);
      expect(limits.aiMessagesPerDay).toBeTypeOf("number");
      expect(limits.studyPlanHorizonDays).toBeTypeOf("number");
    });
  });

  it("describes each tier with features", () => {
    PLAN_IDS.forEach((id) => {
      expect(PLAN_FEATURES[id]?.length, `${id} has no features`).toBeGreaterThan(0);
    });
  });

  it("widens limits monotonically from free to ultimate", () => {
    expect(PLANS.pro.limits.aiMessagesPerDay).toBeGreaterThan(PLANS.free.limits.aiMessagesPerDay);
    expect(PLANS.ultimate.limits.studyPlanHorizonDays).toBeGreaterThan(
      PLANS.pro.limits.studyPlanHorizonDays,
    );
    expect(PLANS.pro.limits.studyPlanHorizonDays).toBeGreaterThan(
      PLANS.free.limits.studyPlanHorizonDays,
    );
  });
});

describe("plans: FREE is a complete product, not a trial", () => {
  it("does not gate the syllabus importer that already ships", () => {
    // Courses.jsx has always accepted a pasted CSV/JSON syllabus on FREE. The
    // gated capability is *AI* parsing of documents, not bulk import, so the
    // two must not be conflated into a false upsell.
    expect(PLANS.free.limits.aiSyllabusParsing).toBe(false);
    expect(CAPABILITY_PLANS.syllabusImport).toBeUndefined();
  });

  it("leaves the core academic surfaces ungated", () => {
    const free = PLANS.free.limits;
    // §35: "Do NOT aggressively lock basic functionality." These are the
    // modules a student cannot run a semester without.
    expect(free.courses).toBe(Infinity);
    expect(free.gradeSimulations).toBe(Infinity);
    expect(free.community).toBe(true);
  });

  it("gates exactly the capabilities the directive assigns to paid tiers", () => {
    const gatedIn = (id) =>
      Object.entries(PLANS[id].limits)
        .filter(([, v]) => v === false)
        .map(([k]) => k)
        .sort();

    // FREE withholds the three capabilities §35 names for PRO and ULTIMATE.
    expect(gatedIn("free")).toEqual(["aiSyllabusParsing", "cloudSync", "predictiveWorkload"]);
    // PRO adds intelligence but not connection, so cloud sync stays withheld.
    expect(gatedIn("pro")).toEqual(["cloudSync"]);
    expect(gatedIn("ultimate")).toEqual([]);
  });
});

describe("plans: entitlement resolution", () => {
  it("gives every workspace FREE, because no billing exists", () => {
    expect(entitlementFor().id).toBe("free");
    expect(entitlementFor(null).id).toBe("free");
    expect(entitlementFor("free").id).toBe("free");
  });

  it("refuses to let a client-side value grant a paid tier", () => {
    // A stored value is attacker-controlled. It must never widen entitlement.
    expect(entitlementFor("pro").id).toBe("free");
    expect(entitlementFor("ultimate").id).toBe("free");
    expect(entitlementFor("enterprise").id).toBe("free");
    expect(entitlementFor({ id: "ultimate" }).id).toBe("free");
  });
});

describe("plans: capability lookup", () => {
  it("names a real tier for every gated capability", () => {
    Object.entries(CAPABILITY_PLANS).forEach(([capability, planId]) => {
      expect(isPlanId(planId), `${capability} points at a missing tier`).toBe(true);
      // The named tier must actually grant it, or the upsell copy lies.
      expect(PLANS[planId].limits[capability]).toBe(true);
    });
  });

  it("reports capabilities against an entitlement honestly", () => {
    const free = entitlementFor();
    expect(hasCapability(free, "community")).toBe(true);
    expect(hasCapability(free, "aiSyllabusParsing")).toBe(false);
    expect(hasCapability(free, "cloudSync")).toBe(false);
    expect(hasCapability(PLANS.pro, "aiSyllabusParsing")).toBe(true);
    expect(hasCapability(PLANS.ultimate, "cloudSync")).toBe(true);
  });

  it("survives a missing entitlement", () => {
    expect(hasCapability(undefined, "community")).toBe(true);
    expect(hasCapability(null, "cloudSync")).toBe(false);
    expect(planById("nope")).toBeNull();
    expect(planForCapability("nope")).toBeNull();
  });
});

describe("plans: AI message budget", () => {
  it("counts down from the tier's cap", () => {
    const free = PLANS.free;
    expect(remainingAiMessages(free, 0)).toBe(free.limits.aiMessagesPerDay);
    expect(remainingAiMessages(free, 5)).toBe(free.limits.aiMessagesPerDay - 5);
  });

  it("never goes negative and treats junk usage as zero", () => {
    const free = PLANS.free;
    expect(remainingAiMessages(free, 10_000)).toBe(0);
    expect(remainingAiMessages(free, -3)).toBe(free.limits.aiMessagesPerDay);
    expect(remainingAiMessages(free, "lots")).toBe(free.limits.aiMessagesPerDay);
  });

  it("is unlimited only where the tier says so", () => {
    expect(remainingAiMessages(PLANS.ultimate, 999)).toBe(Infinity);
  });
});
