import { describe, it, expect } from "vitest";

import { ROLES, PERMISSIONS, permissionsFor, can, isKnownPermission, principalFrom, ALL_PERMISSIONS, DEFAULT_ADMIN_PERMISSIONS } from "@/lib/admin/permissions";
import { DEFAULT_FLAGS, PLAN_FLOORS, hashPct, normalizeFlag, evaluateFlag, featuresEnabled, upsertFlag, flagRow } from "@/lib/admin/featureFlags";
import { auditEntry, logAudit, withAudit, recentAudit, filterAudit, EMPTY_AUDIT } from "@/lib/admin/auditLog";
import { providerTier, reconcile, reconcileEntitlement, normalizeSubscription } from "@/lib/admin/reconcile";
import { REPORT_TRANSITIONS, CONTENT_TRANSITIONS, nextReportStatuses, nextContentStatuses, canModerate, moderateReport, moderateContent, toggleBlocked, historyEntry } from "@/lib/admin/moderation";
import { ACCOUNT_TRANSITIONS, ACCOUNT_STATUS, ACTION_PHRASES, transitionAccount, deleteConsequences, confirmPhrase, applyStatus } from "@/lib/admin/users";
import { PULSE, PULSE_LABELS, classify, worstOf, runPulse, overallLabel, envConfigured } from "@/lib/admin/pulse";
import { countsByDay, totals, planDistribution, sumField, usageBars, newUsers, activeUsers, onboarding } from "@/lib/admin/metrics";
import { SEVERITIES, AUDIENCES, isActive, audienceMatches, activeFor, normalizeAnnouncement, announcementRow, validateAnnouncement } from "@/lib/admin/announcements";
import { commandIndex, searchIndex, pushRecent, routeGuess } from "@/lib/admin/search";

const fakeRepo = (initial = {}) => {
  const store = {};
  Object.entries(initial).forEach(([table, rows]) => store[table] = rows.map((r) => ({ ...r })));
  let fail = false;
  return {
    store,
    get list() { return async (table) => (store[table] || []).map((r) => ({ ...r })); },
    get create() {
      return async (table, record) => {
        if (fail) throw new Error("nope");
        const rows = store[table] || (store[table] = []);
        rows.push({ ...record });
        return { ...record };
      };
    },
    get update() {
      return async (table, id, patch) => {
        if (fail) throw new Error("nope");
        const rows = store[table] || (store[table] = []);
        const i = rows.findIndex((r) => String(r.id) === String(id));
        if (i < 0) return null;
        rows[i] = { ...rows[i], ...patch };
        return { ...rows[i] };
      };
    },
    failWrites() { fail = true; return this; },
  };
};

describe("admin/permissions", () => {
  it("super_admin gets every permission", () => {
    expect(permissionsFor({ role: ROLES.SUPER_ADMIN })).toEqual(ALL_PERMISSIONS);
    expect(permissionsFor({ role: ROLES.ADMIN, isSuper: true })).toEqual(ALL_PERMISSIONS);
  });

  it("explicit admin permission set is honored", () => {
    const set = [PERMISSIONS.USERS_READ, PERMISSIONS.BILLING_READ];
    expect(permissionsFor({ role: ROLES.ADMIN, permissions: set })).toEqual(set);
  });

  it("admin without an explicit set gets the default (never system.manage)", () => {
    const granted = permissionsFor({ role: ROLES.ADMIN });
    expect(granted).toEqual(DEFAULT_ADMIN_PERMISSIONS);
    expect(granted).not.toContain(PERMISSIONS.SYSTEM_MANAGE);
  });

  it("unknown roles get nothing", () => {
    expect(permissionsFor({ role: "student" })).toEqual([]);
    expect(permissionsFor({})).toEqual([]);
  });

  it("can() answers from the principal's role", () => {
    const admin = { role: ROLES.ADMIN, permissions: [PERMISSIONS.USERS_MANAGE] };
    expect(can(admin, PERMISSIONS.USERS_MANAGE)).toBe(true);
    expect(can(admin, PERMISSIONS.SYSTEM_MANAGE)).toBe(false);
    const superAdmin = { role: ROLES.SUPER_ADMIN };
    expect(can(superAdmin, PERMISSIONS.SYSTEM_MANAGE)).toBe(true);
    expect(can({ role: "user" }, PERMISSIONS.USERS_READ)).toBe(false);
  });

  it("isKnownPermission accepts catalog keys only", () => {
    expect(isKnownPermission(PERMISSIONS.AI_MANAGE)).toBe(true);
    expect(isKnownPermission("root")).toBe(false);
  });

  it("principalFrom honors source and strips hosted non-admins", () => {
    const hosted = principalFrom({ role: ROLES.ADMIN, source: "hosted" });
    expect(hosted.isAdmin).toBe(true);
    expect(hosted.source).toBe("hosted");
    expect(principalFrom({ role: "user", source: "hosted" }).isAdmin).toBe(false);
    expect(principalFrom({ role: "user", source: "hosted" }).permissions).toEqual([]);
  });

  it("local source is dev-flagged and never server-enforced", () => {
    const local = principalFrom({ role: ROLES.ADMIN, source: "local" });
    expect(local.isAdmin).toBe(true);
    expect(local.source).toBe("local");
    expect(principalFrom({}, "none")).toBeTruthy();
    expect(principalFrom({}).isAdmin).toBe(false);
  });
});

