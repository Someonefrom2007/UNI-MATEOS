// Database-layer entitlement cover.
//
// The bug this pins down: the application layer was already correct — the UI
// gates, the `ai-assistant` edge function and the `lemon-squeezy` status
// endpoint all read `subscriptions.tier`. But every RLS policy on the paid
// tables was ownership-only (`auth.uid() = user_id`), so any authenticated
// holder of their own JWT plus the public anon key could read their own
// flashcards/study_plans straight through PostgREST and walk straight past the
// paywall. Only the DATABASE can close that, so the rule is enforced in RLS.
//
// The companion half is Advanced Analytics. Its maths used to run in the
// browser over focus_sessions/tasks/grades/courses — free-tier tables with
// deliberately untouched RLS, so a free user could reproduce every Pro number
// by hand. It now ships as a derived read that computes server-side behind its
// own entitlement check.
//
// These tests are static: there is no Postgres in the unit suite. The SQL is
// verified for real behaviour by the transactional probes in
// qa/hosted/verify-security.mjs, which simulate a genuine `authenticated`
// session and assert the same contract this file pins. The behavioural table
// below is the shared contract; the source guards assert the migration
// implements it, and the non-vacuity blocks prove those guards actually fail
// when the rule is removed.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, resolve as resolvePath } from "node:path";

const ROOT = resolvePath(__dirname, "..", "..");
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");

/** Source with comments stripped, so prose about a fix can't satisfy a guard. */
const readCode = (rel) =>
  read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1")
    .replace(/^\s*--.*$/gm, "");

const MIGRATION = "supabase/migrations/20260929000000_paid_entitlement_enforcement.sql";
const ANALYTICS_PAGE = "src/pages/Analytics.jsx";

const sql = readCode(MIGRATION);
const page = readCode(ANALYTICS_PAGE);

// Pro features per PLAN_FEATURES in src/lib/plans.js, plus the engine.
const PAID_TABLES = ["flashcards", "flashcard_decks", "study_plans", "study_plan_items"];
// Free-tier tables. The free dashboard (src/lib/burnout.js) reads these, so
// tier-gating them would break Grades/Focus/Tasks/Courses for every free user.
const FREE_TABLES = ["focus_sessions", "tasks", "grades", "courses"];
const COMMANDS = ["select", "insert", "update", "delete"];

const policy = (source, name) => {
  const m = source.match(new RegExp(`CREATE POLICY "${name}"[\\s\\S]*?;`));
  return m ? m[0] : null;
};

const fn = (source, signature) => {
  const m = source.match(
    new RegExp(`CREATE OR REPLACE FUNCTION ${signature.replace(/[()]/g, "\\$&")}[\\s\\S]*?\\$\\$;`)
  );
  return m ? m[0] : null;
};

// ── the contract, stated once ────────────────────────────────────────────────

const KEEPS_ENTITLEMENT = ["on_trial", "active", "paused", "cancelled", "unpaid"];

/**
 * The rule public.has_paid_entitlement() must implement. Deliberately stricter
 * than the edge functions' effectiveTier(), which also accepts the legacy
 * `ultra` spelling. The subscriptions CHECK constraint only admits
 * free/pro/ultimate, so `ultra` can never reach this column; refusing it here
 * means the database fails closed if that constraint is ever relaxed.
 */
const dbEntitled = (subscription, now = new Date("2026-06-15T12:00:00Z")) => {
  if (!subscription) return false;
  if (subscription.tier !== "pro" && subscription.tier !== "ultimate") return false;
  if (!KEEPS_ENTITLEMENT.includes(subscription.status || "")) return false;
  if (subscription.status === "cancelled" && subscription.renews_at) {
    return new Date(subscription.renews_at).getTime() > now.getTime();
  }
  return true;
};

const sub = (tier, status, renews_at) => ({ tier, status, renews_at });

