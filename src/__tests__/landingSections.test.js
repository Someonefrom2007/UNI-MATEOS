import { describe, it, expect } from "vitest";
import {
  ILLUSTRATIVE_LABEL,
  LANDING_SECTIONS,
  navSections,
  HERO,
  PROBLEM,
  MANIFESTO,
  PRODUCT,
  INTELLIGENCE,
  PLANNING,
  FOCUS,
  COMMUNITY,
  PRIVACY,
  FUTURE,
  CTA,
} from "@/components/landing/sections";

describe("landing narrative (§23)", () => {
  it("follows the required story order", () => {
    const order = LANDING_SECTIONS.map((s) => s.id);
    expect(order).toEqual([
      "hero", "problem", "manifesto", "product", "intelligence",
      "planning", "focus", "community", "privacy", "future", "cta",
    ]);
  });

  it("keeps anchor ids unique and nav labels present", () => {
    const ids = LANDING_SECTIONS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    const nav = navSections();
    expect(nav.length).toBeGreaterThan(0);
    nav.forEach((s) => expect(s.nav).toBeTruthy());
  });

  it("uses the official tagline in the hero", () => {
    expect(HERO.tagline).toBe("Your university, organized around you.");
    expect(HERO.headline).toBe("UNI·MATE");
  });

  it("has no empty or placeholder copy", () => {
    const picks = [
      HERO.kicker, HERO.sub, PROBLEM.headline, MANIFESTO.headline, MANIFESTO.body,
      PRODUCT.headline, PRODUCT.body, INTELLIGENCE.headline, PLANNING.headline,
      FOCUS.headline, COMMUNITY.headline, PRIVACY.headline, FUTURE.headline, CTA.headline,
    ];
    picks.forEach((p) => {
      expect(typeof p).toBe("string");
      expect(p.trim().length).toBeGreaterThan(0);
    });
    expect(JSON.stringify(picks).toLowerCase()).not.toMatch(/lorem|\btodo\b|placeholder/i);
  });

  it("marks every decorative sample as illustrative (§6)", () => {
    expect(ILLUSTRATIVE_LABEL).toBe("Illustrative preview");
  });

  it("includes the Matrícula de Honor band", () => {
    expect(INTELLIGENCE.bands.some(([, label]) => label === "Matrícula de Honor")).toBe(true);
    expect(INTELLIGENCE.bands.length).toBe(5);
  });

  it("community identities are initials / geometry, never photos (§8)", () => {
    expect(COMMUNITY.body).toMatch(/initials/);
    expect(COMMUNITY.body).toMatch(/never photos/);
  });
});