// Deployment base-path contract.
//
// The app is served from a repository sub-path in production
// (/UNI-MATEOS/), so any code that does a FULL page load must build its URL
// from the deployment base. React Router covers <Link to>, but
// window.location.href and Supabase redirectTo do not — those are what broke
// on the first deploy (login bounced to the origin root and 404'd).
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const load = async (baseUrl) => {
  vi.resetModules();
  vi.stubEnv("BASE_URL", baseUrl);
  return import("@/lib/appBase.js");
};

describe("appBase: root-hosted build (base = /)", () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => vi.unstubAllEnvs());

  it("leaves paths untouched so local behaviour is unchanged", async () => {
    const { appPath, APP_BASE } = await load("/");
    expect(APP_BASE).toBe("/");
    expect(appPath("/dashboard")).toBe("/dashboard");
    expect(appPath("/grades")).toBe("/grades");
    expect(appPath("/")).toBe("/");
  });
});

describe("appBase: sub-path build (base = /UNI-MATEOS/)", () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => vi.unstubAllEnvs());

  it("prefixes app paths with the deployment base", async () => {
    const { appPath, APP_BASE } = await load("/UNI-MATEOS/");
    expect(APP_BASE).toBe("/UNI-MATEOS/");
    expect(appPath("/dashboard")).toBe("/UNI-MATEOS/dashboard");
    expect(appPath("/grades")).toBe("/UNI-MATEOS/grades");
    expect(appPath("/")).toBe("/UNI-MATEOS/");
  });

  it("normalizes a base given without a trailing slash", async () => {
    const { APP_BASE, appPath } = await load("/UNI-MATEOS");
    expect(APP_BASE).toBe("/UNI-MATEOS/");
    expect(appPath("/login")).toBe("/UNI-MATEOS/login");
  });

  it("is idempotent, so a pre-prefixed path is not double-prefixed", async () => {
    const { appPath } = await load("/UNI-MATEOS/");
    expect(appPath("/UNI-MATEOS/dashboard")).toBe("/UNI-MATEOS/dashboard");
    expect(appPath("/UNI-MATEOS")).toBe("/UNI-MATEOS");
    // And applying it twice changes nothing.
    expect(appPath(appPath("/dashboard"))).toBe("/UNI-MATEOS/dashboard");
  });

  it("never produces a protocol-relative URL that could open-redirect", async () => {
    // appPath is applied AFTER the single-slash check in authReturnTo, so it
    // must not be able to create "//host" or smuggle a backslash. If that
    // invariant ever changed, safeReturnTo would become an open redirect.
    const { appPath } = await load("/UNI-MATEOS/");
    for (const p of ["/dashboard", "/grades", "/"]) {
      const out = appPath(p);
      expect(out.startsWith("//")).toBe(false);
      expect(out.includes("\\")).toBe(false);
    }
  });
});

describe("deployment: no root-absolute full-page navigation survives", () => {
  const files = [];
  const walk = (dir) => {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e);
      // Skip tests (their own source is full of the patterns) and the helper
      // itself, which legitimately concatenates origin + a base-aware path.
      if (statSync(p).isDirectory()) {
        if (e !== "__tests__") walk(p);
      } else if (/\.(js|jsx)$/.test(p) && !p.endsWith("appBase.js")) {
        files.push(p);
      }
    }
  };
  walk(join(process.cwd(), "src"));

  it("scans the whole src tree", () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it("no location.href/assign/replace is assigned a bare root path", () => {
    const offenders = files.filter((f) =>
      /location\.(href|assign|replace)\s*=\s*["'`]\/(?!\/)/.test(readFileSync(f, "utf8")),
    );
    expect(offenders).toEqual([]);
  });

  it("no Supabase redirect is built from a bare origin with a path", () => {
    // window.location.origin + "/x" ignores the deployment base; appUrl() is
    // the base-aware replacement.
    const offenders = files.filter((f) =>
      /location\.origin\s*\+/.test(readFileSync(f, "utf8")),
    );
    expect(offenders).toEqual([]);
  });
});