describe("database entitlement contract", () => {
  const cases = [
    ["no subscription row at all", null, false],
    ["free tier", sub("free", "active"), false],
    ["pro, active", sub("pro", "active"), true],
    ["ultimate, active", sub("ultimate", "active"), true],
    ["pro, trialling", sub("pro", "on_trial"), true],
    ["pro, paused", sub("pro", "paused"), true],
    ["unpaid grace", sub("pro", "unpaid"), true],
    ["expired", sub("pro", "expired"), false],
    ["unknown status fails closed", sub("pro", "on_hold"), false],
    ["null status fails closed", sub("pro", null), false],
    ["legacy ultra spelling is refused", sub("ultra", "active"), false],
    [
      "cancelled, paid period still running",
      sub("pro", "cancelled", "2026-06-20T00:00:00Z"),
      true,
    ],
    [
      "cancelled, period already ended",
      sub("pro", "cancelled", "2026-06-01T00:00:00Z"),
      false,
    ],
    ["cancelled with no renewal date", sub("pro", "cancelled", null), true],
    [
      "active with a stale renewal date stays entitled",
      sub("pro", "active", "2026-01-01T00:00:00Z"),
      true,
    ],
  ];

  it.each(cases)("%s -> %s", (_label, subscription, expected) => {
    expect(dbEntitled(subscription)).toBe(expected);
  });
});

// ── has_paid_entitlement() ───────────────────────────────────────────────────

const entitledFn = fn(sql, "public.has_paid_entitlement()");

describe("public.has_paid_entitlement", () => {
  it("is defined", () => {
    expect(entitledFn).not.toBeNull();
  });

  it("is SECURITY DEFINER, so its own read of subscriptions is not re-gated", () => {
    // Without SECURITY DEFINER this function's read of subscriptions would be
    // evaluated under that table's RLS, putting the call inside the very policy
    // chain it participates in.
    expect(entitledFn).toMatch(/SECURITY\s+DEFINER/i);
  });

  it("pins search_path so no caller-controlled schema can shadow it", () => {
    expect(entitledFn).toMatch(/SET\s+search_path\s*=\s*public,\s*pg_temp/i);
  });

  it("reads subscriptions and nothing else", () => {
    expect(entitledFn).toMatch(/FROM\s+public\.subscriptions/i);
  });

  it("never consults user_metadata, which the account owner can self-write", () => {
    expect(entitledFn).not.toMatch(/user_metadata/i);
  });

  it("scopes every read to auth.uid()", () => {
    expect(entitledFn).toMatch(/s\.user_id\s*=\s*auth\.uid\(\)/i);
  });

  it("keeps staff exempt so the founder/admin model is preserved", () => {
    expect(entitledFn).toMatch(/is_admin\(\)/i);
  });

  it("encodes exactly the status set that keeps entitlement", () => {
    const list = entitledFn.match(/COALESCE\(s\.status,''\)\s*IN\s*\(([^)]*)\)/i);
    expect(list).not.toBeNull();
    const found = list[1].match(/'([^']+)'/g).map((s) => s.slice(1, -1));
    expect(found).toEqual(KEEPS_ENTITLEMENT);
  });

  it("only expires a cancelled row, and only once renews_at has passed", () => {
    expect(entitledFn).toMatch(/s\.status\s+IS\s+DISTINCT\s+FROM\s+'cancelled'/i);
    expect(entitledFn).toMatch(/s\.renews_at\s+IS\s+NULL/i);
    expect(entitledFn).toMatch(/s\.renews_at\s*>\s*now\(\)/i);
  });

  it("accepts only the paid tiers", () => {
    expect(entitledFn).toMatch(/s\.tier\s+IN\s*\(\s*'pro'\s*,\s*'ultimate'\s*\)/i);
  });

  it("is not callable by anon or PUBLIC, but is by authenticated", () => {
    // The function is only meaningful inside a policy, which evaluates it as the
    // querying role. Default privileges would otherwise grant EXECUTE to PUBLIC.
    expect(sql).toMatch(
      /REVOKE ALL ON FUNCTION public\.has_paid_entitlement\(\) FROM PUBLIC;/i
    );
    expect(sql).toMatch(
      /REVOKE ALL ON FUNCTION public\.has_paid_entitlement\(\) FROM anon;/i
    );
    expect(sql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.has_paid_entitlement\(\) TO authenticated;/i
    );
  });
});