describe("admin/featureFlags", () => {
  it("PLAN_FLOORS and DEFAULT_FLAGS are consistent", () => {
    expect(PLAN_FLOORS).toEqual(["free", "pro", "ultimate", "admins"]);
    Object.values(DEFAULT_FLAGS).forEach((f) => expect(PLAN_FLOORS).toContain(f.planFloor));
  });

  it("hashPct is deterministic and bounded", () => {
    expect(hashPct("community", "user-1")).toBe(hashPct("community", "user-1"));
    expect(hashPct("community", "user-1")).toBeGreaterThanOrEqual(0);
    expect(hashPct("community", "user-1")).toBeLessThan(100);
    expect(hashPct("community", "user-1")).not.toBe(hashPct("other", "user-1"));
  });

  it("evaluateFlag honors enabled/disabled", () => {
    expect(evaluateFlag({ ...DEFAULT_FLAGS.ai_assistant, enabled: false })).toEqual({ enabled: false, reason: "disabled" });
    expect(evaluateFlag({ ...DEFAULT_FLAGS.community, enabled: true }).enabled).toBe(true);
  });

  it("env gating restricts to listed environments only", () => {
    const flag = { key: "gated", enabled: true, planFloor: "free", envs: ["development", "preview"] };
    expect(evaluateFlag(flag, { env: "development" }).enabled).toBe(true);
    expect(evaluateFlag(flag, { env: "production" })).toEqual({ enabled: false, reason: "env:production" });
  });

  it("admins-only floor requires an admin", () => {
    const flag = { key: "x", enabled: true, planFloor: "admins" };
    expect(evaluateFlag(flag, { isAdmin: true }).enabled).toBe(true);
    expect(evaluateFlag(flag, { isAdmin: false })).toEqual({ enabled: false, reason: "admins_only" });
  });

  it("plan floor gates pro+ flags", () => {
    const flag = DEFAULT_FLAGS.ai_assistant; // planFloor: pro
    expect(evaluateFlag(flag, { plan: "ultimate" }).enabled).toBe(true);
    expect(evaluateFlag(flag, { plan: "pro" }).enabled).toBe(true);
    expect(evaluateFlag(flag, { plan: "free" })).toEqual({ enabled: false, reason: "plan:free" });
  });

  it("rollout percentage closes deterministically per user", () => {
    expect(evaluateFlag({ key: "rolled", enabled: true, planFloor: "free", rolloutPct: 100 }, { userId: "u" }).enabled).toBe(true);
    expect(evaluateFlag({ key: "rolled", enabled: true, planFloor: "free", rolloutPct: 0 }, { userId: "u" }).enabled).toBe(false);
    const mid = evaluateFlag({ key: "rolled", enabled: true, planFloor: "free", rolloutPct: 50 }, { userId: "u" });
    expect(mid.reason === "rollout").toBe(true);
    expect(evaluateFlag({ key: "rolled", enabled: true, planFloor: "free", rolloutPct: 50 })).toEqual({ enabled: false, reason: "rollout_no_user" });
  });

  it("normalizeFlag maps snake_case rows", () => {
    expect(normalizeFlag({ key: "k", plan_floor: "pro", rollout_pct: 20, envs: ["preview"], description: "d", enabled: true }))
      .toEqual({ key: "k", enabled: true, planFloor: "pro", rolloutPct: 20, envs: ["preview"], description: "d" });
  });

  it("featuresEnabled evaluates a whole set", () => {
    const flags = [
      { key: "ai_assistant", ...DEFAULT_FLAGS.ai_assistant },
      { key: "experimental_analytics", ...DEFAULT_FLAGS.experimental_analytics },
    ];
    const out = featuresEnabled(flags, { plan: "free" });
    expect(out.ai_assistant.enabled).toBe(false);
    // env-restricted + admins-only floor: both must be satisfied, and flags never grant access
    const exp = () => ({ key: "experimental_analytics", ...DEFAULT_FLAGS.experimental_analytics, enabled: true });
    const gated = featuresEnabled([exp()], { plan: "free", env: "development" });
    expect(gated.experimental_analytics).toEqual({ enabled: false, reason: "admins_only" });
    const asAdmin = featuresEnabled([exp()], { plan: "free", env: "development", isAdmin: true });
    expect(asAdmin.experimental_analytics.enabled).toBe(true);
    // …but off in production even for admins
    const prod = featuresEnabled([exp()], { plan: "free", env: "production", isAdmin: true });
    expect(prod.experimental_analytics).toEqual({ enabled: false, reason: "env:production" });
  });

  it("upsertFlag is idempotent by key and flagRow round-trips", () => {
    const a = upsertFlag([], { key: "demo", enabled: true, planFloor: "free", rolloutPct: 100, envs: [], description: "d" });
    const b = upsertFlag(a, { key: "demo", enabled: false, planFloor: "pro", rolloutPct: 10, envs: ["development"], description: "new" });
    expect(b).toHaveLength(1);
    expect(b[0].enabled).toBe(false);
    expect(flagRow({ ...b[0] })).toMatchObject({ key: "demo", enabled: false, plan_floor: "pro", rollout_pct: 10, envs: ["development"], description: "new" });
  });
});

