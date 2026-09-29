// Regression cover for the entitlement chain, which was split across two
// independently-deployed edge functions and a client mirror.
//
// The bug this pins down: `lemon-squeezy`'s `status` action — the response the
// client feeds straight into `can()` — sourced `plan` from
// `user.user_metadata.plan`. That field is writable by the account owner via
// `auth.updateUser()`, so any user could self-promote the paid UI. Meanwhile
// `ai-assistant` had been fixed to read `subscriptions.tier`, leaving the two
// halves of one policy disagreeing about where the plan comes from.
//
// Second bug: both halves authorized on `tier` alone, ignoring `status`,
// `renews_at` and `cancel_at_period_end`. A `cancelled` row is entitled only
// until the period it was paid for ends, and the row is only rewritten when a
// webhook fires — so a lapsed cancellation read as Pro forever.
//
// Third bug: the three paywalled pages ran their data-loading effect above the
// `can()` early return, so a free user got real rows off the wire just by
// navigating to the page.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, resolve as resolvePath } from "node:path";

const ROOT = resolvePath(__dirname, "..", "..");
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");

/** Source with comments stripped, so prose about a fix can't satisfy a guard. */
const readCode = (rel) =>
  read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

const LEMON = "supabase/functions/lemon-squeezy/index.ts";
const AI = "supabase/functions/ai-assistant/index.ts";

// Reference implementation of the rule both edge functions must apply. The
// behavioural table below pins the *contract*; the source guards in the later
// blocks assert each function actually implements it, so neither half can drift
// away from this table without a failure.
const KEEPS_ENTITLEMENT = new Set(["on_trial", "active", "paused", "cancelled", "unpaid"]);

const effectiveTier = (subscription, now = Date.now()) => {
  if (!subscription) return "free";
  const tier = String(subscription.tier || "free").toLowerCase();
  if (tier === "free") return "free";
  const status = String(subscription.status || "");
  if (!KEEPS_ENTITLEMENT.has(status)) return "free";
  if (status === "cancelled" && subscription.renews_at) {
    const endsAt = new Date(subscription.renews_at).getTime();
    if (Number.isFinite(endsAt) && endsAt <= now) return "free";
  }
  return tier;
};

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse("2026-06-15T12:00:00.000Z");
const ago = (ms) => new Date(NOW - ms).toISOString();
const ahead = (ms) => new Date(NOW + ms).toISOString();

describe("entitlement contract", () => {
  it("grants nothing without a subscription row", () => {
    expect(effectiveTier(null, NOW)).toBe("free");
    expect(effectiveTier(undefined, NOW)).toBe("free");
  });

  it("grants nothing when the stored tier is free", () => {
    expect(effectiveTier({ tier: "free", status: "active" }, NOW)).toBe("free");
  });

  it.each([
    ["on_trial", "pro", "pro"],
    ["active", "pro", "pro"],
    ["active", "ultimate", "ultimate"],
    ["paused", "pro", "pro"],
    ["unpaid", "pro", "pro"],
  ])("keeps entitlement for status=%s tier=%s", (status, tier, expected) => {
    expect(effectiveTier({ tier, status, renews_at: ahead(DAY) }, NOW)).toBe(expected);
  });

  it.each(["expired", "on_hold", "payment_failed", "", "nonsense"])(
    "revokes entitlement for status=%j",
    (status) => {
      expect(effectiveTier({ tier: "pro", status, renews_at: ahead(DAY) }, NOW)).toBe("free");
    }
  );

  // The regression that motivated the expiry guard: the row is only rewritten
  // when a webhook fires, so a cancellation that never gets a final webhook
  // leaves tier='pro' in the database indefinitely.
  it("revokes a cancelled row once the paid period has ended", () => {
    expect(effectiveTier({ tier: "pro", status: "cancelled", renews_at: ago(DAY) }, NOW)).toBe("free");
  });

  it("keeps a cancelled row entitled until the period ends", () => {
    expect(effectiveTier({ tier: "pro", status: "cancelled", renews_at: ahead(DAY) }, NOW)).toBe("pro");
  });

  it("treats a cancelled row with no renews_at as still inside the paid period", () => {
    expect(effectiveTier({ tier: "pro", status: "cancelled", renews_at: null }, NOW)).toBe("pro");
  });

  it("does not expiry-check active rows", () => {
    // An active subscription's renews_at is the NEXT billing date. A stale or
    // missing value must not revoke a paying customer, so the guard is
    // deliberately scoped to terminating states only.
    expect(effectiveTier({ tier: "pro", status: "active", renews_at: ago(30 * DAY) }, NOW)).toBe("pro");
    expect(effectiveTier({ tier: "pro", status: "active" }, NOW)).toBe("pro");
  });
});

