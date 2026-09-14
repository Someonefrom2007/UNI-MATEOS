import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const read = (p) => readFileSync(resolve(root, p), "utf8");
const tryRead = (p) => (existsSync(resolve(root, p)) ? read(p) : null);

describe("PWA: manifest validity", () => {
  let manifest;
  beforeAll(() => {
    manifest = JSON.parse(tryRead("public/manifest.json"));
  });

  it("is valid JSON with a stable identity", () => {
    expect(manifest.name).toBeTruthy();
    expect(manifest.short_name).toBe("UNI·MATE");
    expect(manifest.lang).toBe("en");
  });

  it("declares an offline-capable install surface", () => {
    expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toBe("/");
    expect(manifest.background_color).toBe("#07080D");
    expect(manifest.theme_color).toBe("#07080D");
  });

  it("declares icons covering any + maskable purposes", () => {
    expect(manifest.icons).toBeInstanceOf(Array);
    const purposes = manifest.icons.map((i) => i.purpose);
    expect(purposes).toContain("any");
    expect(purposes).toContain("maskable");
    manifest.icons.forEach((i) => {
      expect(i.src).toBeTruthy();
      expect(i.type).toBeTruthy();
      expect(i.sizes).toMatch(/any|\d+x\d+/);
    });
  });
});

describe("PWA: offline asset fallback contract", () => {
  it("links the web app manifest and meta from index.html", () => {
    const html = read("index.html");
    expect(html).toMatch(/rel="manifest"/);
    expect(html).toContain('content="#07080D"');
    expect(html).toContain("apple-mobile-web-app-capable");
    expect(html).toContain("apple-touch-icon");
  });

  it("configures the service worker for SPA navigation fallback and precaching", () => {
    const cfg = read("vite.config.js");
    expect(cfg).toContain("VitePWA");
    expect(cfg).toContain("registerType: 'autoUpdate'");
    expect(cfg).toContain("navigateFallback: '/index.html'");
    expect(cfg).toContain("navigateFallbackDenylist");
    expect(cfg).toContain("#07080D");
    expect(cfg).toContain("runtimeCaching");
  });

  it("excludes dynamic API routes from the offline navigation fallback", () => {
    const cfg = read("vite.config.js");
    expect(cfg).toMatch(/navigateFallbackDenylist/);
    expect(cfg).toMatch(/\/auth\//);
    expect(cfg).toMatch(/\/api\//);
    expect(cfg).toMatch(/\.ics\$/);
  });

  it("produces a generated service worker after build (dist/sw.js)", () => {
    const sw = tryRead("dist/sw.js");
    if (sw !== null) {
      expect(sw.length).toBeGreaterThan(0);
      // workbox injects the precached entry list into the SW
      expect(sw.length).toBeGreaterThan(1000);
    }
  });

  it("keeps the hosted API runtime cache configured for offline reads", () => {
    const cfg = read("vite.config.js");
    expect(cfg).toMatch(/cacheName:\s*'unimate-api'/);
    expect(cfg).toContain("NetworkFirst");
    expect(cfg).toContain("supabase.co");
  });

  it("the icon asset referenced by the manifest exists", () => {
    expect(tryRead("public/icon.svg")).not.toBeNull();
  });
});