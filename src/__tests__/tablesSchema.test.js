// Structural contract between src/lib/tables.js and supabase/schema.sql.
//
// This suite exists because of a real, shipped bug: the entire admin console
// called `repo.list("User")`, the repo forwarded the string to
// `client.from(table)`, and no table named "User" has ever existed. Hosted
// mode 404'd on every admin read and write while local mode read a
// localStorage key nothing ever wrote — so both modes rendered as "no data"
// and the console looked merely empty, not broken.
//
// Three layers of defence are asserted here:
//   1. every TABLE entry names a table that actually exists in the schema,
//   2. every one of those tables has RLS enabled,
//   3. no admin call site passes an unmapped entity name to the repo.
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve as resolvePath } from "node:path";
import {
  TABLE,
  getTable,
  resolveTable,
  usesIdentityPrimaryKey,
  IDENTITY_PK_TABLES,
} from "@/lib/tables";

const ROOT = resolvePath(__dirname, "..", "..");
const SCHEMA = readFileSync(join(ROOT, "supabase", "schema.sql"), "utf8");

/** Every table the schema actually creates. */
const declaredTables = () =>
  new Set(
    [...SCHEMA.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?"?([a-z_]+)"?/gi)].map(
      (m) => m[1]
    )
  );

/** Every table with RLS switched on. */
const rlsEnabledTables = () =>
  new Set(
    [...SCHEMA.matchAll(/ALTER\s+TABLE\s+(?:public\.)?"?([a-z_]+)"?\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/gi)].map(
      (m) => m[1]
    )
  );

describe("tables.js → schema.sql mapping", () => {
  it("the schema parser actually found the tables (guards the guards)", () => {
    // If a schema refactor changes the DDL shape, every assertion below would
    // silently pass against an empty set. This proves the fixtures are real.
    const tables = declaredTables();
    expect(tables.size).toBeGreaterThan(30);
    expect(tables.has("user_profiles")).toBe(true);
    expect(tables.has("audit_log")).toBe(true);
  });

  it("every entity in TABLE maps to a table that exists", () => {
    const tables = declaredTables();
    const missing = Object.entries(TABLE)
      .filter(([, table]) => !tables.has(table))
      .map(([entity, table]) => `${entity} → ${table}`);
    expect(missing).toEqual([]);
  });

  it("every mapped table has RLS enabled", () => {
    const rls = rlsEnabledTables();
    const exposed = [...new Set(Object.values(TABLE))].filter((t) => !rls.has(t));
    expect(exposed).toEqual([]);
  });

  it("getTable resolves each declared entity to its own table", () => {
    for (const [entity, table] of Object.entries(TABLE)) {
      expect(getTable(entity), `getTable(${entity})`).toBe(table);
    }
  });

  it("no two entities share a table", () => {
    const tables = Object.values(TABLE);
    expect(new Set(tables).size).toBe(tables.length);
  });
});

describe("resolveTable", () => {
  it("maps every known entity name to its physical table", () => {
    for (const [entity, table] of Object.entries(TABLE)) {
      expect(resolveTable(entity), `resolveTable(${entity})`).toBe(table);
    }
  });

  it("passes real table names through untouched", () => {
    // Callers that already pass snake_case must keep working.
    for (const table of Object.values(TABLE)) {
      expect(resolveTable(table)).toBe(table);
    }
    expect(resolveTable("waitlist")).toBe("waitlist");
  });

  it("is idempotent — resolving twice changes nothing", () => {
    for (const [entity, table] of Object.entries(TABLE)) {
      expect(resolveTable(resolveTable(entity))).toBe(table);
    }
  });

  it("passes unknown names through so a real typo still fails loudly", () => {
    // Rewriting an unrecognised name would silently query the wrong table.
    expect(resolveTable("NotAThing")).toBe("NotAThing");
    expect(resolveTable("")).toBe("");
    expect(resolveTable(undefined)).toBe(undefined);
    expect(resolveTable(null)).toBe(null);
  });

  it("resolves the exact strings the admin console used to get wrong", () => {
    // Regression: these are the literal arguments that produced a 404.
    expect(resolveTable("User")).toBe("user_profiles");
    expect(resolveTable("FeatureFlag")).toBe("feature_flags");
    expect(resolveTable("Announcement")).toBe("announcements");
    expect(resolveTable("AuditLog")).toBe("audit_log");
    expect(resolveTable("Subscription")).toBe("subscriptions");
    expect(resolveTable("WebhookEvent")).toBe("webhook_events");
    expect(resolveTable("AdminAccount")).toBe("admin_accounts");
  });
});