describe("admin/auditLog", () => {
  it("auditEntry builds a stable writeable row", () => {
    const now = () => "2026-09-22T10:00:00Z";
    const e = auditEntry({ action: "user.suspend", targetType: "User", targetId: 7, actor: "adm", now });
    expect(e.actor_id).toBe("adm");
    expect(e.action).toBe("user.suspend");
    expect(e.target_type).toBe("User");
    expect(e.target_id).toBe("7");
    expect(e.result).toBe("success");
    expect(e.created_at).toBe("2026-09-22T10:00:00Z");
  });

  it("logAudit persists via repo and survives unset actor", async () => {
    const repo = fakeRepo();
    expect(await logAudit({ repo }, auditEntry({ action: "flag.update" }))).toBe(true);
    expect(repo.store.AuditLog).toHaveLength(1);
  });

  it("logAudit returns false (never throws) when repo/action missing or broken", async () => {
    expect(await logAudit({ repo: null }, auditEntry({ action: "x" }))).toBe(false);
    expect(await logAudit({ repo: {} }, {})).toBe(false);
    const failing = fakeRepo().failWrites();
    expect(await logAudit({ repo: failing }, auditEntry({ action: "x" }))).toBe(false);
  });

  it("withAudit records outcome and keeps the failure honest", async () => {
    const repo = fakeRepo();
    const r = await withAudit({ repo }, auditEntry({ action: "reconcile.entitlement" }), async () => ({ ok: true, value: 1 }));
    expect(r).toMatchObject({ ok: true, audited: true, value: 1 });
    expect(repo.store.AuditLog[0].result).toBe("success");

    const failed = await withAudit({ repo }, auditEntry({ action: "user.delete" }), async () => ({ ok: false, error: new Error("boom") }));
    expect(failed.ok).toBe(false);
    expect(failed.audited).toBe(true);
    expect(repo.store.AuditLog[1].result).toBe("failed");
    expect(repo.store.AuditLog[1].meta.error).toMatch(/boom/);
  });

  it("recentAudit sorts newest-first and clamps the limit", async () => {
    const repo = fakeRepo({ AuditLog: [
      { action: "a", created_at: "2026-09-01T00:00:00Z" },
      { action: "b", created_at: "2026-09-03T00:00:00Z" },
      { action: "c", created_at: "2026-09-02T00:00:00Z" },
    ] });
    const { entries } = await recentAudit({ repo }, 2);
    expect(entries.map((e) => e.action)).toEqual(["b", "c"]);
  });

  it("filterAudit narrows by action, result and free-text", () => {
    const rows = [
      { action: "flag.update", result: "success", target_type: "FeatureFlag", target_id: "x", actor_id: "a" },
      { action: "user.delete", result: "failed", target_type: "User", target_id: "9", actor_id: "a" },
    ];
    expect(filterAudit(rows, { action: "flag.update" })).toHaveLength(1);
    expect(filterAudit(rows, { result: "failed" })).toHaveLength(1);
    expect(filterAudit(rows, { q: "user" })).toHaveLength(1);
  });

  it("EMPTY_AUDIT is the safe default", () => {
    expect(EMPTY_AUDIT).toEqual({ entries: [] });
  });
});