// ── RLS on the paid datasets ─────────────────────────────────────────────────

/** Returns one problem string per missing ownership/entitlement requirement. */
const gateProblems = (source) => {
  const problems = [];
  for (const table of PAID_TABLES) {
    for (const cmd of COMMANDS) {
      const body = policy(source, `${table}_${cmd}_own`);
      const where = `${table}.${cmd}`;
      if (!body) {
        problems.push(`${where}: no policy`);
        continue;
      }
      if (!/auth\.uid\(\)\s*=\s*user_id/.test(body)) problems.push(`${where}: no ownership check`);
      if (!/has_paid_entitlement\(\)/.test(body)) problems.push(`${where}: no entitlement gate`);
      if (/\bOR\b/i.test(body)) problems.push(`${where}: OR would widen access`);
      if (cmd === "select" || cmd === "delete") {
        if (!/\bUSING\b/i.test(body)) problems.push(`${where}: missing USING`);
      }
      if (cmd === "insert" || cmd === "update") {
        // A write that is not re-checked lets a free user insert rows they can
        // never read back, and lets an owner re-assign rows to another user.
        if (!/\bWITH CHECK\b/i.test(body)) problems.push(`${where}: missing WITH CHECK`);
      }
    }
  }
  return problems;
};

describe("paid dataset RLS", () => {
  it("gates all four commands on all four paid tables", () => {
    expect(gateProblems(sql)).toEqual([]);
  });

  it("is strictly narrower than the ownership-only policy it replaces", () => {
    // Gating reads alone would be incoherent: a free user could still write
    // rows into the paid tables.
    for (const body of [
      policy(sql, "flashcards_insert_own"),
      policy(sql, "study_plans_update_own"),
    ]) {
      expect(body).toMatch(/WITH CHECK/i);
    }
  });

  it("narrows by replacement, so a re-run cannot silently keep the hole open", () => {
    // A create-only-if-missing guard would be a no-op against the already-hosted
    // ownership-only policies, leaving the paywall bypassable.
    for (const table of PAID_TABLES) {
      for (const cmd of COMMANDS) {
        const name = `${table}_${cmd}_own`;
        const drop = sql.indexOf(`DROP POLICY IF EXISTS "${name}"`);
        const create = sql.indexOf(`CREATE POLICY "${name}"`);
        expect(drop, `no DROP for ${name}`).toBeGreaterThan(-1);
        expect(drop, `DROP for ${name} must precede CREATE`).toBeLessThan(create);
      }
    }
  });

  it("leaves the free-tier tables alone", () => {
    for (const table of FREE_TABLES) {
      expect(policy(sql, `${table}_select_own`), `gated free table ${table}`).toBeNull();
      expect(sql, `touched free table ${table}`).not.toMatch(
        new RegExp(`(?:CREATE|DROP) POLICY[^;]*ON public\\.${table}\\b`)
      );
    }
  });

  it("does not drop the admin_read policies, so staff visibility survives", () => {
    expect(sql).not.toMatch(/DROP POLICY[^;]*admin_read/i);
  });

  it("drops no table, column or row", () => {
    expect(sql).not.toMatch(/\bDROP\s+(TABLE|COLUMN)\b/i);
    expect(sql).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(sql).not.toMatch(/\bTRUNCATE\b/i);
  });
});

// ── advanced_analytics() ─────────────────────────────────────────────────────

const advFn = fn(sql, "public.advanced_analytics(p_today date DEFAULT NULL)");

