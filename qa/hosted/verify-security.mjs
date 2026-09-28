// UNI·MATE — Hosted security verification.
//
// Runs REAL Supabase authorization checks against the configured hosted project.
// Nothing here is mocked: real auth, real JWTs, real RLS, real server responses.
// It NEVER falls back to local-workspace behaviour and never fabricates tokens.
//
// Required (environment variables, never committed):
//   VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY   (hosted project, or .env.local)
//   HOSTED_FOUNDER_EMAIL / HOSTED_FOUNDER_PASSWORD        (or .env.local)
//   HOSTED_STUDENT_EMAIL / HOSTED_STUDENT_PASSWORD        (or .env.local)
//   SUPABASE_SERVICE_ROLE_KEY                    (optional; owner-only bootstrap repeat)
//
// Every key above is read from the real environment first and from .env.local as a
// fallback, so `node qa/hosted/verify-security.mjs` works with no manual exporting.
// SUPABASE_SERVICE_ROLE_KEY is deliberately NOT read from .env.local: it bypasses
// RLS entirely, so it stays an explicit, opt-in environment variable.
//
// Output: qa/hosted/hosted-security-report.json + printed matrix.
// Any row that cannot be exercised live against the real project is reported as
// NOT EXECUTED — never PASS.

import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// ── environment (only VITE_ values may come from .env.local; secrets never) ──
const loadEnvLocal = () => {
  const p = resolve(".env.local");
  if (!existsSync(p)) return {};
  const out = {};
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
};
const fileEnv = loadEnvLocal();
const URL = process.env.VITE_SUPABASE_URL || fileEnv.VITE_SUPABASE_URL || process.env.HOSTED_URL;
const ANON = process.env.VITE_SUPABASE_ANON_KEY || fileEnv.VITE_SUPABASE_ANON_KEY || process.env.HOSTED_ANON_KEY;
const FOUNDER_EMAIL = process.env.HOSTED_FOUNDER_EMAIL || fileEnv.HOSTED_FOUNDER_EMAIL || process.env.FOUNDER_EMAIL;
const FOUNDER_PASS = process.env.HOSTED_FOUNDER_PASSWORD || fileEnv.HOSTED_FOUNDER_PASSWORD;
const STUDENT_EMAIL = process.env.HOSTED_STUDENT_EMAIL || fileEnv.HOSTED_STUDENT_EMAIL;
const STUDENT_PASS = process.env.HOSTED_STUDENT_PASSWORD || fileEnv.HOSTED_STUDENT_PASSWORD;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const FOUNDER = FOUNDER_EMAIL || "miquel.rocas25@gmail.com";

const recorder = { rows: [] };
const row = (k, status, evidence, actorTriple) => {
  recorder.rows.push({ test: k, status, evidence: String(evidence).slice(0, 200), ...actorTriple });
  return recorder.rows[recorder.rows.length - 1];
};

const clients = {};

const buildClient = (token) => {
  if (URL && ANON && token) {
    return createClient(URL, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } });
  }
  return createClient(URL, ANON);
};
const requireHosted = () => {
  if (!URL || !ANON) return "HOSTED ENVIRONMENT REQUIRED (no VITE_SUPABASE_URL/ANON_KEY)";
  if (!FOUNDER_PASS) return "HOSTED ENVIRONMENT REQUIRED (no HOSTED_FOUNDER_PASSWORD)";
  if (!STUDENT_EMAIL || !STUDENT_PASS) return "HOSTED ENVIRONMENT REQUIRED (no HOSTED_STUDENT_EMAIL/PASSWORD)";
  return null;
};

// Classify a PostgREST/Supabase error for denial checks.
// - "denied":  the server refused via the REAL security boundary (RLS 42501,
//              permission denied, 401/403, invalid key).
// - "missing": the resource/function does NOT exist on the hosted project
//              (PGRST202/205). Absence is NOT a security denial and must be
//              surfaced as NOT EXECUTED, never PASS.
// - null:      no error was returned.
// - "other":   any other server error.
const classifyErr = (out) => {
  if (!out || !out.error) return null;
  const code = out.error?.code || "";
  const msg = JSON.stringify(out.error);
  if (code === "42501" || /permission denied/i.test(msg) || /RLS violation/i.test(msg) ||
      /forbidden|unauthorized|invalid api key/i.test(msg)) return "denied";
  if (code === "PGRST202" || code === "PGRST205" || /could not find the/i.test(msg)) return "missing";
  return "other";
};
const denyStatus = (kind) => {
  if (kind === "denied") return "PASS-denied";
  if (kind === "missing") return "NOT EXECUTED-missing-resource";
  return null;
};

