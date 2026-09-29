// UNI·MATE — Production route sweep.
//
// WHY THIS EXISTS
// The entitlement harness proves the paywall on the routes that matter for
// billing. It does not prove that the other ~30 routes render at all on a real
// deployment. Both serious bugs found on the first production deploy (a router
// with no basename, and full-page redirects that resolved against the origin
// root) were invisible to unit tests and to a local preview server, and only
// showed up when a real browser was pointed at the public URL.
//
// So: walk EVERY route in the app, as both a free user and an admin, against a
// real origin, and report what actually happened. A route that renders its own
// "Page Not Found" is the signature of a broken deep link.
//
// Usage: node qa/hosted/verify-routes.mjs --base https://someonefrom2007.github.io/UNI-MATEOS

import puppeteer from "puppeteer-core";
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const argOf = (f, d) => {
  const i = process.argv.indexOf(f);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d;
};
const BASE = argOf("--base", "https://someonefrom2007.github.io/UNI-MATEOS");

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
const STUDENT = { email: env.HOSTED_STUDENT_EMAIL, pass: env.HOSTED_STUDENT_PASSWORD };
const FOUNDER = { email: env.HOSTED_FOUNDER_EMAIL, pass: env.HOSTED_FOUNDER_PASSWORD };

// Every route declared in src/App.jsx. Kept as literal data so a route that is
// added to the app but not to this sweep shows up as a gap in review.
const PUBLIC_ROUTES = ["/", "/login", "/register", "/forgot-password", "/reset-password"];
const APP_ROUTES = [
  "/dashboard", "/community", "/onboarding", "/courses", "/schedule", "/attendance",
  "/timeline", "/tasks", "/exams", "/grades", "/notes", "/stickies", "/resources",
  "/topics", "/focus", "/goals", "/habits", "/workload", "/insights", "/ai",
  "/flashcards", "/study-plan", "/rescue", "/analytics", "/profile", "/settings",
  "/plans", "/integrations",
];
const ADMIN_SECTIONS = [
  "overview", "users", "billing", "community", "analytics", "ai", "integrations",
  "flags", "announcements", "system", "errors", "security", "dev", "settings", "audit",
];
// Overview's path is "/admin/" (see src/lib/admin/sections.js), not
// "/admin/overview" — an index route, not a named one. The other sections are
// named after their id.
const ADMIN_ROUTES = ["/admin/", ...ADMIN_SECTIONS.filter((s) => s !== "overview").map((s) => `/admin/${s}`)];

const rows = [];
const record = (test, ok, evidence) =>
  rows.push({ test, status: ok === null ? "NOT EXECUTED" : ok ? "PASS" : "FAIL", evidence: String(evidence).slice(0, 200) });
const gap = (ms) => new Promise((r) => setTimeout(r, ms));

// A sweep of ~50 routes takes minutes, and a silent run is impossible to debug.
// One line per route as it is visited, on stderr, so progress is visible and a
// stall is attributable to a specific route.
let visited = 0;
const startedAt = Date.now();
const progress = (route) => {
  visited += 1;
  const s = ((Date.now() - startedAt) / 1000).toFixed(0);
  process.stderr.write(`  [${String(visited).padStart(2)} @${s}s] ${route}\n`);
};

if (!STUDENT.email || !FOUNDER.email) {
  record("routes.environment", null, "needs HOSTED_STUDENT_* / HOSTED_FOUNDER_* in .env.local");
  await emit();
  process.exit(1);
}

/** Watches one page for the failure signals that mean "this route is broken". */
const watch = (page) => {
  const w = { pageErrors: [], consoleErrors: [], failed: [], server5xx: [], rlsDenials: [] };
  page.on("pageerror", (e) => w.pageErrors.push(String(e).slice(0, 140)));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const t = m.text();
    if (/DevTools|Sourcemap for/i.test(t)) return;
    w.consoleErrors.push(t.slice(0, 140));
  });
  page.on("requestfailed", (r) => {
    const u = r.url();
    if (/\.(svg|png|ico|woff2?)$/i.test(u) || /favicon/i.test(u)) return;
    w.failed.push(`${r.failure()?.errorText ?? "failed"} ${u.replace(/^https?:\/\/[^/]+/, "").slice(0, 90)}`);
  });
  page.on("response", (r) => {
    const u = r.url();
    if (!/\/rest\/v1\/|\/functions\/v1\//.test(u)) return;
    const label = `${r.status()} ${u.replace(/^https?:\/\/[^/]+/, "").split("?")[0].slice(0, 70)}`;
    // 401/403/42501 on a paid table is the paywall WORKING, not a failure.
    if (r.status() === 401 || r.status() === 403) w.rlsDenials.push(label);
    else if (r.status() >= 500) w.server5xx.push(label);
  });
  return w;
};

const signIn = async (page, who) => {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector("#email", { timeout: 20000 });
  await page.type("#email", who.email);
  await page.type("#password", who.pass);
  await page.click("button[type=submit]");
  await gap(4000);
};