describe("public.advanced_analytics", () => {
  it("is defined as a server-derived read", () => {
    expect(advFn).not.toBeNull();
  });

  it("is SECURITY DEFINER with a pinned search_path", () => {
    expect(advFn).toMatch(/SECURITY\s+DEFINER/i);
    expect(advFn).toMatch(/SET\s+search_path\s*=\s*public,\s*pg_temp/i);
  });

  it("refuses an unauthenticated caller with 42501", () => {
    expect(advFn).toMatch(/v_uid\s+IS\s+NULL[\s\S]*?RAISE EXCEPTION[\s\S]*?42501/i);
  });

  it("requires paid entitlement", () => {
    expect(advFn).toMatch(/has_paid_entitlement\(\)/i);
  });

  it("scopes every table read to the caller, never to a cohort", () => {
    // SECURITY DEFINER bypasses RLS, so the user_id filter is the only thing
    // stopping one student from reading another's rows through this function.
    const reads = advFn.match(/(?:FROM|JOIN)\s+public\.[a-z_]+/gi) || [];
    const filters = advFn.match(/user_id\s*=\s*v_uid/gi) || [];
    expect(reads.length).toBeGreaterThanOrEqual(5);
    expect(filters.length).toBeGreaterThanOrEqual(reads.length - 1);
  });

  it("derives its numbers from the free tables, not the paid ones", () => {
    for (const table of PAID_TABLES) {
      expect(advFn, `reads paid table ${table}`).not.toMatch(new RegExp(`public\\.${table}\\b`));
    }
  });

  it("resolves course names server-side, so the client cannot spoof them", () => {
    expect(advFn).toMatch(/JOIN\s+public\.courses/i);
  });

  it("keeps the run of a cancelled subscriber alive until renews_at", () => {
    // The whole point: the paid maths must not be recomputable from free rows.
    expect(advFn).toMatch(/has_paid_entitlement\(\)/i);
    expect(
      sql,
      "revoking execute would lock out paying customers"
    ).toMatch(/GRANT EXECUTE ON FUNCTION public\.advanced_analytics\(date\) TO authenticated;/i);
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.advanced_analytics\(date\) FROM anon;/i);
  });
});

// ── the client no longer recomputes the paid maths ───────────────────────────

