import { describe, it, expect } from "vitest";

import { ROLES, PERMISSIONS, can, principalFrom, ALL_PERMISSIONS, roleLabel } from "@/lib/admin/permissions";
import {
  ADMIN_ACCESS_LABELS,
  adminEnv,
  confirmWeight,
  localDevPrincipal,
  shapeHostedPrincipal,
} from "@/lib/admin/principal";

describe("admin/principal", () => {
  it("shapeHostedPrincipal trusts only server-known roles", () => {
    const founder = shapeHostedPrincipal({ role: ROLES.FOUNDER });
    expect(founder.isAdmin).toBe(true);
    expect(founder.role).toBe(ROLES.FOUNDER);
    expect(founder.source).toBe("hosted");
    expect(founder.permissions).toEqual(ALL_PERMISSIONS);
    expect(can(founder, PERMISSIONS.SYSTEM_MANAGE)).toBe(true);

    const superAdmin = shapeHostedPrincipal({ role: ROLES.SUPER_ADMIN });
    expect(superAdmin.isAdmin).toBe(true);
    expect(superAdmin.role).toBe(ROLES.SUPER_ADMIN);
    expect(superAdmin.source).toBe("hosted");
    expect(superAdmin.permissions).toEqual(ALL_PERMISSIONS);

    const admin = shapeHostedPrincipal({ role: ROLES.ADMIN, permissions: [PERMISSIONS.USERS_READ] });
    expect(admin.isAdmin).toBe(true);
    expect(admin.permissions).toEqual([PERMISSIONS.USERS_READ]);
  });

  it("shapeHostedPrincipal never promotes client-supplied roles", () => {
    const notAdmin = shapeHostedPrincipal({ role: "student" });
    expect(notAdmin.isAdmin).toBe(false);
    expect(notAdmin.role).toBe("user");
    expect(notAdmin.permissions).toEqual([]);
    expect(shapeHostedPrincipal({}).isAdmin).toBe(false);
    expect(shapeHostedPrincipal({ role: null, permissions: [] }).isAdmin).toBe(false);
  });

  it("hosted non-admins are stripped before reaching the UI", () => {
    const denied = principalFrom({ role: "user", source: "hosted" });
    expect(denied.isAdmin).toBe(false);
    expect(denied.permissions).toEqual([]);
  });

  it("localDevPrincipal is the founder, a clearly-marked unenforced dev identity", () => {
    const local = localDevPrincipal();
    expect(local.source).toBe("local");
    expect(local.isAdmin).toBe(true);
    expect(local.role).toBe(ROLES.FOUNDER);
    expect(can(local, PERMISSIONS.SYSTEM_MANAGE)).toBe(true);
  });

  it("roleLabel maps the role hierarchy to display names", () => {
    expect(roleLabel(ROLES.FOUNDER)).toBe("Founder");
    expect(roleLabel(ROLES.SUPER_ADMIN)).toBe("Super Admin");
    expect(roleLabel(ROLES.ADMIN)).toBe("Admin");
    expect(roleLabel("user")).toBe("user");
    expect(roleLabel(undefined)).toBe("user");
  });

  it("hosted founder keeps full access after reload (principal is re-derived, not stored)", () => {
    const first = shapeHostedPrincipal({ role: ROLES.FOUNDER });
    const second = shapeHostedPrincipal({ role: ROLES.FOUNDER });
    expect(second).toEqual(first);
    expect(second.isAdmin).toBe(true);
    expect(second.permissions).toEqual(ALL_PERMISSIONS);
  });

  it("adminEnv distinguishes local (unenforced) from hosted (enforced)", () => {
    const local = adminEnv({ hosted: false });
    expect(local).toEqual({ name: "local", hosted: false, enforced: false, label: "Development — local workspace (no server enforcement)" });
    const prod = adminEnv({ hosted: true });
    expect(prod).toEqual({ name: "production", hosted: true, enforced: true, label: "Production" });
    expect(adminEnv({ hosted: true, envName: "preview" }).label).toBe("Preview");
    expect(adminEnv({ hosted: true, envName: "development" }).name).toBe("development");
    expect(adminEnv({ hosted: true, envName: "somewhere" }).name).toBe("production");
  });

  it("confirmWeight scales with the environment, not a claim", () => {
    expect(confirmWeight(adminEnv({ hosted: false }))).toBe("light");
    expect(confirmWeight(adminEnv({ hosted: true, envName: "preview" }))).toBe("normal");
    expect(confirmWeight(adminEnv({ hosted: true, envName: "production" }))).toBe("heavy");
    expect(confirmWeight(adminEnv({}))).toBe("light");
  });

  it("ADMIN_ACCESS_LABELS maps feature areas to catalog permissions", () => {
    expect(ADMIN_ACCESS_LABELS.USERS).toBe(PERMISSIONS.USERS_MANAGE);
    expect(ADMIN_ACCESS_LABELS.BILLING).toBe(PERMISSIONS.BILLING_MANAGE);
    expect(ADMIN_ACCESS_LABELS.COMMUNITY).toBe(PERMISSIONS.COMMUNITY_MODERATE);
    expect(ADMIN_ACCESS_LABELS.FLAGS).toBe(PERMISSIONS.FEATURE_FLAGS_MANAGE);
    expect(ADMIN_ACCESS_LABELS.AI).toBe(PERMISSIONS.AI_MANAGE);
    expect(ADMIN_ACCESS_LABELS.SYSTEM).toBe(PERMISSIONS.SYSTEM_MANAGE);
  });
});