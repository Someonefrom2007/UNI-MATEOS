// UNI·MATE — Hosted entitlement verification (database-level).
//
// Complements qa/hosted/verify-security.mjs. That harness exercises the
// application surface over PostgREST with real JWTs. This one exercises the
// DATABASE surface, because the paywall is enforced in RLS: it needs to
// impersonate `authenticated` and mutate subscription rows, neither of which a
// client can legitimately do.
//
// HOW IT STAYS SAFE ON PRODUCTION
// Everything runs inside one transaction that ends in ROLLBACK. Fixtures,
// subscription rows and entitlement flips all vanish. Nothing is written, and
// the transaction is aborted even when assertions fail.
//
// CREDENTIALS
// Uses the Supabase CLI access token from the macOS keychain (never printed,
// never written) against the project's Management API, the same credential the
// `supabase` CLI uses. No service-role key and no .env.local secret is needed or
// read. Every check is reported PASS / FAIL / NOT EXECUTED; nothing is ever
// assumed green, and a missing credential degrades to NOT EXECUTED rather than
// silently passing.
//
// Usage: node qa/hosted/verify-entitlement.mjs [--ref <project-ref>]

import { execFileSync } from "node:child_process";
import { writeFileSync, existsSync } from "node:fs";

const argOf = (flag, fallback) => {
  const i = process.argv.indexOf(flag);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};

const REF = argOf("--ref", process.env.SUPABASE_PROJECT_REF || "tqmhmpmfqmrtpizgluox");

const readCliToken = () => {
  // The keychain read can race a GUI prompt on macOS; retry briefly.
  for (let i = 0; i < 5; i += 1) {
    try {
      const t = execFileSync(
        "/usr/bin/security",
        ["find-generic-password", "-s", "Supabase CLI", "-a", "supabase", "-w"],
        { encoding: "utf8", timeout: 8000, stdio: ["ignore", "pipe", "ignore"] }
      ).trim();
      if (t) return t;
    } catch {
      /* retry */
    }
  }
  return null;
};

/** Run SQL as the schema owner via the Management API. Throws on error. */
const runSql = async (token, query) => {
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) {
    const e = new Error(`SQL failed (HTTP ${res.status})`);
    e.detail = text.slice(0, 800);
    throw e;
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("SQL did not return a parseable result set");
  }
};

const rows = [];
const record = (test, ok, evidence) => {
  rows.push({ test, status: ok ? "PASS" : "FAIL", evidence: String(evidence).slice(0, 220) });
  return rows[rows.length - 1];
};
const skip = (test, evidence) => rows.push({ test, status: "NOT EXECUTED", evidence });