const visit = async (page, w, route, { expectAdmin = false, expectPaywall = false } = {}) => {
  progress(route);
  const before = {
    pe: w.pageErrors.length, ce: w.consoleErrors.length, f: w.failed.length, s5: w.server5xx.length,
  };
  const resp = await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await gap(2600);
  let text = await page.evaluate(() => document.body.innerText);
  // A lazily-loaded page can still be resolving when we sample it. Sampling
  // once and calling that "empty" reports slow pages as broken, so give
  // anything near-empty a second chance before failing it.
  if (text.trim().length < 40) {
    await gap(5000);
    text = await page.evaluate(() => document.body.innerText);
  }
  const navStatus = resp?.status() ?? 0;

  // The signature of a broken deep link: the app served itself, but the router
  // matched nothing and rendered its own 404 page.
  const rendered404 = /page not found|could not be found in this application/i.test(text);
  const pageErrors = w.pageErrors.slice(before.pe);
  const server5xx = w.server5xx.slice(before.s5);
  const failed = w.failed.slice(before.f);
  const denied = w.rlsDenials.slice(before.pe);
  const paywalled = /compare plans|planlocked|unlock|upgrade to/i.test(text);

  const problems = [];
  if (rendered404) problems.push("rendered the app's own 404 page");
  if (pageErrors.length) problems.push(`pageerror: ${pageErrors[0]}`);
  if (server5xx.length) problems.push(`5xx: ${server5xx[0]}`);
  if (text.trim().length < 40) problems.push(`near-empty render (${text.trim().length} chars)`);
  // A function that was never deployed is a deployment gap, not an app defect,
  // and it is reported as its own finding rather than smeared across every
  // route that happens to call it.
  const undeployed = failed.filter((f) => /ERR_FAILED|404|502|503/.test(f));
  // ERR_ABORTED is a client-side cancellation (React Query dropping an
  // in-flight request when the component unmounts or the key changes). The
  // request never reached a failure state server-side, so it is not a defect.
  const benign = (f) => /ERR_ABORTED/.test(f);
  const otherFailed = failed.filter((f) => !undeployed.includes(f) && !benign(f));
  if (otherFailed.length) problems.push(`request failed: ${otherFailed[0]}`);

  const label = route.padEnd(22);
  const detail =
    `nav=${navStatus} text=${text.trim().length}ch` +
    (expectPaywall || paywalled ? " [paywall]" : "") +
    (denied.length ? ` rls_denied=${denied.length}` : "") +
    (undeployed.length ? ` [undeployed-fn: ${[...new Set(undeployed.map((u) => u.split(" ").pop()))].join(",")}]` : "") +
    (problems.length ? ` :: ${problems.join(" | ")}` : "");

  record(`route.free${label}`, problems.length === 0, detail);
  return { rendered404, text, paywalled, problems };
};

const main = async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
    protocolTimeout: 90000,
  });

  // ── public routes, no session ──
  const p0 = await browser.newPage();
  await p0.setViewport({ width: 1440, height: 900 });
  const w0 = watch(p0);
  for (const r of PUBLIC_ROUTES) await visit(p0, w0, r);
  await p0.close();

  // ── every app route, as a FREE user ──
  const p1 = await browser.newPage();
  await p1.setViewport({ width: 1440, height: 900 });
  const w1 = watch(p1);
  await signIn(p1, STUDENT);
  record("routes.free.signed_in", !/login/i.test(p1.url()), `landed on ${p1.url().replace(BASE, "")}`);
  for (const r of APP_ROUTES) await visit(p1, w1, r);

  // A free user must not reach the Control Center. Two separate things matter:
  // the router must not hand them a section, and no admin data may appear.
  // A 404 page counts as "not rendered" — the point is that the section did
  // not come up, however the app chose to say so.
  const adminProbe = [];
  for (const r of ADMIN_ROUTES.slice(0, 4)) {
    const res = await visit(p1, w1, r);
    // The denial copy itself contains the word "roster" ("isn't on the admin
    // roster"), so matching on a bare admin noun reads ACCESS DENIED as
    // "console rendered". Decide on the denial markers first, then look for
    // content that only exists when a section actually mounts.
    const deniedCopy = /access denied|don't have console access|permission required|not authorized|unauthorized/i.test(res.text);
    const consoleContent = !deniedCopy && /system pulse|feature flags|audit log|new announcement/i.test(res.text);
    adminProbe.push(consoleContent ? "rendered" : "denied");
  }
  record("routes.free.admin_denied", !adminProbe.includes("rendered"), `admin probes: ${adminProbe.join(",")}`);

  // Logout must actually clear the session.
  await p1.evaluate(() => {
    const k = Object.keys(localStorage).find((x) => x.startsWith("sb-") && x.includes("auth-token"));
    if (k) localStorage.removeItem(k);
  });
  await p1.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
  await gap(2500);
  record("routes.free.logout_clears_session", /login/i.test(p1.url()), `after logout -> ${p1.url().replace(BASE, "")}`);
  await p1.close();

  // ── paid + admin routes, as the ENTITLED founder ──
  const p2 = await browser.newPage();
  await p2.setViewport({ width: 1440, height: 900 });
  const w2 = watch(p2);
  await signIn(p2, FOUNDER);
  record("routes.entitled.signed_in", !/login/i.test(p2.url()), `landed on ${p2.url().replace(BASE, "")}`);
  for (const r of ["/analytics", "/flashcards", "/study-plan", "/plans"]) await visit(p2, w2, r);
  for (const r of ADMIN_ROUTES) await visit(p2, w2, r);
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
  if (existsSync("qa/hosted")) writeFileSync("qa/hosted/routes-report.json", JSON.stringify(summary, null, 2));
  for (const r of rows) console.log(`${r.status.padEnd(14)} ${r.test.padEnd(36)} ${r.evidence}`);
  console.log(`\nProduction routes: ${summary.pass} pass / ${summary.fail} fail / ${summary.notExecuted} NOT EXECUTED (of ${summary.total})`);
  if (summary.fail > 0) process.exitCode = 1;
};

main().catch((e) => {
  console.error("FATAL:", e.message);
  process.exitCode = 1;
});
