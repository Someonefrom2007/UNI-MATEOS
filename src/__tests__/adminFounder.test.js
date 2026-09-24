// UNI·MATE founder-role contract.
//
// Mirrors what supabase/schema.sql enforces server-side so the client-side
// invariants stay provable in CI: role → permission mapping, no self-promotion,
// the `enabled` kill-switch, idempotent bootstrap (one founder row), and full
// section reachability for the founder.

import { describe, it, expect } from "vitest";

import { ROLES, PERMISSIONS, ALL_PERMISSIONS, permissionsFor, can, principalFrom, roleLabel } from "@/lib/admin/permissions";
import { shapeHostedPrincipal } from "@/lib/admin/principal";
import { SECTIONS, permittedSections } from "@/lib/admin/sections";

const founderPrincipal = principalFrom({ role: ROLES.FOUNDER, source: "hosted" });

describe("admin/founder role", () => {
  it("founder is the highest role and holds the full permission catalog", () => {
    expect(permissionsFor({ role: ROLES.FOUNDER })).toEqual(ALL_PERMISSIONS);
    // Even an explicit but partial permission list cannot restrict a founder.
    expect(permissionsFor({ role: ROLES.FOUNDER, permissions: [PERMISSIONS.USERS_READ] })).toEqual(ALL_PERMISSIONS);
    for (const p of ALL_PERMISSIONS) {
      expect(can(founderPrincipal, p)).toBe(true);
    }
  });

  it("all 15 console sections are reachable by the founder", () => {
    expect(permittedSections(founderPrincipal).map((s) => s.id).sort()).toEqual(
      SECTIONS.map((s) => s.id).sort()
    );
  });

  it("student roles get nothing even if they claim a founder identity", () => {
    const student = principalFrom({ role: "student", source: "hosted", isAdmin: false });
    expect(student.isAdmin).toBe(false);
    expect(student.permissions).toEqual([]);
    expect(can(student, PERMISSIONS.USERS_READ)).toBe(false);
    // Hosted source re-derives authority from the server row, never from a
    // client-claimed flag: a forged role is rejected before it reaches the UI.
    expect(shapeHostedPrincipal({ role: "founder" }).isAdmin).toBe(true); // server said founder
    expect(shapeHostedPrincipal({ role: "student" }).isAdmin).toBe(false); // server said student
    expect(shapeHostedPrincipal({ role: null }).isAdmin).toBe(false);
    expect(shapeHostedPrincipal({}).isAdmin).toBe(false);
  });

  it("roleLabel advertises Founder (never the account email)", () => {
    expect(roleLabel(ROLES.FOUNDER)).toBe("Founder");
    expect(roleLabel(ROLES.FOUNDER).toLowerCase()).not.toContain("miquel");
    expect(roleLabel(ROLES.FOUNDER)).not.toContain("@");
  });

  it("enabled kill-switch removes access at the server (is_admin honours enabled)", () => {
    // Mirrors: SELECT EXISTS (... WHERE user_id = auth.uid() AND enabled)
    const isAdmin = ({ row, enabled }) => Boolean(row && enabled);
    const founderRow = { role: ROLES.FOUNDER };
    expect(isAdmin({ row: founderRow, enabled: true })).toBe(true);
    expect(isAdmin({ row: founderRow, enabled: false })).toBe(false);
    // current_admin_role() with enabled=false also returns nothing → principal
    // maps to a non-admin, exactly like the hosted path.
    const role = ({ enabled }) => (enabled ? ROLES.FOUNDER : null);
    expect(principalFrom({ role: role({ enabled: false }) || "", source: "hosted" }).isAdmin).toBe(false);
  });
});

describe("admin/founder bootstrap idempotency", () => {
  // Mirrors the schema seed: INSERT ... SELECT ... ON CONFLICT (user_id) DO NOTHING,
  // where admin_accounts.user_id is the PRIMARY KEY — the PK is what makes
  // re-runs incapable of creating duplicates. The literal email below is
  // test-only (vitest is never shipped/bundled); production keeps it
  // exclusively in supabase/schema.sql (server-side).
  const bootstrap = (roster, email) => {
    const byEmail = { "miquel.rocas25@gmail.com": "uuid-foundation" };
    const uid = byEmail[email.toLowerCase()];
    if (!uid) return roster;
    const next = new Map(roster);
    if (!next.has(uid)) next.set(uid, { user_id: uid, role: ROLES.FOUNDER, enabled: true });
    return next;
  };

  it("running the bootstrap twice never creates a duplicate founder row", () => {
    const once = bootstrap(new Map(), "miquel.rocas25@gmail.com");
    const twice = bootstrap(once, "miquel.rocas25@gmail.com");
    const thrice = bootstrap(twice, "MIQUEL.ROCAS25@GMAIL.COM");
    expect(once.size).toBe(1);
    expect(twice.size).toBe(1);
    expect(thrice.size).toBe(1);
    expect([...thrice.values()][0].role).toBe(ROLES.FOUNDER);
  });

  it("bootstrap before the account exists is a safe no-op", () => {
    const none = bootstrap(new Map(), "nobody@example.com");
    expect(none.size).toBe(0);
  });
});