describe("admin/reconcile", () => {
  it("providerTier maps variant ids and rejects unknown", () => {
    const v = { pro: "1000", ultimate: "2000" };
    expect(providerTier({ data: { attributes: { variant_id: "1000" } } }, v)).toBe("pro");
    expect(providerTier({ data: { attributes: { variant_id: "2000" } } }, v)).toBe("ultimate");
    expect(providerTier({ data: { attributes: { variant_id: "9999" } } }, v)).toBe(null);
    expect(providerTier({}, v)).toBe(null);
  });

  it("clean chain reconciles without mismatches", () => {
    const r = reconcile({ provider: { tier: "pro", status: "active" }, subscription: { tier: "pro", status: "active" }, entitlement: "pro" });
    expect(r.ok).toBe(true);
    expect(r.mismatches).toEqual([]);
    expect(r.matches).toContain("entitlement-in-line");
    expect(r.suggestedPlan).toBe("pro");
  });

  it("unknown provider never guesses or changes the plan", () => {
    const r = reconcile({ provider: null, subscription: { tier: "pro" }, entitlement: "pro" });
    expect(r.ok).toBe(false);
    expect(r.mismatches[0].area).toBe("provider");
    expect(r.suggestedPlan).toBe("pro");
  });

  it("expired or unknown-variant provider keeps access as-is", () => {
    expect(reconcile({ provider: { tier: "pro", status: "expired" }, subscription: { tier: "pro" }, entitlement: "ultimate" }).suggestedPlan).toBe("free");
    expect(reconcile({ provider: { status: "active", tier: null }, entitlement: "pro" }).suggestedPlan).toBe("pro");
  });

  it("entitlement off from provider suggests reconcile-entitlement only", () => {
    const r = reconcile({ provider: { tier: "ultimate", status: "active" }, subscription: { tier: "ultimate" }, entitlement: "pro" });
    expect(r.mismatches.map((m) => m.area)).toContain("entitlement");
    expect(r.suggestedPlan).toBe("ultimate");
    expect(r.mismatches.every((m) => m.action !== "reconcile-entitlement" || m.area === "entitlement")).toBe(true);
  });

  it("missing subscription record is reported, never fabricated", () => {
    const r = reconcile({ provider: { tier: "pro", status: "active" }, subscription: null, entitlement: "free" });
    expect(r.mismatches.map((m) => m.area)).toEqual(["subscription", "entitlement"]);
  });

  it("reconcileEntitlement normalizes plan and never fabricates billing", () => {
    expect(reconcileEntitlement({ plan: "ultra" })).toEqual({ ok: true, plan: "ultimate", changed: true });
    expect(reconcileEntitlement({ plan: "pro" })).toEqual({ ok: true, plan: "pro", changed: false });
  });

  it("normalizeSubscription handles snake_case and cancelAtPeriodEnd", () => {
    expect(normalizeSubscription({ tier: "pro", cancel_at_period_end: true, renews_at: "2027-01-01" }))
      .toEqual({ tier: "pro", status: "unknown", cancelAtPeriodEnd: true, renewsAt: "2027-01-01" });
  });
});

