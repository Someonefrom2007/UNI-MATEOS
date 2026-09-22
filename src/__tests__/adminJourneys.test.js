import { describe, it, expect } from "vitest";

import { ROLES, PERMISSIONS, can } from "@/lib/admin/permissions";
import { localDevPrincipal, adminEnv, confirmWeight, shapeHostedPrincipal } from "@/lib/admin/principal";
import { SECTIONS, permittedSections } from "@/lib/admin/sections";
import { auditEntry, withAudit, recentAudit } from "@/lib/admin/auditLog";
import { applyStatus, deleteConsequences, confirmPhrase } from "@/lib/admin/users";
import { providerTier, normalizeSubscription, reconcile, reconcileEntitlement } from "@/lib/admin/reconcile";
import { canModerate, moderateReport, moderateContent, toggleBlocked, historyEntry } from "@/lib/admin/moderation";
import { upsertFlag, normalizeFlag, evaluateFlag, featuresEnabled, DEFAULT_FLAGS, flagRow } from "@/lib/admin/featureFlags";
import { validateAnnouncement, announcementRow, normalizeAnnouncement, activeFor } from "@/lib/admin/announcements";

// Small in-memory repository standing in for the app repo (hosted or local).
const fakeRepo = (initial = {}) => {
  const store = {};
  Object.entries(initial).forEach(([table, rows]) => (store[table] = rows.map((r) => ({ ...r }))));
  return {
    store,
    list: async (table) => (store[table] || []).map((r) => ({ ...r })),
    create: async (table, record) => {
      const rows = store[table] || (store[table] = []);
      rows.push({ ...record });
      return { ...record };
    },
    update: async (table, id, patch) => {
      const rows = store[table] || (store[table] = []);
      const i = rows.findIndex((r) => String(r.id) === String(id));
      if (i < 0) return null;
      rows[i] = { ...rows[i], ...patch };
      return { ...rows[i] };
    },
  };
};

