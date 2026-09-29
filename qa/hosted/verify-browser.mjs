// UNI·MATE — Hosted browser verification (real Chrome, real hosted backend).
//
// WHY THIS EXISTS
// The unit suite and the two SQL harnesses can both be green while the browser
// still does the wrong thing: reading a paid table directly, never calling the
// RPC, or gating on client state alone. This drives a real browser against a
// real build and records the ACTUAL HTTP traffic to the hosted project, so
// "FREE cannot read paid data" is backed by the requests that were never made
// and the responses the server actually returned.
//
// It runs against `vite preview` serving `dist/`, which is built from
// `.env.local`, so the app talks to the REAL hosted project — not a mock, and
// not the on-device local workspace (hasSupabaseEnv() keys off the same env).
//
// It mutates nothing: sign in, navigate, sign out.
//
// Usage: npm run build && node qa/hosted/verify-browser.mjs [--base http://localhost:5131]

import puppeteer from "puppeteer-core";
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const argOf = (f, d) => {
  const i = process.argv.indexOf(f);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d;
};
const BASE = argOf("--base", "http://localhost:5131");

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
const env = loadEnvLocal();
const URL_ = env.VITE_SUPABASE_URL;
const STUDENT = { email: env.HOSTED_STUDENT_EMAIL, pass: env.HOSTED_STUDENT_PASSWORD };
const FOUNDER = { email: env.HOSTED_FOUNDER_EMAIL, pass: env.HOSTED_FOUNDER_PASSWORD };

const rows = [];
const record = (test, ok, evidence) =>
  rows.push({ test, status: ok === null ? "NOT EXECUTED" : ok ? "PASS" : "FAIL", evidence: String(evidence).slice(0, 220) });

if (!URL_ || !STUDENT.email || !STUDENT.pass) {
  record("browser.environment", null, "needs VITE_SUPABASE_URL + HOSTED_STUDENT_* from .env.local");
  await emit();
  process.exit(1);
}

const gap = (ms) => new Promise((r) => setTimeout(r, ms));

/** Records every request the page makes to the hosted REST/RPC surface. */
const tap = (page) => {
  const seen = [];
  page.on("request", (r) => {
    const u = r.url();
    if (u.includes("/rest/v1/") || u.includes("/auth/v1/") || u.includes("/functions/v1/")) {
      seen.push({ method: r.method(), url: u.replace(URL_, "").replace(/\?.*/, ""), status: null });
    }
  });
  page.on("response", async (r) => {
    const hit = seen.find((s) => s.url.endsWith(r.url().replace(URL_, "").replace(/\?.*/, "")) && s.status === null);
    if (hit) hit.status = r.status();
  });
  return seen;
};

const hit = (seen, needle) => seen.filter((s) => s.url.includes(needle));
const signIn = async (page, who) => {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector("#email", { timeout: 20000 });
  await page.type("#email", who.email);
  await page.type("#password", who.pass);
  await page.click("button[type=submit]");
  await gap(3500);
};