describe("admin/moderation", () => {
  it("report/content transitions are closed sets", () => {
    expect(REPORT_TRANSITIONS.open).toEqual(["reviewed", "dismissed"]);
    expect(CONTENT_TRANSITIONS.removed).toEqual([]);
    expect(nextReportStatuses("reviewed")).toEqual(["dismissed", "open"]);
    expect(nextContentStatuses("active")).toEqual(["hidden", "removed"]);
  });

  it("canModerate respects roles for destructive removal", () => {
    expect(canModerate({ isAdmin: true, role: ROLES.ADMIN }, "hide")).toBe(true);
    expect(canModerate({ isAdmin: true, role: ROLES.ADMIN }, "remove")).toBe(false);
    expect(canModerate({ isAdmin: true, role: ROLES.SUPER_ADMIN }, "remove")).toBe(true);
    expect(canModerate({ isAdmin: false }, "hide")).toBe(false);
  });

  it("moderateReport/moderateContent enforce the FSM", () => {
    expect(moderateReport({ status: "open" }, "dismissed").ok).toBe(true);
    expect(moderateReport({ status: "dismissed" }, "dismissed").ok).toBe(false);
    expect(moderateContent({ status: "active" }, "removed").reason).toMatch(/content\.removed/);
    expect(moderateContent({ status: "removed" }, "active").ok).toBe(false);
  });

  it("toggleBlocked/ historyEntry are pure helpers", () => {
    expect(toggleBlocked(["a"], "b")).toEqual(["a", "b"]);
    expect(toggleBlocked(["a"], "a")).toEqual([]);
    const h = historyEntry({ actor: "a", action: "hide", targetType: "Post", targetId: "1", reason: "report.42", now: () => "2026T" });
    expect(h).toMatchObject({ actor: "a", action: "hide", target_type: "Post", target_id: "1", reason: "report.42", at: "2026T" });
  });
});

describe("admin/users", () => {
  it("account status transitions are guarded", () => {
    expect(ACCOUNT_STATUS).toEqual(["active", "suspended", "disabled"]);
    expect(ACCOUNT_TRANSITIONS.suspended).toEqual(["active", "disabled"]);
    expect(transitionAccount({ status: "suspended" }, "active").ok).toBe(true);
    expect(transitionAccount({ status: "disabled" }, "suspended").ok).toBe(false);
    expect(transitionAccount({}, "suspended").ok).toBe(true);
  });

  it("deleteConsequences never implies zero-cost deletion", () => {
    const c = deleteConsequences({ Course: 3, Task: 0, Note: 2 });
    expect(c.total).toBe(5);
    expect(c.counts.map((r) => r.table)).toEqual(["Course", "Note"]);
    expect(c.phrase).toBe(ACTION_PHRASES.DELETE);
  });

  it("confirmPhrase is exact and case-sensitive", () => {
    expect(confirmPhrase("DELETE USER", "DELETE USER")).toBe(true);
    expect(confirmPhrase("delete user", "DELETE USER")).toBe(false);
  });

  it("applyStatus writes only legal transitions", async () => {
    const repo = fakeRepo({ User: [{ id: "u1", status: "active" }] });
    const r = await applyStatus({ repo }, "u1", "suspended");
    expect(r.ok).toBe(true);
    expect(repo.store.User[0].status).toBe("suspended");
    const bad = await applyStatus({ repo }, "u1", "suspended");
    expect(bad.ok).toBe(false);
  });

  it("applyStatus survives missing repo", async () => {
    expect(await applyStatus({ repo: null }, "u1", "suspended")).toEqual({ ok: false, row: null, error: "no repo" });
  });
});