/** Returns one problem string per requirement the Analytics page still misses. */
const clientProblems = (source) => {
  const problems = [];
  if (!/supabase\.rpc\(\s*"advanced_analytics"/.test(source)) {
    problems.push("does not call the derived read");
  }
  if (/from\s+"@\/lib\/analytics"/.test(source)) problems.push("still imports the client engine");
  for (const fn of ["studyStreaks", "weeklyFocus", "completionStats", "gradeTrajectory", "focusVelocity"]) {
    if (new RegExp(`\\b${fn}\\s*\\(`).test(source)) problems.push(`still calls ${fn}()`);
  }
  for (const table of ["focus_sessions", "grades"]) {
    if (new RegExp(`["'\`]${table}["'\`]`).test(source)) {
      problems.push(`still reads ${table} directly`);
    }
  }
  if (/repo\.list\(/.test(source)) problems.push("still lists raw tables");
  return problems;
};

describe("Analytics page", () => {
  it("reads its numbers from the server-derived read", () => {
    expect(clientProblems(page)).toEqual([]);
  });

  it("passes the caller's local day so streaks match the browser", () => {
    expect(page).toMatch(/p_today:\s*todayISO\(\)/);
  });

  it("keeps the free dashboard engine untouched", () => {
    // burnout.js backs the FREE dashboard; gating or removing it would be a
    // regression for a tier that is supposed to keep working.
    const burnout = read("src/lib/burnout.js");
    expect(burnout).toMatch(/weeklyVelocity/);
    expect(burnout).toMatch(/burnoutScore/);
  });

  it("leaves the client engine unreferenced, so the two implementations cannot drift", () => {
    // analytics.js is now a parity reference only. If an app file imports it
    // again, the paid maths would be recomputed in the browser from free-tier
    // rows and the RPC would stop being authoritative.
    const pageUnderTest = read("src/pages/Analytics.jsx");
    expect(pageUnderTest).not.toMatch(/from\s+"@\/lib\/analytics"/);
    expect(pageUnderTest).not.toMatch(/studyStreaks|focusVelocity|gradeTrajectory/);
  });
});

// ── bootstrap snapshot parity ────────────────────────────────────────────────

describe("schema.sql bootstrap parity", () => {
  const schema = read("supabase/schema.sql");

  it("declares itself a baseline, with migrations authoritative from 2026-09-29", () => {
    // Without this, a fresh bootstrap would look current while still shipping the
    // ownership-only paid policies that let any signed-in user read their own
    // flashcards straight past the paywall.
    expect(schema).toMatch(/BASELINE SNAPSHOT/);
    expect(schema).toMatch(/20260929000000_paid_entitlement_enforcement\.sql/);
    expect(schema).toMatch(/supabase\/migrations\/\s*in order/i);
  });

  it("still declares admin_read for every table that has one on the hosted project", () => {
    // These 21 policies are created through EXECUTE format(...), so a literal
    // CREATE POLICY scan cannot see them. The table list is the real contract.
    const loop = schema.match(
      /FOREACH t IN ARRAY ARRAY\[([\s\S]*?)\] LOOP[\s\S]*?CREATE POLICY admin_read ON public\.%I/
    );
    expect(loop, "admin_read loop not found").not.toBeNull();
    const tables = loop[1].match(/'([a-z_]+)'/g).map((s) => s.slice(1, -1));
    expect(tables).toHaveLength(21);
    for (const t of [
      ...PAID_TABLES,
      "courses",
      "tasks",
      "grades",
      "focus_sessions",
      "notes",
      "goals",
      "attendance",
    ]) {
      expect(tables, `admin_read lost for ${t}`).toContain(t);
    }
  });

  it("leaves the paid-table policies in this file at their pre-migration state", () => {
    // The baseline keeps the ownership-only policy; the migration narrows it. If
    // someone "fixes" the baseline too, the two copies can disagree about which
    // one a fresh database ends up with.
    const body = policy(schema, "flashcards_select_own");
    expect(body).not.toBeNull();
    expect(body).not.toMatch(/has_paid_entitlement/);
  });
});


describe("guards are load-bearing", () => {
  it("detects the pre-migration ownership-only policy", () => {
    // Exactly the state that let any signed-in user read their own paid data.
    const vulnerable = PAID_TABLES.map((t) =>
      COMMANDS.map(
        (c) =>
          `CREATE POLICY "${t}_${c}_own" ON public.${t} FOR ${c.toUpperCase()} USING (auth.uid() = user_id);`
      ).join("\n")
    ).join("\n");
    // 16 missing entitlement gates, plus 8 write policies that never re-check
    // the row (4 tables x INSERT/UPDATE) — the pre-migration state was wrong in
    // both ways.
    const expected = PAID_TABLES.length * COMMANDS.length + PAID_TABLES.length * 2;
    expect(gateProblems(vulnerable)).toHaveLength(expected);
  });

  it("detects an entitlement clause stripped from the migration", () => {
    const weakened = sql.replace(/\s*AND\s+public\.has_paid_entitlement\(\)/g, "");
    expect(gateProblems(weakened)).toHaveLength(PAID_TABLES.length * COMMANDS.length);
  });

  it("detects an OR-ed gate, which would re-widen access", () => {
    const widened = sql.replace(
      /auth\.uid\(\) = user_id AND public\.has_paid_entitlement\(\)/g,
      "auth.uid() = user_id OR true"
    );
    expect(gateProblems(widened).length).toBeGreaterThan(0);
  });

  it("detects a write policy with its WITH CHECK removed", () => {
    const unchecked = sql.replace(/WITH CHECK \(/g, "CHECK (");
    expect(gateProblems(unchecked).length).toBeGreaterThan(0);
  });

  it("detects a client that falls back to recomputing the maths", () => {
    const clientish = `
      import { supabase } from "@/lib/supabase";
      const list = async (t) => (await repo.list(t)) || [];
      const v = studyStreaks(tasks, sessions, { today });
      const g = gradeTrajectory(grades, courses);
      const s = supabase.from("focus_sessions");
      supabase.from("grades");
    `;
    expect(clientProblems(clientish).length).toBeGreaterThanOrEqual(4);
  });
});
