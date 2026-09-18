// Onboarding completion is opt-in: the route is only reached from the
// dashboard, so this flag exists so the dashboard stops inviting a student who
// has already been through it. These tests cover the flag and the profile
// payload that gets stored on the account.
import { describe, it, expect, beforeEach, vi } from "vitest";

// The store reads localStorage through a try/catch because it may be
// unavailable. vitest runs with the `node` environment, so a small in-memory
// stand-in is installed rather than pulling in jsdom for one module.
const makeStorage = () => {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    clear: () => map.clear(),
  };
};

beforeEach(() => {
  vi.resetModules();
  globalThis.localStorage = makeStorage();
});

describe("onboarding completion", () => {
  it("reports not done before the student has been through it", async () => {
    const { isOnboardingDone } = await import("@/lib/onboarding");
    expect(isOnboardingDone()).toBe(false);
  });

  it("remembers completion", async () => {
    const { isOnboardingDone, markOnboardingDone } = await import("@/lib/onboarding");
    markOnboardingDone();
    expect(isOnboardingDone()).toBe(true);
    expect(localStorage.getItem("unimate-onboarding")).toBe("done");
  });

  it("does not report done for an unrelated stored value", async () => {
    localStorage.setItem("unimate-onboarding", "halfway");
    const { isOnboardingDone } = await import("@/lib/onboarding");
    expect(isOnboardingDone()).toBe(false);
  });

  it("survives storage being unavailable rather than throwing", async () => {
    globalThis.localStorage = {
      getItem: () => { throw new Error("blocked"); },
      setItem: () => { throw new Error("blocked"); },
    };
    const { isOnboardingDone, markOnboardingDone } = await import("@/lib/onboarding");
    expect(() => markOnboardingDone()).not.toThrow();
    expect(isOnboardingDone()).toBe(false);
  });
});

describe("onboardingProfile", () => {
  it("carries the answers and the language in use", async () => {
    const { setLang } = await import("@/lib/i18n");
    const { onboardingProfile } = await import("@/lib/onboarding");
    setLang("ca");
    const profile = onboardingProfile({
      university: "UB", degree: "CS", year: "2", semester: "1",
      academic_year: "2025/26", goals: ["Exams"],
    });
    expect(profile).toEqual({
      university: "UB", degree: "CS", year: "2", semester: "1",
      academic_year: "2025/26", interests: ["Exams"], language: "ca",
    });
  });

  it("falls back to defaults for a skipped form", async () => {
    const { onboardingProfile } = await import("@/lib/onboarding");
    const profile = onboardingProfile({});
    expect(profile.year).toBe("1");
    expect(profile.semester).toBe("1");
    expect(profile.interests).toEqual([]);
  });
});
