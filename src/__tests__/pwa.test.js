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
    // Base-aware, not a hardcoded "/": the production build runs under
    // BASE_PATH=/UNI-MATEOS/, and a start_url of "/" would launch the
    // installed app outside the deployment root.
    expect(manifest.start_url).toMatch(/^\//);
    expect(manifest.start_url).toMatch(/\/$/);
    expect(manifest.background_color).toBe("#07080D");
    expect(manifest.theme_color).toBe("#07080D");
  });

  it("keeps every icon on the same path prefix as start_url", () => {
    const prefix = manifest.start_url;
    manifest.icons.forEach((i) => {
      expect(i.src.startsWith(prefix)).toBe(true);
    });
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
    // Derived from the deploy base, not the literal '/index.html'. The service
    // worker lives in dist/, so a '/' fallback is a 404 under the
    // /UNI-MATEOS/ production path and silently breaks every hard navigation.
    expect(cfg).toContain("navigateFallback: `${baseSlash}index.html`");
    expect(cfg).toContain("navigateFallbackDenylist");
    expect(cfg).toContain("#07080D");
    expect(cfg).toContain("runtimeCaching");
  });

  it("excludes dynamic API routes from the offline navigation fallback", () => {
    const cfg = read("vite.config.js");
    expect(cfg).toMatch(/navigateFallbackDenylist/);
    // The deny-list matches the full path, which now carries the deploy base,
    // so it has to be constructed from `base` rather than assuming "/".
    expect(cfg).toContain("new RegExp(`^${baseSlash}(auth|api)`)");
    expect(cfg).toMatch(/\\\.ics\$/);
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

describe("Deployment: the app survives a sub-path host", () => {
  // GitHub Pages serves this app from /UNI-MATEOS/. A router without a basename
  // matches nothing there and renders the 404 page, so the whole app looks
  // dead while the bundle, the API and the database are all fine. This is
  // exactly what happened on the first deploy, so it is pinned.
  it("gives the router a basename derived from the build base", () => {
    const app = read("src/App.jsx");
    expect(app).toMatch(/<Router\s+basename=\{import\.meta\.env\.BASE_URL\}>/);
  });

  it("does not hardcode a root-only router", () => {
    const app = read("src/App.jsx");
    expect(app).not.toMatch(/<Router>/);
  });

  it("still builds and serves a root-based bundle when BASE_PATH is unset", () => {
    // The basename must follow the same base as the build, not a second
    // independent constant that could drift from it.
    const cfg = read("vite.config.js");
    expect(cfg).toContain("const base = process.env.BASE_PATH || '/';");
    expect(cfg).toMatch(/^\s*base,$/m);
  });
});