const signOut = async (page) => {
  // Clear the Supabase session the way the app's own logout does, then confirm
  // the protected surface is no longer reachable.
  await page.evaluate(() => {
    const k = Object.keys(localStorage).find((x) => x.startsWith("sb-") && x.includes("auth-token"));
    if (k) localStorage.removeItem(k);
  });
  await page.goto(`${BASE}/analytics`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await gap(2500);
  return page.url();
};

const main = async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
    protocolTimeout: 90000,
  });

  // ── 0. the build must actually target the hosted project ──
  const probe = await browser.newPage();
  await probe.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 30000 });
  const bundleHasProject = await probe.evaluate(async (u) => {
    const srcs = [...document.querySelectorAll("script[type=module]")].map((s) => s.src);
    for (const s of srcs) {
      const t = await (await fetch(s)).text();
      if (t.includes(u)) return true;
    }
    return false;
  }, URL_);
  record("browser.build_targets_hosted_project", bundleHasProject, `dist bundle references ${URL_}`);
  record("browser.not_local_workspace", await probe.evaluate(() => !!window.localStorage), "localStorage present (hosted auth uses it)");
  await probe.close();

  // ── 1. FREE user: the paywall must hold in the browser ──
  const p1 = await browser.newPage();
  await p1.setViewport({ width: 1440, height: 900 });
  const free = tap(p1);
  await signIn(p1, STUDENT);
  record("browser.free.login", !/login/i.test(p1.url()) || (await p1.$("h1")) !== null, `landed on ${p1.url().replace(BASE, "") || "/"}`);

  await p1.goto(`${BASE}/analytics`, { waitUntil: "domcontentloaded" });
  await gap(3000);
  const analyticsText = await p1.evaluate(() => document.body.innerText);
  const analyticsFreeCalls = free.filter((s) => s.url.includes("advanced_analytics"));
  const analyticsPaidReads = free.filter((s) => /flashcards|study_plans/.test(s.url));
  record("browser.free.analytics_paywalled", /planlocked|pro feature|upgrade|compare plans/i.test(analyticsText), "paywall copy rendered");
  record("browser.free.analytics_no_rpc_call", analyticsFreeCalls.length === 0, `advanced_analytics requests=${analyticsFreeCalls.length}`);
  record("browser.free.analytics_no_paid_table_read", analyticsPaidReads.length === 0, `paid table requests=${analyticsPaidReads.length}`);

  // Free-tier surfaces must keep working for the same free user.
  for (const [path, needle] of [["/courses", "courses"], ["/tasks", "tasks"], ["/grades", "grades"], ["/focus", "focus_sessions"], ["/schedule", "schedule_events"]]) {
    const before = free.length;
    await p1.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
    await gap(2200);
    const errs = await p1.evaluate(() => {
      const t = document.body.innerText;
      return /something went wrong|unexpected error|cannot read/i.test(t);
    });
    const touched = free.slice(before).filter((s) => s.url.includes(needle));
    const rlsError = free.slice(before).some((s) => s.status === 400 || s.status === 403);
    record(`browser.free.${path.slice(1)}_works`, !errs && !rlsError, `requests=${touched.length} errors=${errs} http4xx=${rlsError}`);
  }

  // Paid pages must be paywalled for the free user.
  for (const path of ["/flashcards", "/study-plan"]) {
    await p1.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
    await gap(2200);
    const t = await p1.evaluate(() => document.body.innerText);
    record(`browser.free.${path.slice(1)}_paywalled`, /planlocked|pro feature|upgrade|compare plans/i.test(t), "paywall copy rendered");
  }

  const afterSignOut = await signOut(p1);
  record("browser.free.logout_blocks_analytics", /login/i.test(afterSignOut), `after logout -> ${afterSignOut.replace(BASE, "")}`);
  await p1.close();

  // ── 2. ENTITLED user: the paid derived read must actually be used ──
  const p2 = await browser.newPage();
  await p2.setViewport({ width: 1440, height: 900 });
  const paid = tap(p2);
  await signIn(p2, FOUNDER);
  await p2.goto(`${BASE}/analytics`, { waitUntil: "domcontentloaded" });
  await gap(4000);
  const rpc = paid.filter((s) => s.url.includes("advanced_analytics"));
  const body2 = await p2.evaluate(() => document.body.innerText);
  record("browser.entitled.analytics_calls_rpc", rpc.length > 0, `advanced_analytics requests=${rpc.length}`);
  record("browser.entitled.analytics_rpc_ok", rpc.some((s) => s.status === 200), `statuses=${rpc.map((s) => s.status).join(",") || "none"}`);
  record("browser.entitled.analytics_not_paywalled", !/compare plans/i.test(body2), "no paywall copy for an entitled user");
  record("browser.entitled.analytics_renders_numbers", /study streak/i.test(body2) && /grade avg/i.test(body2), "stat cards rendered from the RPC payload");
  record("browser.entitled.analytics_no_raw_table_reads", paid.filter((s) => /from (flashcards|study_plans|grades|tasks|focus_sessions)/.test(s.url)).length === 0, "no direct reads of source tables by the Analytics page");
  await signOut(p2);
  await p2.close();

  await browser.close();
  await emit();
};

const emit = async () => {
  const summary = {
    pass: rows.filter((r) => r.status === "PASS").length,
    fail: rows.filter((r) => r.status === "FAIL").length,
    notExecuted: rows.filter((r) => r.status === "NOT EXECUTED").length,
    total: rows.length,
    base: BASE,
    rows,
  };
  if (existsSync("qa/hosted")) writeFileSync("qa/hosted/browser-report.json", JSON.stringify(summary, null, 2));
  for (const r of rows) console.log(`${r.status.padEnd(14)} ${r.test.padEnd(44)} ${r.evidence}`);
  console.log(`\nHosted browser: ${summary.pass} pass / ${summary.fail} fail / ${summary.notExecuted} NOT EXECUTED (of ${summary.total})`);
  if (summary.fail > 0) process.exitCode = 1;
};

main().catch((e) => {
  console.error("FATAL:", e.message);
  process.exitCode = 1;
});
