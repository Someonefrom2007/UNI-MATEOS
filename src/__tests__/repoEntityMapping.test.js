// Regression cover for the two data-layer defects fixed in Mission 01, plus a
// structural guard on the authorization fix.
//
// 1. Entity names reached the repo un-mapped ("User" → table "User"), which
//    404s hosted and read a dead localStorage key locally.
// 2. `create()` injected a client UUID into bigint IDENTITY primary keys,
//    which Postgres rejects with 22P02.
// 3. `usePlan` could write the caller's own plan tier through user_metadata,
//    and the ai-assistant gate authorized on that same field.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, resolve as resolvePath } from "node:path";
import { createLocalRepo } from "@/lib/repo/localRepo";
import { createSupabaseRepo } from "@/lib/repo/supabaseRepo";

const ROOT = resolvePath(__dirname, "..", "..");
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");

/** Source with comments stripped, so prose about a fix can't satisfy a guard. */
const readCode = (rel) =>
  read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

const memStorage = () => {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, v),
    removeItem: (k) => map.delete(k),
    _map: map,
  };
};

describe("repo resolves entity names to physical tables", () => {
  it("localRepo.list('User') reads the user_profiles key", async () => {
    const storage = memStorage();
    storage.setItem("user_profiles", JSON.stringify([{ id: "u1", role: "student" }]));
    const repo = createLocalRepo({ storage });

    // The admin console's historical call.
    const rows = await repo.list("User");
    expect(rows).toEqual([{ id: "u1", role: "student" }]);
  });

  it("localRepo writes under the physical table name, not the entity name", async () => {
    const storage = memStorage();
    const repo = createLocalRepo({ storage });
    await repo.create("User", { email: "a@b.co" });

    expect(storage._map.has("user_profiles")).toBe(true);
    expect(storage._map.has("User")).toBe(false);
  });

  it("localRepo returns [] for an unknown table rather than throwing", async () => {
    const repo = createLocalRepo({ storage: memStorage() });
    expect(await repo.list("NotAThing")).toEqual([]);
  });

  it("localRepo.clear resolves the entity name before removing the key", async () => {
    const storage = memStorage();
    storage.setItem("user_profiles", JSON.stringify([{ id: "u1" }]));
    const repo = createLocalRepo({ storage });
    await repo.clear("User");
    expect(storage._map.has("user_profiles")).toBe(false);
  });

  it("supabaseRepo queries the mapped table, never the entity name", async () => {
    const seen = [];
    const client = {
      from: (t) => {
        seen.push(t);
        return { select: async () => ({ data: [], error: null }) };
      },
    };
    const repo = createSupabaseRepo({ client });
    await repo.list("User");
    await repo.list("FeatureFlag");
    expect(seen).toEqual(["user_profiles", "feature_flags"]);
  });

  it("supabaseRepo still honours a table name passed directly", async () => {
    const seen = [];
    const client = {
      from: (t) => {
        seen.push(t);
        return { select: async () => ({ data: [], error: null }) };
      },
    };
    await createSupabaseRepo({ client }).list("waitlist");
    expect(seen).toEqual(["waitlist"]);
  });
});

describe("bigint IDENTITY primary keys get no client id", () => {
  it("localRepo omits the id for waitlist", async () => {
    const row = await createLocalRepo({ storage: memStorage() }).create("waitlist", {
      email: "a@b.co",
    });
    expect("id" in row).toBe(false);
    expect(row.email).toBe("a@b.co");
  });

  it("localRepo still generates ids for uuid tables", async () => {
    const row = await createLocalRepo({ storage: memStorage() }).create("Course", { name: "Stats" });
    expect(typeof row.id).toBe("string");
    expect(row.id.length).toBeGreaterThan(0);
  });

  it("supabaseRepo omits the id for waitlist (the hosted signup path)", async () => {
    let inserted = null;
    const client = {
      from: () => ({
        insert: (row) => {
          inserted = row;
          return { select: () => ({ single: async () => ({ data: row, error: null }) }) };
        },
      }),
    };
    await createSupabaseRepo({ client }).create("waitlist", { email: "a@b.co" });
    // A UUID here is Postgres 22P02 invalid input syntax for type bigint.
    expect(inserted.id).toBeUndefined();
  });

  it("supabaseRepo omits the id for audit_log too", async () => {
    let inserted = null;
    const client = {
      from: () => ({
        insert: (row) => {
          inserted = row;
          return { select: () => ({ single: async () => ({ data: row, error: null }) }) };
        },
      }),
    };
    await createSupabaseRepo({ client }).create("AuditLog", { action: "x" });
    expect(inserted.id).toBeUndefined();
  });

  it("supabaseRepo still generates an id for uuid tables", async () => {
    let inserted = null;
    const client = {
      from: () => ({
        insert: (row) => {
          inserted = row;
          return { select: () => ({ single: async () => ({ data: row, error: null }) }) };
        },
      }),
    };
    await createSupabaseRepo({ client }).create("Course", { name: "Stats" });
    expect(inserted.id).toEqual(expect.any(String));
  });
});

describe("plan entitlement is not client-writable", () => {
  it("usePlan no longer writes the plan through auth user_metadata", () => {
    // This is the vulnerability: `supabase.auth.updateUser({ data: { plan } })`
    // lets any authenticated user rewrite their own entitlement.
    const source = readCode("src/lib/usePlan.js");
    expect(source).not.toMatch(/updateUser/);
    expect(source).not.toMatch(/user_metadata/);
  });

  it("usePlan resolves the hosted plan from the server, not user_metadata", () => {
    const source = readCode("src/lib/usePlan.js");
    expect(source).toMatch(/useSubscription/);
  });

  it("usePlan refuses a hosted plan change outright", () => {
    const source = readCode("src/lib/usePlan.js");
    expect(source).toMatch(/not available on the hosted app/i);
  });

  it("ai-assistant authorizes on subscriptions.tier, not user_metadata", () => {
    const source = readCode("supabase/functions/ai-assistant/index.ts");
    // user_metadata.plan is writable by the account owner, so authorizing on
    // it means the gate is satisfied by the very client it should stop.
    expect(source).not.toMatch(/user_metadata\?\.plan/);
    expect(source).toMatch(/from\("subscriptions"\)/);
    expect(source).toMatch(/\.eq\("user_id",\s*user\.id\)/);
  });
});