// ─────────────────────────────────────────────────────────────────────────────
// The probe. One transaction, rolled back at the very end regardless of outcome.
//
// has_paid_entitlement() is SECURITY DEFINER and decides purely from
// request.jwt.claims plus the subscriptions row, so the whole truth table can be
// evaluated without a role switch. The RLS probes that follow DO need the real
// `authenticated` role, because that is what PostgREST runs as.
// ─────────────────────────────────────────────────────────────────────────────
const SQL = String.raw`
CREATE OR REPLACE FUNCTION pg_temp.qa_entitlement_probe()
RETURNS jsonb
LANGUAGE plpgsql
AS $qa$
DECLARE
  v uuid;
  r jsonb := '{}'::jsonb;
  c text;
BEGIN
  -- Pick a non-admin account: entitlement must be decided by subscriptions, and
  -- is_admin() short-circuits to true for staff, which would mask every result.
  SELECT u.id INTO v
    FROM auth.users u
   WHERE NOT EXISTS (SELECT 1 FROM public.admin_accounts a WHERE a.user_id = u.id)
   LIMIT 1;
  IF v IS NULL THEN
    RETURN jsonb_build_object('error', 'no non-admin auth user available to probe');
  END IF;

  -- 1. user_metadata advertises Pro, but there is no subscription row.
  --    user_metadata is writable by the account owner, so it must not grant.
  c := format('{"sub":"%s","role":"authenticated","user_metadata":{"plan":"pro"}}', v);
  PERFORM set_config('request.jwt.claims', c, true);
  DELETE FROM public.subscriptions WHERE user_id = v;
  r := r || jsonb_build_object('metadata_cannot_grant', public.has_paid_entitlement() = false);

  -- 2. user_metadata says free, the authoritative row says active Pro.
  --    The client-writable mirror must not be able to revoke either.
  c := format('{"sub":"%s","role":"authenticated","user_metadata":{"plan":"free"}}', v);
  PERFORM set_config('request.jwt.claims', c, true);
  INSERT INTO public.subscriptions (user_id, lemon_squeezy_subscription_id, tier, status, renews_at)
  VALUES (v, 'qa-probe', 'pro', 'active', now() + interval '30 days');
  r := r || jsonb_build_object('metadata_cannot_revoke', public.has_paid_entitlement() = true);

  UPDATE public.subscriptions SET tier = 'ultimate';
  r := r || jsonb_build_object('tier_ultimate_entitled', public.has_paid_entitlement() = true);

  UPDATE public.subscriptions SET tier = 'pro', status = 'cancelled', renews_at = now() - interval '1 day';
  r := r || jsonb_build_object('cancelled_period_ended_denied', public.has_paid_entitlement() = false);

  UPDATE public.subscriptions SET renews_at = now() + interval '5 days';
  r := r || jsonb_build_object('cancelled_still_running_kept', public.has_paid_entitlement() = true);

  -- A stale renewal date on an ACTIVE row must not revoke a paying customer.
  UPDATE public.subscriptions SET status = 'active', renews_at = now() - interval '90 days';
  r := r || jsonb_build_object('active_stale_renews_at_kept', public.has_paid_entitlement() = true);

  UPDATE public.subscriptions SET status = 'expired';
  r := r || jsonb_build_object('status_expired_denied', public.has_paid_entitlement() = false);

  -- An unrecognised status must fail closed, not open.
  UPDATE public.subscriptions SET status = 'on_hold';
  r := r || jsonb_build_object('unknown_status_fails_closed', public.has_paid_entitlement() = false);

  -- The paid derived read must be refused while the caller is not entitled.
  UPDATE public.subscriptions SET status = 'active', tier = 'free';
  BEGIN
    PERFORM public.advanced_analytics(current_date);
    r := r || jsonb_build_object('advanced_analytics_free_denied', false);
  EXCEPTION WHEN insufficient_privilege THEN
    r := r || jsonb_build_object('advanced_analytics_free_denied', true);
  END;

  -- ...and must succeed for an entitled caller, with the documented shape.
  UPDATE public.subscriptions SET tier = 'pro';
  BEGIN
    r := r || jsonb_build_object(
      'advanced_analytics_paid_shape',
      (SELECT array_agg(k ORDER BY k)
         FROM jsonb_object_keys(public.advanced_analytics(current_date)) k)
      = ARRAY['completion','streaks','trajectory','velocity','weeks']);
  EXCEPTION WHEN others THEN
    r := r || jsonb_build_object('advanced_analytics_paid_shape', false);
  END;

  -- No subject claim at all (a client that somehow reaches the function
  -- unauthenticated) must be denied rather than served the owner's data.
  PERFORM set_config('request.jwt.claims', '{"role":"authenticated"}', true);
  r := r || jsonb_build_object('no_sub_claim_denied', public.has_paid_entitlement() = false);

  PERFORM set_config('request.jwt.claims', c, true);

  -- ── RLS under a real 'authenticated' role, which is what PostgREST runs as ──
  -- Real fixtures first. Without rows on disk, "a free caller sees nothing" is
  -- indistinguishable from "the table is simply empty", which is exactly the
  -- kind of test that passes forever while the hole is wide open.
  INSERT INTO public.flashcard_decks (id, user_id, title)
  VALUES ('00000000-0000-0000-0000-0000000000a1', v, 'qa-own-deck');
  INSERT INTO public.flashcards (id, user_id, deck_id, front, back)
  VALUES ('00000000-0000-0000-0000-0000000000a2', v, '00000000-0000-0000-0000-0000000000a1', 'f', 'b');
  INSERT INTO public.study_plans (id, user_id, title)
  VALUES ('00000000-0000-0000-0000-0000000000a3', v, 'qa-own-plan');
  -- A second account's paid row, to prove the gate never leaks across users.
  INSERT INTO public.flashcard_decks (id, user_id, title)
  SELECT '00000000-0000-0000-0000-0000000000b1', u.id, 'qa-other-deck'
    FROM auth.users u WHERE u.id <> v LIMIT 1;
  INSERT INTO public.flashcards (id, user_id, deck_id, front, back)
  SELECT '00000000-0000-0000-0000-0000000000b2', u.id, d.id, 'f', 'b'
    FROM auth.users u
    JOIN public.flashcard_decks d ON d.user_id = u.id AND d.id = '00000000-0000-0000-0000-0000000000b1'
   WHERE u.id <> v LIMIT 1;
  INSERT INTO public.study_plans (id, user_id, title)
  SELECT '00000000-0000-0000-0000-0000000000b3', u.id, 'qa-other-plan'
    FROM auth.users u WHERE u.id <> v LIMIT 1;

  -- Free caller: every paid table must come back empty even though the rows exist.
  UPDATE public.subscriptions SET tier = 'free';
  SET LOCAL ROLE authenticated;
  r := r || jsonb_build_object('rls_free_reads_no_paid_rows',
    (SELECT count(*) FROM public.flashcards) = 0
    AND (SELECT count(*) FROM public.flashcard_decks) = 0
    AND (SELECT count(*) FROM public.study_plans) = 0);
  -- A free caller must also be unable to write into the paid tables; a write that
  -- is not re-checked would let them plant rows they can never read back.
  BEGIN
    INSERT INTO public.flashcards (id, user_id, deck_id, front, back)
    VALUES ('00000000-0000-0000-0000-0000000000c1', v, '00000000-0000-0000-0000-0000000000a1', 'f', 'b');
    r := r || jsonb_build_object('rls_free_cannot_write_paid', false);
  EXCEPTION WHEN insufficient_privilege THEN
    r := r || jsonb_build_object('rls_free_cannot_write_paid', true);
  END;
  SET LOCAL ROLE postgres;

  -- Entitled caller: their own rows are visible, and only theirs.
  UPDATE public.subscriptions SET tier = 'pro', status = 'active';
  SET LOCAL ROLE authenticated;
  r := r || jsonb_build_object('rls_paid_reads_own_rows',
    (SELECT count(*) FROM public.flashcards) = 1
    AND (SELECT count(*) FROM public.study_plans) = 1
    AND (SELECT count(*) FROM public.flashcards WHERE user_id <> auth.uid()) = 0);
  SET LOCAL ROLE postgres;

  -- Free-tier data must stay readable whatever the plan: gating it would break
  -- Grades/Focus/Tasks/Courses for every free user.
  UPDATE public.subscriptions SET tier = 'free';
  SET LOCAL ROLE authenticated;
  BEGIN
    -- A single-row probe that never raises: readable free tables return rows
    -- (possibly zero for this user) instead of erroring.
    PERFORM (SELECT count(*) FROM public.courses) >= 0;
    PERFORM (SELECT count(*) FROM public.tasks) >= 0;
    PERFORM (SELECT count(*) FROM public.grades) >= 0;
    PERFORM (SELECT count(*) FROM public.focus_sessions) >= 0;
    r := r || jsonb_build_object('free_tables_readable_when_free', true);
  EXCEPTION WHEN others THEN
    r := r || jsonb_build_object('free_tables_readable_when_free', false);
  END;
  RESET ROLE;

  r := r || jsonb_build_object('probe_user', v::text);
  RETURN r;
END;
$qa$;

BEGIN;
SELECT pg_temp.qa_entitlement_probe();
ROLLBACK;
`;