describe("admin/journeys", () => {
  it("A · access: denied without a server-granted identity, granted for roster admins, local stays dev-marked", () => {
    // Someone opens /admin with no verified identity (or an unconfigured schema).
    const unknown = shapeHostedPrincipal({});
    expect(unknown.isAdmin).toBe(false);
    expect(can(unknown, PERMISSIONS.SYSTEM_READ)).toBe(false);
    expect(permittedSections(unknown)).toEqual([]);

    // An authenticated student — still not on the admin roster.
    const student = shapeHostedPrincipal({ role: "user" });
    expect(student.isAdmin).toBe(false);
    expect(can(student, PERMISSIONS.USERS_READ)).toBe(false);

    // A production super-admin gets every section and heavy confirmations.
    const superAdmin = shapeHostedPrincipal({ role: ROLES.SUPER_ADMIN });
    expect(superAdmin.isAdmin).toBe(true);
    expect(can(superAdmin, PERMISSIONS.SYSTEM_MANAGE)).toBe(true);
    expect(permittedSections(superAdmin)).toHaveLength(SECTIONS.length);
    expect(confirmWeight(adminEnv({ hosted: true, envName: "production" }))).toBe("heavy");

    // The local workspace remains explicitly unenforced.
    const local = localDevPrincipal();
    expect(local.source).toBe("local");
    expect(confirmWeight(adminEnv({}))).toBe("light");
  });

  it("B · user lifecycle: suspend → restore → disable is audited; deletion needs an exact phrase", async () => {
    const repo = fakeRepo({ User: [{ id: "u1", status: "active" }] });

    const suspended = await withAudit({ repo }, auditEntry({ action: "user.suspend", targetType: "User", targetId: "u1", actor: "adm" }), () => applyStatus({ repo }, "u1", "suspended"));
    expect(suspended.ok).toBe(true);
    expect(repo.store.User[0].status).toBe("suspended");

    const restored = await withAudit({ repo }, auditEntry({ action: "user.restore", targetType: "User", targetId: "u1", actor: "adm" }), () => applyStatus({ repo }, "u1", "active"));
    expect(restored.ok).toBe(true);
    expect(repo.store.User[0].status).toBe("active");

    const disabled = await withAudit({ repo }, auditEntry({ action: "user.disable", targetType: "User", targetId: "u1", actor: "adm" }), () => applyStatus({ repo }, "u1", "disabled"));
    expect(disabled.ok).toBe(true);
    // Suspending a disabled account is illegal.
    expect((await applyStatus({ repo }, "u1", "suspended")).ok).toBe(false);

    // Deletion is never one click: consequences are shown, the phrase must match exactly.
    const consequences = deleteConsequences({ Course: 3, Task: 0, Note: 2 });
    expect(consequences.total).toBe(5);
    expect(confirmPhrase("delete user", consequences.phrase)).toBe(false);
    expect(confirmPhrase(consequences.phrase, consequences.phrase)).toBe(true);

    // Every sensitive action above left an append-only audit trail.
    const { entries } = await recentAudit({ repo }, 10);
    const actions = entries.map((e) => e.action);
    expect(actions).toHaveLength(3);
    expect(new Set(actions)).toEqual(new Set(["user.disable", "user.restore", "user.suspend"]));
  });

  it("C · billing: the provider decides, the console reconciles the chain and only adjusts entitlements", async () => {
    const repo = fakeRepo({ Subscription: [] });
    const variantMap = { pro: "1000", ultimate: "2000" };

    // A webhook proves the user is on Pro.
    const tier = providerTier({ data: { attributes: { variant_id: "1000", status: "active" } } }, variantMap);
    expect(tier).toBe("pro");
    await repo.create("Subscription", { user_id: "u9", tier, status: "active", renews_at: "2027-01-01" });

    const sub = normalizeSubscription((await repo.list("Subscription"))[0]);
    const clean = reconcile({ provider: { tier, status: "active" }, subscription: sub, entitlement: "pro" });
    expect(clean.ok).toBe(true);
    expect(clean.matches).toContain("entitlement-in-line");

    // Subscription ends → the provider says access drops to free.
    const expired = reconcile({ provider: { tier, status: "expired" }, subscription: sub, entitlement: "pro" });
    expect(expired.suggestedPlan).toBe("free");
    expect(expired.mismatches.some((m) => m.action === "reconcile-entitlement")).toBe(true);

    // The only mutating step is the entitlement change, and it is audited.
    // (changed is about normalization — "free" already normalizes to "free".)
    const next = reconcileEntitlement({ plan: expired.suggestedPlan });
    expect(next).toEqual({ ok: true, plan: "free", changed: false });
    await withAudit({ repo }, auditEntry({ action: "reconcile.entitlement", targetType: "User", targetId: "u9", actor: "adm" }), async () => next);

    // Unknown provider state is never a guess.
    expect(reconcile({ provider: null, subscription: sub, entitlement: "pro" }).suggestedPlan).toBe("pro");

    const { entries } = await recentAudit({ repo });
    expect(entries[0].action).toBe("reconcile.entitlement");
  });

  it("D · moderation: reports are queued to reviewed/dismissed, content is hidden then super-admin-only removed", async () => {
    const repo = fakeRepo({ CommunityReport: [], Post: [] });
    const admin = { isAdmin: true, role: ROLES.ADMIN };
    const superAdmin = { isAdmin: true, role: ROLES.SUPER_ADMIN };

    // A report lands and a moderator resolves it (dismissal reopens, reviewed closes).
    const report = { id: "r1", status: "open" };
    expect(moderateReport(report, "reviewed").ok).toBe(true);
    await withAudit({ repo }, auditEntry({ action: "community.report.reviewed", targetType: "CommunityReport", targetId: "r1", actor: "mod" }), async () => moderateReport(report, "reviewed"));

    // Hide is open to admins; remove is super-admin territory.
    expect(canModerate(admin, "hide")).toBe(true);
    expect(canModerate(admin, "remove")).toBe(false);
    expect(canModerate(superAdmin, "remove")).toBe(true);

    const content = { id: "p1", status: "active" };
    const hidden = moderateContent(content, "hidden", { note: "report.r1" });
    expect(hidden.ok).toBe(true);
    await withAudit({ repo }, auditEntry({ action: "community.content.hidden", targetType: "Post", targetId: "p1", actor: "mod" }), async () => hidden);

    // Removal is terminal and only super admins may trigger it.
    const removed = moderateContent({ id: "p1", status: "hidden" }, "removed", { note: "repeat" });
    expect(removed.ok).toBe(true);
    expect(moderateContent({ id: "p1", status: "removed" }, "active").ok).toBe(false);

    // A repeat offender gets blocked; the decision is recorded in history.
    expect(toggleBlocked([], "u1")).toEqual(["u1"]);
    expect(toggleBlocked(["u1"], "u1")).toEqual([]);
    const h = historyEntry({ actor: "mod", action: "remove", targetType: "Post", targetId: "p1", reason: "repeat", now: () => "2026-09-22T00:00:00Z" });
    expect(h).toMatchObject({ target_type: "Post", reason: "repeat" });
  });

  it("E · feature flags: a rollout moves from off to on by plan, and unenrolled users never get it", () => {
    const repo = fakeRepo({ FeatureFlag: [] });

    // Admin defines a 50% pro rollout for the AI copilot and persists the row.
    let definitions = upsertFlag([], { key: "ai_assistant", enabled: true, planFloor: "pro", rolloutPct: 50, envs: [], description: "AI assistant" });
    const row = flagRow(definitions[0]);
    void repo.create("FeatureFlag", row);

    // Free users are plan-gated regardless of rollout.
    const flag = normalizeFlag(definitions[0]);
    const free = evaluateFlag(flag, { plan: "free", env: "production", userId: "stu-1" });
    expect(free.enabled).toBe(false);
    expect(free.reason).toBe("plan:free");

    // Pro users enter the deterministic rollout.
    const pro = evaluateFlag(flag, { plan: "pro", env: "production", userId: "stu-1" });
    expect(pro.enabled).toBe(true);
    expect(pro.reason).toBe("rollout");

    // 0% rollout means nobody gets it — flags never grant by accident.
    const zero = upsertFlag(definitions, { ...definitions[0], rolloutPct: 0 });
    expect(evaluateFlag(normalizeFlag(zero[0]), { plan: "ultimate", userId: "stu-1" }).enabled).toBe(false);

    // Toggling the flag OFF kills it for everyone.
    const off = upsertFlag(zero, { ...zero[0], rolloutPct: 100, enabled: false });
    expect(evaluateFlag(normalizeFlag(off[0]), { plan: "ultimate", userId: "stu-1" })).toEqual({ enabled: false, reason: "disabled" });

    // Feature flags are NOT authorization: a free eval can never claim admin perks.
    const adminFlag = normalizeFlag({ key: "experimental_analytics", ...DEFAULT_FLAGS.experimental_analytics, enabled: true });
    const notAdmin = featuresEnabled([adminFlag], { plan: "ultimate", env: "development", isAdmin: false });
    expect(notAdmin.experimental_analytics.enabled).toBe(false);
  });

  it("F · announcements: an author drafts, the system validates and gates it by audience + window", async () => {
    const repo = fakeRepo({ Announcement: [] });

    const draft = {
      title: "Scheduled maintenance",
      body: "Brief outage on Saturday.",
      severity: "maintenance",
      audience: "pro",
      startAt: "2026-01-01T00:00:00Z",
      endAt: "2026-02-01T00:00:00Z",
    };
    expect(validateAnnouncement(draft).ok).toBe(true);
    // Reversed window is rejected before it reaches users.
    expect(validateAnnouncement({ ...draft, endAt: "2025-12-01T00:00:00Z" }).ok).toBe(false);

    await repo.create("Announcement", { id: "a1", ...announcementRow(draft), created_at: "2026-01-01T00:00:00Z" });
    const rows = (await repo.list("Announcement")).map(normalizeAnnouncement);

    // Pro audience: a free student doesn't see it, a Pro student does — inside the window only.
    expect(activeFor(rows, { now: "2026-01-15T00:00:00Z", plan: "free" })).toEqual([]);
    const visible = activeFor(rows, { now: "2026-01-15T00:00:00Z", plan: "pro" });
    expect(visible).toHaveLength(1);
    expect(visible[0].title).toBe("Scheduled maintenance");
    expect(activeFor(rows, { now: "2026-03-01T00:00:00Z", plan: "pro" })).toEqual([]);

    // Severity ordering matters when several are live.
    const batch = [
      { title: "minor", severity: "info", audience: "all", start_at: "2026-01-01T00:00:00Z" },
      { title: "urgent", severity: "important", audience: "all", start_at: "2026-01-01T00:00:00Z" },
    ];
    const ordered = activeFor(batch, { now: "2026-01-15T00:00:00Z", plan: "free" });
    expect(ordered.map((a) => a.title)).toEqual(["urgent", "minor"]);
  });
});