import { describe, it, expect } from "vitest";

import { ROLES, PERMISSIONS, can, isKnownPermission, DEFAULT_ADMIN_PERMISSIONS } from "@/lib/admin/permissions";
import { ADMIN_BASE, SECTIONS, sectionIds, sectionByPath, permittedSections } from "@/lib/admin/sections";

describe("admin/sections", () => {
  it("registry is closed: unique ids, prefixed paths, unique permissions", () => {
    const ids = SECTIONS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    SECTIONS.forEach((s) => {
      expect(s.id).toBeTruthy();
      expect(s.label).toBeTruthy();
      expect(s.path.startsWith(ADMIN_BASE)).toBe(true);
      expect(isKnownPermission(s.permission)).toBe(true);
      expect(typeof s.group).toBe("string");
    });
    expect(ADMIN_BASE).toBe("/admin");
  });

  it("index and /:id paths resolve back to sections", () => {
    expect(sectionIds()).toEqual(SECTIONS.map((s) => s.id));
    expect(sectionByPath("/admin/").id).toBe("overview");
    expect(sectionByPath("/admin/users").id).toBe("users");
    expect(sectionByPath("/admin/flags").id).toBe("flags");
    expect(sectionByPath("/wrong")).toBeUndefined();
  });

  it("every listed permission lives in the catalog", () => {
    const used = new Set(SECTIONS.map((s) => s.permission));
    [...used].forEach((p) => expect(isKnownPermission(p)).toBe(true));
  });

  it("super_admin sees every section", () => {
    expect(permittedSections({ role: ROLES.SUPER_ADMIN })).toHaveLength(SECTIONS.length);
  });

  it("a default admin sees everything except the super-admin tools section (system.manage)", () => {
    const admin = { role: ROLES.ADMIN, permissions: [...DEFAULT_ADMIN_PERMISSIONS] };
    const got = permittedSections(admin);
    expect(got.map((s) => s.id)).not.toContain("dev");
    expect(got.map((s) => s.id)).toContain("overview");
    expect(got.map((s) => s.id)).toContain("billing");
    expect(got.every((s) => can(admin, s.permission))).toBe(true);
  });

  it("a non-admin sees nothing", () => {
    expect(permittedSections({ role: "user" })).toEqual([]);
    expect(permittedSections({})).toEqual([]);
  });

  it("section permission caps match the catalog intent", () => {
    const byId = Object.fromEntries(SECTIONS.map((s) => [s.id, s.permission]));
    expect(byId.dev).toBe(PERMISSIONS.SYSTEM_MANAGE);
    expect(byId.security).toBe(PERMISSIONS.SYSTEM_READ);
    expect(byId.flags).toBe(PERMISSIONS.FEATURE_FLAGS_MANAGE);
    expect(byId.announcements).toBe(PERMISSIONS.SETTINGS_MANAGE);
    expect(byId.settings).toBe(PERMISSIONS.SETTINGS_MANAGE);
    expect(byId.ai).toBe(PERMISSIONS.AI_MANAGE);
    expect(byId.community).toBe(PERMISSIONS.COMMUNITY_MODERATE);
  });

  it("quick actions are boolean-labeled and reviewers can open the admin shell map", () => {
    SECTIONS.forEach((s) => {
      (s.actions || []).forEach((a) => {
        expect(typeof a.label).toBe("string");
        expect(typeof a.quick).toBe("boolean");
        expect(typeof a.to).toBe("string");
      });
    });
    expect(SECTIONS.some((s) => s.actions?.some((a) => a.quick))).toBe(true);
  });
});