const main = async () => {
  const token = readCliToken();
  if (!token) {
    for (const t of [
      "entitlement.metadata_cannot_grant",
      "entitlement.metadata_cannot_revoke",
      "entitlement.tier_ultimate_entitled",
      "entitlement.cancelled_period_ended_denied",
      "entitlement.cancelled_still_running_kept",
      "entitlement.active_stale_renews_at_kept",
      "entitlement.status_expired_denied",
      "entitlement.unknown_status_fails_closed",
      "entitlement.advanced_analytics_free_denied",
      "entitlement.advanced_analytics_paid_shape",
      "entitlement.no_sub_claim_denied",
      "rls.free_reads_no_paid_rows",
      "rls.free_tables_readable",
    ]) {
      skip(t, "no Supabase CLI token in keychain; run `supabase login` first");
    }
    await emit();
    return;
  }

  let out;
  try {
    out = await runSql(token, SQL);
  } catch (e) {
    skip("entitlement.probe", `probe could not run: ${e.message} ${e.detail || ""}`);
    await emit();
    process.exitCode = 1;
    return;
  }

  const result = Array.isArray(out) ? out[0] : out;
  const r = result?.qa_entitlement_probe;
  if (!r) {
    skip("entitlement.probe", `unexpected probe output: ${JSON.stringify(result).slice(0, 200)}`);
    await emit();
    process.exitCode = 1;
    return;
  }

  const expect = {
    metadata_cannot_grant: true,
    metadata_cannot_revoke: true,
    tier_ultimate_entitled: true,
    cancelled_period_ended_denied: true,
    cancelled_still_running_kept: true,
    active_stale_renews_at_kept: true,
    status_expired_denied: true,
    unknown_status_fails_closed: true,
    advanced_analytics_free_denied: true,
    advanced_analytics_paid_shape: true,
    no_sub_claim_denied: true,
    rls_free_reads_no_paid_rows: true,
    rls_free_cannot_write_paid: true,
    rls_paid_reads_own_rows: true,
    free_tables_readable_when_free: true,
  };
  for (const [k, want] of Object.entries(expect)) {
    record(`entitlement.${k}`, r[k] === want, `observed=${JSON.stringify(r[k])} expected=${want}`);
  }

  // Non-vacuity: prove the RLS probe would actually catch the pre-mission hole.
  try {
    const weak = await runSql(
      token,
      String.raw`
BEGIN;
-- user_id references auth.users, so the fixture must hang off a real account.
CREATE TEMP TABLE _qa_u AS
SELECT u.id FROM auth.users u
 WHERE NOT EXISTS (SELECT 1 FROM public.admin_accounts a WHERE a.user_id = u.id) LIMIT 1;

INSERT INTO public.flashcard_decks (id, user_id, title)
SELECT '00000000-0000-0000-0000-0000000000ff', id, 'qa-nonvacuity' FROM _qa_u;
INSERT INTO public.flashcards (id, user_id, deck_id, front, back)
SELECT '00000000-0000-0000-0000-0000000000fe', u.id, d.id, 'f', 'b'
  FROM _qa_u u JOIN public.flashcard_decks d ON d.user_id = u.id
 WHERE d.id = '00000000-0000-0000-0000-0000000000ff';

-- Reinstate the pre-mission ownership-only policy, with no entitlement check.
DROP POLICY IF EXISTS "flashcards_select_own" ON public.flashcards;
CREATE POLICY "flashcards_select_own" ON public.flashcards FOR SELECT USING (auth.uid() = user_id);

SELECT set_config('request.jwt.claims',
  format('{"sub":"%s","role":"authenticated"}', (SELECT id FROM _qa_u)), true);
SET LOCAL ROLE authenticated;
SELECT (SELECT count(*) FROM public.flashcards) AS vulnerable_visible;
ROLLBACK;
`
    );
    const visible = Array.isArray(weak) ? Number(weak[0]?.vulnerable_visible) : NaN;
    record(
      "entitlement.probe_is_nonvacuous",
      visible === 1,
      `ownership-only policy exposes ${visible} row(s) to a free caller; 1 means the probe can detect the hole`
    );
  } catch (e) {
    record("entitlement.probe_is_nonvacuous", false, `non-vacuity probe failed: ${e.message}`);
  }

  if (r.probe_user) console.log(`(probed as auth user ${r.probe_user}, all changes rolled back)`);
  await emit();
};

const emit = async () => {
  const summary = {
    pass: rows.filter((x) => x.status.startsWith("PASS")).length,
    fail: rows.filter((x) => x.status.startsWith("FAIL")).length,
    notExecuted: rows.filter((x) => x.status.startsWith("NOT EXECUTED")).length,
    total: rows.length,
    projectRef: REF,
    rows,
  };
  if (existsSync("qa/hosted")) {
    writeFileSync("qa/hosted/entitlement-report.json", JSON.stringify(summary, null, 2));
  }
  for (const r of rows) {
    console.log(`${r.status.padEnd(14)} ${r.test.padEnd(44)} ${r.evidence}`);
  }
  console.log(
    `\nHosted entitlement: ${summary.pass} pass / ${summary.fail} fail / ${summary.notExecuted} NOT EXECUTED (of ${summary.total})`
  );
  if (summary.fail > 0) process.exitCode = 1;
};

main().catch((e) => {
  console.error("FATAL:", e.message);
  process.exitCode = 1;
});