describe("admin/pulse", () => {
  it("classify is honest about each signal", () => {
    expect(classify({ configured: true, reachable: true })).toBe(PULSE.OPERATIONAL);
    expect(classify({ configured: true, reachable: false })).toBe(PULSE.UNAVAILABLE);
    expect(classify({ configured: false })).toBe(PULSE.NOT_CONFIGURED);
    expect(classify({ configured: true, reachable: true, degraded: true })).toBe(PULSE.DEGRADED);
    expect(classify({})).toBe(PULSE.UNKNOWN);
  });

  it("worstOf ranks deterministic", () => {
    expect(worstOf([PULSE.OPERATIONAL, PULSE.DEGRADED])).toBe(PULSE.DEGRADED);
    expect(worstOf([PULSE.OPERATIONAL, PULSE.UNAVAILABLE])).toBe(PULSE.UNAVAILABLE);
    expect(worstOf([PULSE.OPERATIONAL])).toBe(PULSE.OPERATIONAL);
  });

  it("runPulse aggregates and overallLabel formats", () => {
    const { items, overall } = runPulse([
      () => ({ id: "db", label: "Database", status: classify({ reachable: true }) }),
      () => ({ id: "edge", label: "Edge", status: classify({ configured: false }) }),
    ]);
    expect(items).toHaveLength(2);
    expect(overall).toBe(PULSE.NOT_CONFIGURED);
    expect(overallLabel(overall)).toBe("NOT CONFIGURED");
  });

  it("envConfigured requires both url and key", () => {
    expect(envConfigured({ url: "u", key: "k" })).toBe(true);
    expect(envConfigured({ url: "u" })).toBe(false);
  });
});

describe("admin/metrics", () => {
  it("countsByDay buckets strictly past N days", () => {
    const rows = [{ created_at: "2026-09-20T00:00:00Z" }, { created_at: "2026-09-21T00:00:00Z" }, { created_at: "2026-09-22T00:00:00Z" }];
    // Use a fixed "today" by computing relative to now — the function is relative.
    const out = countsByDay(rows, "created_at", 3);
    expect(out).toHaveLength(3);
    expect(out.reduce((s, b) => s + b.count, 0)).toBe(3);
  });

  it("totals reports null (no telemetry) separately from zero", () => {
    expect(totals({ Tasks: [], AI: null })).toEqual({ Tasks: 0, AI: null });
  });

  it("planDistribution buckets tiers", () => {
    expect(planDistribution([{ plan: "ultimate" }, { plan: "pro" }, {}, { user_metadata: { plan: "pro" } }]))
      .toEqual({ free: 1, pro: 2, ultimate: 1 });
  });

  it("sumField / usageBars / newUsers / activeUsers are honest aggregations", () => {
    expect(sumField([{ minutes: 10 }, { minutes: 5 }], "minutes")).toBe(15);
    const bars = usageBars({ Tasks: 12, AI: null }, { Tasks: "Tasks", AI: "AI" });
    expect(bars).toEqual([{ label: "Tasks", count: 12 }]);
    expect(newUsers([], 7)).toBe(0);
    const users = [{ last_active_at: new Date().toISOString() }, { last_active_at: "2000-01-01T00:00:00Z" }];
    const since = new Date(Date.now() - 3600e3).toISOString();
    expect(activeUsers(users, { since })).toBe(1);
    expect(activeUsers(users)).toBe(null);
  });

  it("onboarding aggregates completion", () => {
    expect(onboarding([{ onboarded_at: "x" }, {}])).toEqual({ completed: 1, total: 2 });
  });
});