describe("identity primary keys", () => {
  it("flags exactly the bigint IDENTITY tables", () => {
    for (const t of IDENTITY_PK_TABLES) {
      expect(usesIdentityPrimaryKey(t), t).toBe(true);
    }
    expect(usesIdentityPrimaryKey("courses")).toBe(false);
    expect(usesIdentityPrimaryKey("user_profiles")).toBe(false);
  });

  it("accepts the entity name too, not just the table name", () => {
    expect(usesIdentityPrimaryKey("Waitlist")).toBe(true);
    expect(usesIdentityPrimaryKey("AuditLog")).toBe(true);
  });

  it("every identity table really is bigint IDENTITY in the schema", () => {
    for (const table of IDENTITY_PK_TABLES) {
      const block = SCHEMA.split(new RegExp(`CREATE TABLE[^;]*public\\.${table}\\s*\\(`))[1] || "";
      expect(block.slice(0, 400), `${table} id column`).toMatch(
        /id\s+bigint\s+GENERATED\s+ALWAYS\s+AS\s+IDENTITY/
      );
    }
  });

  it("no other table has a bigint id — the flag list is complete", () => {
    const bigintTables = [...SCHEMA.matchAll(
      /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?public\.([a-z_]+)\s*\([^;]*?\bid\s+bigint/gi
    )].map((m) => m[1]);
    for (const t of bigintTables) {
      expect(IDENTITY_PK_TABLES, `${t} is bigint but not flagged`).toContain(t);
    }
  });
});

describe("admin call sites cannot pass an unmapped entity name", () => {
  const walk = (dir) =>
    readdirSync(dir).flatMap((entry) => {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) return walk(full);
      return /\.(js|jsx)$/.test(entry) ? [full] : [];
    });

  const files = [...walk(join(ROOT, "src", "pages", "admin")), ...walk(join(ROOT, "src", "lib", "admin"))];

  it("found the admin sources to check", () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it("every capitalized string passed to a repo call resolves to a real table", () => {
    // The bug in one assertion: an entity name reaches the repo and must map.
    const offenders = [];
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      for (const m of source.matchAll(
        /repo\.(?:list|create|update|delete|deleteWhere|clear)\(\s*"([A-Za-z_]+)"/g
      )) {
        const name = m[1];
        if (name === name.toLowerCase()) continue; // already a real table name
        if (!TABLE[name]) offenders.push(`${file.replace(ROOT, "")}: repo call with "${name}"`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("every entity in an entity-list array resolves through TABLE", () => {
    // The indirect cases the literal scan above cannot see: Analytics MEASURE,
    // Users OWNED_TABLES and Dev's table list are all-capitalised string
    // arrays handed to a repo function by variable. An unmapped entry there
    // fails the same way a literal would, so it must be caught the same way.
    const offenders = [];
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      for (const m of source.matchAll(/\[((?:"[A-Z][A-Za-z]*"\s*,?\s*)+)\]/g)) {
        for (const e of m[1].matchAll(/"([A-Z][A-Za-z]*)"/g)) {
          if (!TABLE[e[1]]) offenders.push(`${file.replace(ROOT, "")}: unmapped "${e[1]}"`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