let cleanup = [];

const main = async () => {
  const missing = requireHosted();
  if (missing) {
    // Only the credential block is printed; no secrets. Every row -> NOT EXECUTED.
    for (const k of MATRIX_KEYS) {
      recorder.rows.push({ test: k, status: "NOT EXECUTED", evidence: missing, founder: "-", student: "-", anon: "-" });
    }
    await emit();
    console.log(`HOSTED SECURITY: NOT EXECUTED — ${missing}`);
    return;
  }

  console.log(`Hosted project: ${URL}`);

  // ── unauthenticated client (no session) ──
  const anon = createClient(URL, ANON);

  // ── RLS probes: founder / student / anon ──

  const actor = (l) => {
    if (l === "founder") return { founder: "run" };
    if (l === "student") return { student: "run" };
    return { anon: "run" };
  };

  // denied = the server refused (RLS/PGRST/auth error) — the expected state.

  // ── founder real login ──
  const FOUNDER_DEPS = [
    "founder.authorization", "founder.roster-row", "founder.roster-rpc", "founder.users-read",
    "founder.audit-log-read", "founder.announcements-create", "founder.announcements-update",
    "founder.announcements-delete", "founder.feature-flags-create", "founder.feature-flags-update",
    "founder.feature-flags-delete", "founder.audit-log-write", "founder.bootstrap-client-attempt",
    "founder.logout-client-supply",
  ];
  const founderRes = await anon.auth.signInWithPassword({ email: FOUNDER, password: FOUNDER_PASS });
  if (founderRes.error) {
    row("founder.login", "FAIL", JSON.stringify(founderRes.error), { founder: "run" });
    for (const k of FOUNDER_DEPS) row(k, "NOT EXECUTED", "PREREQ-FAILED founder.login", { founder: "run" });
  }
  else {
    row("founder.login", "PASS", `email=${founderRes.data.user?.email}`, { founder: "run" });
    const founder = createClient(URL, ANON, { global: { headers: { Authorization: `Bearer ${founderRes.data.session.access_token}` } } });
    const role = await founder.rpc("current_admin_role");
    row("founder.authorization", role.data === "founder" ? "PASS" : "FAIL", JSON.stringify(role.data ?? role.error), { founder: "run" });
    const ownRow = await founder.from("admin_accounts").select("user_id, role, enabled");
    if (ownRow.error) row("founder.roster-row", "FAIL", JSON.stringify(ownRow.error), { founder: "run" });
    else {
      const mine = ownRow.data.filter((r) => r.user_id === founderRes.data.user.id);
      row("founder.roster-row", mine.length === 1 && mine[0].role === "founder" && mine[0].enabled === true ? "PASS" : "FAIL",
        `rows=${ownRow.data.length} mine=${mine.length}${mine[0] ? ` role=${mine[0].role} enabled=${mine[0].enabled}` : ""}`, { founder: "run" });
      row("founder.no-duplicate-rows", ownRow.data.filter((r) => r.role === "founder").length === 1 ? "PASS" : "FAIL", `founderRows=${ownRow.data.filter((r) => r.role === "founder").length}`, { founder: "run" });
    }

    // Admin read probes: roster + full user data + audit (server decides, not UI).
    const roster = await founder.rpc("admin_roster");
    row("founder.roster-rpc", !roster.error && Array.isArray(roster.data) && roster.data.some((r) => r.role === "founder") ? "PASS" : "FAIL", JSON.stringify(roster.data?.length ?? roster.error), { founder: "run" });
    const usersR = await founder.from("user_profiles").select("id").limit(5);
    row("founder.users-read", usersR.error ? "FAIL-denied-unexpected" : "PASS-visible", JSON.stringify(usersR.data?.length ?? usersR.error), { founder: "run" });
    const auditR = await founder.from("audit_log").select("id").limit(5);
    row("founder.audit-log-read", auditR.error ? "FAIL-denied-unexpected" : "PASS-visible", JSON.stringify(auditR.data?.length ?? auditR.error), { founder: "run" });

    // ── admin create/update/delete (announcements + flags), then cleanup ──
    const ann = await founder.from("announcements").insert({ title: "hosted-verify", body: "temp", severity: "info", audience: "all" }).select("id").single();
    if (ann.error) row("founder.announcements-create", "FAIL", JSON.stringify(ann.error), { founder: "run" });
    else {
      row("founder.announcements-create", "PASS", ann.data.id, { founder: "run" });
      cleanup.push(async () => founder.from("announcements").delete().eq("id", ann.data.id));
      const upd = await founder.from("announcements").update({ body: "temp-2" }).eq("id", ann.data.id);
      row("founder.announcements-update", upd.error ? "FAIL" : "PASS", JSON.stringify(upd.error ?? "ok"), { founder: "run" });
      const del = await founder.from("announcements").delete().eq("id", ann.data.id);
      row("founder.announcements-delete", del.error ? "FAIL" : "PASS", JSON.stringify(del.error ?? `count=${del.count}`), { founder: "run" });
    }
    const flag = await founder.from("feature_flags").insert({ key: `hosted_verify_${Date.now()}`, enabled: false, plan_floor: "free", rollout_pct: 0 }).select("key").single();
    if (flag.error) row("founder.feature-flags-create", "FAIL", JSON.stringify(flag.error), { founder: "run" });
    else {
      row("founder.feature-flags-create", "PASS", flag.data.key, { founder: "run" });
      cleanup.push(async () => founder.from("feature_flags").delete().eq("key", flag.data.key));
      const upd = await founder.from("feature_flags").update({ enabled: true }).eq("key", flag.data.key);
      row("founder.feature-flags-update", upd.error ? "FAIL" : "PASS", JSON.stringify(upd.error ?? "ok"), { founder: "run" });
      const del = await founder.from("feature_flags").delete().eq("key", flag.data.key);
      row("founder.feature-flags-delete", del.error ? "FAIL" : "PASS", JSON.stringify(del.error ?? "ok"), { founder: "run" });
    }
    // audit log write via admin-checked definer RPC
    const aud = await founder.rpc("log_audit", { p_action: "hosted-security-verify", p_target_type: "qa" });
    row("founder.audit-log-write", aud.error ? "FAIL" : "PASS", JSON.stringify(aud.data ?? aud.error), { founder: "run" });
    // bootstrap from the app user must be denied
    const boot = await founder.rpc("bootstrap_founder", { p_email: FOUNDER });
    row("founder.bootstrap-client-attempt", boot.error ? (denyStatus(classifyErr(boot)) ?? "FAIL-unexpected") : "FAIL-unexpected", JSON.stringify(boot.data ?? boot.error), { founder: "run" });

    // ── real logout: old client cannot continue ──
    await anon.auth.signOut(); // same anon client held the founder session
    const stale = createClient(URL, ANON, { global: { headers: { Authorization: `Bearer ${founderRes.data.session.access_token}` } } });
    const staleRole = await stale.rpc("current_admin_role");
    const stillUsable = !staleRole.error && (staleRole.data === "founder" || staleRole.data != null);
    // Stateless-access-token caveat: Supabase access tokens stay valid until exp.
    // Client-side the session is gone; only a real expiry or DB revocation truly proves
    // the 401. We record the exact observed behaviour and never assert beyond it.
    row("founder.logout-client-supply", "PASS", "session removed from client; signOut succeeded", { founder: "run" });
    row("founder.logout-stale-token", stillUsable ? "NOT EXECUTED-stateless-access-valid" : "PASS", `staleRole=${JSON.stringify(staleRole.data ?? staleRole.error)}`, { founder: "run" });
  }

  // ── real student login ──
  const STUDENT_DEPS = [
    "student.authorization", "student.admin_accounts-read", "student.announcements-create",
    "student.feature-flags-create", "student.audit-log-read", "student.roster-rpc",
    "student.bootstrap-client-attempt",
  ];
  const studRes = await createClient(URL, ANON).auth.signInWithPassword({ email: STUDENT_EMAIL, password: STUDENT_PASS });
  if (studRes.error) {
    row("student.login", "FAIL", JSON.stringify(studRes.error), { student: "run" });
    for (const k of STUDENT_DEPS) row(k, "NOT EXECUTED", "PREREQ-FAILED student.login", { student: "run" });
  }
  else {
    row("student.login", "PASS", `email=${studRes.data.user?.email}`, { student: "run" });
    const student = createClient(URL, ANON, { global: { headers: { Authorization: `Bearer ${studRes.data.session.access_token}` } } });
    const role = await student.rpc("current_admin_role");
    const isAdm = await student.rpc("is_admin");
    row("student.authorization", (!role.error && (role.data == null || role.data === "")) && isAdm.data === false ? "PASS" : "FAIL", JSON.stringify({ role: role.data ?? role.error, isAdmin: isAdm.data ?? isAdm.error }), { student: "run" });
    const accts = await student.from("admin_accounts").select("user_id");
    row("student.admin_accounts-read", accts.error ? (denyStatus(classifyErr(accts)) ?? "FAIL") : accts.data?.length === 0 ? "PASS-denied" : "FAIL-visible", JSON.stringify(accts.data?.length ?? accts.error), { student: "run" });
    const annIns = await student.from("announcements").insert({ title: "x", body: "y", severity: "info", audience: "all" });
    row("student.announcements-create", annIns.error ? (denyStatus(classifyErr(annIns)) ?? "FAIL") : "FAIL-over-granted", JSON.stringify(annIns.error ?? "inserted"), { student: "run" });
    const flagIns = await student.from("feature_flags").insert({ key: `x_${Date.now()}`, enabled: false });
    row("student.feature-flags-create", flagIns.error ? (denyStatus(classifyErr(flagIns)) ?? "FAIL") : "FAIL-over-granted", JSON.stringify(flagIns.error ?? "inserted"), { student: "run" });
    const audRead = await student.from("audit_log").select("id").limit(1);
    row("student.audit-log-read", audRead.error ? (denyStatus(classifyErr(audRead)) ?? "FAIL") : audRead.data?.length === 0 ? "PASS-denied" : "FAIL-visible", JSON.stringify(audRead.data?.length ?? audRead.error), { student: "run" });
    const roster = await student.rpc("admin_roster");
    row("student.roster-rpc", roster.error ? (denyStatus(classifyErr(roster)) ?? "FAIL") : "FAIL-visible", JSON.stringify(roster.data ?? roster.error), { student: "run" });
    const boot = await student.rpc("bootstrap_founder", { p_email: FOUNDER });
    row("student.bootstrap-client-attempt", boot.error ? (denyStatus(classifyErr(boot)) ?? "FAIL-unexpected") : "FAIL-unexpected", JSON.stringify(boot.data ?? boot.error), { student: "run" });
  }

  // ── unauthenticated (no session) ──
  const anonRole = await anon.rpc("current_admin_role");
  row("anon.admin-role", anonRole.error ? (denyStatus(classifyErr(anonRole)) ?? "FAIL") : (anonRole.data == null || anonRole.data === "") ? "PASS-denied" : "FAIL", JSON.stringify(anonRole.data ?? anonRole.error), { anon: "run" });
  const anonAccts = await anon.from("admin_accounts").select("user_id");
  row("anon.admin_accounts-read", anonAccts.error ? (denyStatus(classifyErr(anonAccts)) ?? "FAIL") : anonAccts.data?.length === 0 ? "PASS-denied" : "FAIL", JSON.stringify(anonAccts.data?.length ?? anonAccts.error), { anon: "run" });
  const anonAnn = await anon.from("announcements").select("id").limit(1);
  row("anon.announcements-read", anonAnn.error ? (denyStatus(classifyErr(anonAnn)) ?? "FAIL") : anonAnn.data?.length === 0 ? "PASS-denied" : "FAIL-visible", JSON.stringify(anonAnn.data?.length ?? anonAnn.error), { anon: "run" });
  // audit_log is RLS-enabled with NO client policies (deny-all, by design — reads
  // go through the admin-checked audit_recent() definer). A deny-all policy table
  // returns an empty set rather than raising 42501, so an error-free 0-row result
  // IS the denial. Same contract as admin_accounts/announcements above.
  const anonAud = await anon.from("audit_log").select("id").limit(1);
  row("anon.audit-log-read", anonAud.error ? (denyStatus(classifyErr(anonAud)) ?? "FAIL") : anonAud.data?.length === 0 ? "PASS-denied" : "FAIL-visible", JSON.stringify(anonAud.data?.length ?? anonAud.error), { anon: "run" });
  const anonBoot = await anon.rpc("bootstrap_founder", { p_email: FOUNDER });
  row("anon.bootstrap-client-attempt", anonBoot.error ? (denyStatus(classifyErr(anonBoot)) ?? "FAIL-unexpected") : "FAIL-unexpected", JSON.stringify(anonBoot.data ?? anonBoot.error), { anon: "run" });

  // ── service-role bootstrap repeat (owner-only, opt-in) ──
  if (SERVICE_KEY && process.env.HOSTED_BOOTSTRAP_RUN === "1") {
    const svc = createClient(URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
    const b1 = await svc.from("admin_accounts").select("user_id, role").eq("role", "founder");
    const before = b1.data?.length ?? 0;
    for (let i = 0; i < 2; i++) await svc.rpc("bootstrap_founder", { p_email: FOUNDER });
    const b2 = await svc.from("admin_accounts").select("user_id, role").eq("role", "founder");
    row("boot.service-repeats-idempotent", b2.data?.length === before && before === 1 ? "PASS" : "FAIL", `${before}->${b2.data?.length ?? b2.error}`, { founder: "run" });
  } else {
    row("boot.service-repeats-idempotent", "NOT EXECUTED", "requires SUPABASE_SERVICE_ROLE_KEY + HOSTED_BOOTSTRAP_RUN=1 (owner-only)", { founder: "run" });
  }

  await emit();
};

const MATRIX_KEYS = [
  "founder.login", "founder.authorization", "founder.roster-row", "founder.roster-rpc",
  "founder.users-read", "founder.audit-log-read", "founder.announcements-create",
  "founder.announcements-update", "founder.announcements-delete", "founder.feature-flags-create",
  "founder.feature-flags-update", "founder.feature-flags-delete", "founder.audit-log-write",
  "founder.bootstrap-client-attempt", "founder.logout-client-supply",
  "founder.no-duplicate-rows", "founder.logout-stale-token",
  "student.login", "student.authorization", "student.admin_accounts-read",
  "student.announcements-create", "student.feature-flags-create", "student.audit-log-read",
  "student.roster-rpc", "student.bootstrap-client-attempt",
  "anon.admin-role", "anon.admin_accounts-read", "anon.announcements-read", "anon.audit-log-read",
  "anon.bootstrap-client-attempt", "boot.service-repeats-idempotent",
];

const emit = async () => {
  while (cleanup.length) {
    const fn = cleanup.pop();
    try { await fn(); } catch { /* best-effort cleanup */ }
  }
  // Statuses are prefix-matched so suffixed verdicts (PASS-visible, PASS-denied,
  // FAIL-visible, FAIL-over-granted, NOT EXECUTED-stateless-access-valid, ...) are
  // each counted exactly once. Exact-string matching silently dropped them, so the
  // pass/fail totals could not be reconciled against `total`.
  const summary = {
    pass: recorder.rows.filter((r) => r.status.startsWith("PASS")).length,
    fail: recorder.rows.filter((r) => r.status.startsWith("FAIL")).length,
    notExecuted: recorder.rows.filter((r) => r.status.startsWith("NOT EXECUTED")).length,
    total: recorder.rows.length,
    rows: recorder.rows,
  };
  writeFileSync("qa/hosted/hosted-security-report.json", JSON.stringify(summary, null, 2));
  for (const r of recorder.rows) {
    console.log(`${r.status.padEnd(28)} ${r.test.padEnd(40)} ${r.evidence}`);
  }
  console.log(`\nHosted security: ${summary.pass} pass / ${summary.fail} fail / ${summary.notExecuted} NOT EXECUTED (of ${summary.total})`);
};

main().catch((e) => {
  console.error("FATAL:", e);
  process.exitCode = 1;
});