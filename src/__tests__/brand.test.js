import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import {
  BRAND_NAME,
  BRAND_TAGLINE,
  BRAND_SUBTITLE,
  BRAND_COLORS,
  SYMBOL_VIEWBOX,
  SYMBOL_LAYERS,
  BRAND_VARIANTS,
  brandAriaLabel,
} from "@/components/Brand/brand";

const root = fileURLToPath(new URL("../../", import.meta.url));

describe("brand constants", () => {
  it("uses the official name and tagline", () => {
    expect(BRAND_NAME).toBe("UNI·MATE");
    expect(BRAND_TAGLINE).toBe("Your university, organized around you.");
    expect(BRAND_SUBTITLE).toBe("Academic OS");
  });

  it("keeps the approved three-layer diamond symbol geometry", () => {
    expect(SYMBOL_VIEWBOX).toBe("0 0 32 40");
    expect(SYMBOL_LAYERS).toHaveLength(3);
    expect(SYMBOL_LAYERS[0].points).toBe("16,1 30.5,9.8 16,18.6 1.5,9.8");
    expect(SYMBOL_LAYERS[1].points).toBe("16,11.5 30.5,20.3 16,29.1 1.5,20.3");
    expect(SYMBOL_LAYERS[2].points).toBe("16,22 30.5,30.8 16,39.6 1.5,30.8");
  });

  it("signals a redesign (and any trademark drift) the moment it happens", () => {
    expect(BRAND_COLORS).toMatchObject({ cyan: "#22D3EE", blue: "#3B82F6", indigo: "#6366F1" });
    expect(SYMBOL_LAYERS.map((l) => l.fill.toLowerCase())).toEqual([
      BRAND_COLORS.cyan.toLowerCase(),
      BRAND_COLORS.blue.toLowerCase(),
      BRAND_COLORS.indigo.toLowerCase(),
    ]);
    expect(BRAND_VARIANTS).toEqual(["primary", "compact", "symbol", "gradient", "white", "black"]);
  });

  it("provides an accessible label helper", () => {
    expect(brandAriaLabel()).toBe("UNI·MATE");
  });

  it("favicon asset carries the same three brand layers", () => {
    const favicon = readFileSync(`${root}/public/icon.svg`, "utf8");
    expect(favicon).toContain("#22D3EE");
    expect(favicon).toContain("#3B82F6");
    expect(favicon).toContain("#6366F1");
    expect(favicon).not.toMatch(/mortar|caps/i);
  });

  it("manifest exposes PNG app icons for installability", () => {
    const manifest = JSON.parse(readFileSync(`${root}/public/manifest.json`, "utf8"));
    const png = manifest.icons.filter((i) => i.type === "image/png");
    expect(png.some((i) => i.sizes === "192x192")).toBe(true);
    expect(png.some((i) => i.sizes === "512x512")).toBe(true);
    expect(png.some((i) => i.purpose === "maskable")).toBe(true);
  });
});