describe("admin/announcements", () => {
  it("severity/audience catalogs are fixed", () => {
    expect(SEVERITIES).toEqual(["info", "notice", "maintenance", "important"]);
    expect(AUDIENCES).toEqual(["all", "free", "pro", "ultimate", "admins"]);
  });

  it("isActive respects the window", () => {
    expect(isActive({ startAt: "2026-01-01", endAt: "2027-01-01" }, { now: "2026-06-01" })).toBe(true);
    expect(isActive({ startAt: "2026-01-01" }, { now: "2025-01-01" })).toBe(false);
    expect(isActive({ endAt: "2026-01-01" }, { now: "2027-01-01" })).toBe(false);
    expect(isActive({}, { now: "2026-01-01" })).toBe(true);
  });

  it("audienceMatches gates admins and plans", () => {
    expect(audienceMatches({ audience: "admins" }, { isAdmin: true })).toBe(true);
    expect(audienceMatches({ audience: "admins" }, { isAdmin: false })).toBe(false);
    expect(audienceMatches({ audience: "pro" }, { plan: "ultimate" })).toBe(true);
    expect(audienceMatches({ audience: "pro" }, { plan: "free" })).toBe(false);
  });

  it("activeFor returns matched, severity-sorted announcements", () => {
    const all = [
      { title: "minor", severity: "info", audience: "all", startAt: "2026-01-01" },
      { title: "admins-only", severity: "important", audience: "admins", startAt: "2026-01-01" },
      { title: "future", severity: "maintenance", audience: "all", startAt: "2030-01-01" },
    ];
    const got = activeFor(all, { now: "2026-02-01", plan: "pro", isAdmin: false });
    expect(got.map((a) => a.title)).toEqual(["minor"]);
  });

  it("normalize/announcementRow/validate round-trip and validate", () => {
    expect(normalizeAnnouncement({ severity: "maintenance" }).severity).toBe("maintenance");
    expect(validateAnnouncement({ title: "hello" }).ok).toBe(true);
    const bad = validateAnnouncement({ title: "", startAt: "2026-02-01", endAt: "2026-01-01" });
    expect(bad.ok).toBe(false);
    expect(bad.errors).toEqual(expect.arrayContaining(["title", "window"]));
  });
});

describe("admin/search", () => {
  const sections = [
    { id: "overview", label: "Overview", path: "/admin", keywords: ["dashboard", "pulse"], permission: PERMISSIONS.SYSTEM_READ, actions: [{ label: "System pulse", to: "#pulse", keywords: ["health"], quick: true }] },
    { id: "users", label: "Users", path: "/admin/users", keywords: ["accounts"], permission: PERMISSIONS.USERS_READ, actions: [] },
  ];

  it("commandIndex builds sections + actions with hrefs", () => {
    const idx = commandIndex({ routeLink: (p, to) => (to ? p + to : p), sections });
    expect(idx.map((i) => i.label)).toEqual(["Overview", "System pulse", "Users"]);
    expect(idx.find((i) => i.label === "System pulse").href).toBe("/admin#pulse");
    expect(idx.find((i) => i.label === "Users").href).toBe("/admin/users");
  });

  it("searchIndex ranks and honors the permission filter", () => {
    const idx = commandIndex({ routeLink: (p) => p, sections });
    const filtered = searchIndex(idx, "users", { filter: (i) => can({ role: ROLES.ADMIN }, i.permission) });
    expect(filtered.map((i) => i.label)).toEqual(["Users"]);
    expect(searchIndex(idx, "nope")).toEqual([]);
    expect(searchIndex(idx)).toEqual([]);
  });

  it("pushRecent keeps an LRU list", () => {
    expect(pushRecent([], "users")).toEqual(["users"]);
    expect(pushRecent(["users", "flags"], "users")).toEqual(["users", "flags"]);
    expect(pushRecent(["users", "flags"], "billing").length).toBeLessThanOrEqual(8);
  });

  it("routeGuess splits custom +entity jumps", () => {
    expect(routeGuess("pro+abc", { searchPath: "/admin/users/" })).toEqual({ term: "pro", exactHref: "/admin/users/abc" });
    expect(routeGuess("", { searchPath: "/admin/users/" })).toBe(null);
  });
});