describe("lemon-squeezy status action sources the plan server-side", () => {
  it("does not read the caller-writable user_metadata plan", () => {
    const source = readCode(LEMON);
    // The regression: this value went to the client as `plan`, which is what
    // can() decides on, so any user could grant themselves a tier.
    expect(source).not.toMatch(/user\.user_metadata/);
  });

  it("derives the status plan from the subscription row", () => {
    const source = readCode(LEMON);
    expect(source).toMatch(/const plan = effectiveTier\(sub\)/);
  });

  it("derives staff entitlement server-side, never from anything the client sends", () => {
    const source = readCode(LEMON);
    // `entitled` is the gate the client runs on, so it has to stay the same
    // rule the database enforces: is_admin() OR a live subscription. The admin
    // side is read with the service role from admin_accounts, which the caller
    // cannot write.
    expect(source).toMatch(/entitled:\s*admin \|\| plan !== "free"/);
    expect(source).toMatch(/from\("admin_accounts"\)/);
    expect(source).toMatch(/\.eq\("enabled", true\)/);
  });

  it("still reads the subscription when billing is unconfigured", () => {
    // Otherwise a user entitled before the env vars were lost would silently
    // drop to "free" because isConfigured() short-circuited the lookup.
    const source = readCode(LEMON);
    const statusBlock = source.slice(source.indexOf('action === "status"'));
    expect(statusBlock).toMatch(/readSubscriptionForUser/);
    expect(statusBlock).not.toMatch(/if\s*\(!configured\)\s*return/);
  });

  it("mirrors the plan into user_metadata as a write-only display value", () => {
    // setEntitlement still writes it for the profile UI. That is fine — the
    // danger was only ever *authorizing* on it.
    const source = readCode(LEMON);
    expect(source).toMatch(/user_metadata/);
  });
});

describe("ai-assistant applies the same rule", () => {
  it("selects the columns the expiry guard needs", () => {
    const source = readCode(AI);
    expect(source).toMatch(/select\("tier,\s*status,\s*renews_at"\)/);
  });

  it("still authorizes on the caller's own row", () => {
    const source = readCode(AI);
    expect(source).toMatch(/from\("subscriptions"\)/);
    expect(source).toMatch(/\.eq\("user_id",\s*user\.id\)/);
  });

  it("applies the cancelled-period expiry guard", () => {
    const source = readCode(AI);
    expect(source).toMatch(/status === "cancelled"/);
    expect(source).toMatch(/renews_at/);
  });
});

describe("both functions agree on which statuses keep entitlement", () => {
  // The two functions deploy independently and share no module, so the rule is
  // duplicated. This asserts the two copies have not drifted: a status added
  // to one and forgotten in the other would silently lock paying users out of
  // one surface while they keep access to the other.
  it("use an identical KEEPS_ENTITLEMENT set", () => {
    // Extract the array literal that actually holds the statuses, rather than a
    // loose window: a widened window picks up unrelated strings (e.g. the
    // "free" default on the adjacent line) and reports a false drift.
    const statusesIn = (source) => {
      const at = source.indexOf("on_trial");
      expect(at).toBeGreaterThan(-1);
      const open = source.lastIndexOf("[", at);
      const close = source.indexOf("]", at);
      expect(open).toBeGreaterThan(-1);
      expect(close).toBeGreaterThan(at);
      return new Set([...source.slice(open, close + 1).matchAll(/"([a-z_]+)"/g)].map((m) => m[1]));
    };
    expect(statusesIn(readCode(LEMON))).toEqual(statusesIn(readCode(AI)));
  });
});

describe("paywalled pages do not fetch before the gate", () => {
  const pages = [
    ["src/pages/Flashcards.jsx", "flashcards"],
    ["src/pages/StudyPlanner.jsx", "smart_planning"],
    ["src/pages/Analytics.jsx", "advanced_analytics"],
  ];

  it.each(pages)("%s skips its load effect when not entitled", (rel, feature) => {
    const source = readCode(rel);
    // The lock screen is an early return, so an unguarded effect above it still
    // fires and hands a free user real rows.
    expect(source).toMatch(/if\s*\(!allowed\)\s*return;/);
    expect(source).toMatch(/useEffect\(\(\)\s*=>\s*\{[^}]*if\s*\(!allowed\)/);
    expect(source).toMatch(/\[load,\s*allowed\]/);
  });

  it.each(pages)("%s derives a stable boolean from can()", (rel, feature) => {
    const source = readCode(rel);
    // `can` is an inline arrow, so it is a fresh closure every render. Putting
    // it in the dependency array would refetch on every render.
    expect(source).toMatch(new RegExp(`const allowed = can\\("${feature}"\\)`));
    expect(source).not.toMatch(/\[load,\s*can\]/);
  });
});

describe("free-tier data is not accidentally locked down", () => {
  // advanced_analytics reads focus_sessions/tasks/grades/courses, which are
  // also the primary data for free-tier Focus, Tasks, Grades and Courses.
  // Gating those tables' RLS would break those features, so the gate belongs
  // on the derived read, not the underlying rows. This pins that decision.
  const freeTierTables = ["focus_sessions", "tasks", "grades", "courses"];

  it.each(freeTierTables)("%s RLS stays ownership-only, with no tier check", (table) => {
    const schema = read("supabase/schema.sql");
    const policies = schema.match(
      new RegExp(`CREATE POLICY[^;]*ON public\\.${table}[^;]*;`, "gi")
    ) || [];
    expect(policies.length).toBeGreaterThan(0);
    for (const policy of policies) {
      expect(policy).not.toMatch(/tier|entitlement|subscriptions/i);
    }
  });
});
