// E2E — route audit: every route, direct nav, fresh state, console/network monitoring,
// 404, redirects, and mobile overflow scans. Reuses one browser; fresh page per probe.
import { launch, monitor, gap, summarize } from "./helpers.mjs";
import { BASE, check, resetRun, overflow, storeJson } from "./helpers.mjs";

const APP_ROUTES = [
  "/", "/login", "/register", "/forgot-password", "/reset-password",
  "/dashboard", "/community", "/onboarding", "/courses", "/schedule", "/attendance",
  "/timeline", "/tasks", "/exams", "/grades", "/notes", "/stickies", "/resources",
  "/topics", "/focus", "/goals", "/habits", "/workload", "/insights", "/ai",
  "/flashcards", "/study-plan", "/rescue", "/analytics", "/profile", "/settings",
  "/plans", "/integrations",
];
const ADMIN_ROUTES = [
  "/admin", "/admin/users", "/admin/billing", "/admin/community", "/admin/analytics",
  "/admin/ai", "/admin/integrations", "/admin/flags", "/admin/announcements",
  "/admin/system", "/admin/errors", "/admin/security", "/admin/dev", "/admin/settings",
  "/admin/audit",
];
const MOBILE = ["/dashboard", "/schedule", "/tasks", "/admin", "/courses", "/community", "/settings", "/profile", "/exams", "/grades"];

const RESULTS = [];

async function probe(b, path, { viewport = { width: 1440, height: 900 }, wait = 900 } = {}) {
  const p = await b.newPage();
  await p.setViewport(viewport);
  const rec = monitor(p);
  const out = { path, h1: "", len: 0, crash: false, blank: false, buttons: 0, links: 0, inputs: 0, errs: [], overflow: null };
  try {
    const resp = await p.goto(BASE + path, { waitUntil: "domcontentloaded", timeout: 20000 });
    if (resp) out.status = resp.status();
    await gap(wait);
    const d = await p.evaluate(() => {
      const t = document.body ? document.body.innerText : "";
      return {
        h1: [...document.querySelectorAll("h1")].map((h) => h.innerText.slice(0, 70)).join("|"),
        len: t.length,
        crash: /something went wrong|unexpected application error|error boundary/i.test(t),
        blank: t.trim().length === 0,
        buttons: [...document.querySelectorAll("button")].length,
        links: [...document.querySelectorAll("a")].length,
        inputs: [...document.querySelectorAll("input, textarea, select")].length,
        sw: document.documentElement.scrollWidth,
        iw: window.innerWidth,
      };
    });
    Object.assign(out, d, { overflow: d.sw > d.iw + 1 });
    const s = summarize(rec);
    out.errs = s.errors;
    out.consoleErrors = s.consoleErrors;
    out.pageErrors = s.pageErrors;
    out.failedRequests = s.failedRequests;
    out.badResponses = s.badResponses;
  } catch (e) {
    out.exception = String(e).slice(0, 120);
  }
  RESULTS.push(out);
  await p.close().catch(() => {});
  return out;
}

async function main() {
  resetRun("routes");
  const { b } = await launch();

  for (const path of APP_ROUTES) {
    const r = await probe(b, path);
    if (r.exception) check(`route.${path}`, false, r.exception);
    else if (r.blank) check(`route.${path}`, false, "blank body");
    else if (r.crash) check(`route.${path}`, false, "error boundary text");
    else if ((r.consoleErrors || r.pageErrors) > 0) check(`route.${path}`, false, `console/page errors: ${(r.errs || []).slice(0, 3).join(" | ")}`);
    else if (r.len < 60) check(`route.${path}`, false, `empty (len=${r.len})`);
    else check(`route.${path}`, true, `h1="${r.h1}"`);
  }
  for (const path of ADMIN_ROUTES) {
    const r = await probe(b, path);
    if (r.exception || r.blank || r.crash) check(`route.${path}`, false, r.exception || "(blank/crash)");
    else if ((r.consoleErrors || r.pageErrors) > 0) check(`route.${path}`, false, `console/page errors: ${(r.errs || []).slice(0, 3).join("|")}`);
    else check(`route.${path}`, true, `h1="${r.h1}"`);
  }

  const p404 = await probe(b, "/definitely-not-a-real-route");
  check("route.404", !p404.blank && !p404.crash && p404.len > 40, `len=${p404.len} h1="${p404.h1}"`);

  for (const path of MOBILE) {
    const r = await probe(b, path, { viewport: { width: 390, height: 844 } });
    check(`mobile.overflow.${path}`, !r.overflow, `sw=${r.sw} iw=${r.iw}`);
  }

  const failed = RESULTS.filter((r) => r.exception || r.blank || r.crash || r.consoleErrors || r.pageErrors).map((r) => r.path);
  check("routes.no-runtime-breaks", failed.length === 0, failed.join(",") || "all clean");

  await storeJson("routes-report.json", { count: RESULTS.length, results: RESULTS });
  await b.close().catch(() => {});
}

main().catch((e) => { console.error("ROUTES FATAL", e); process.exit(1); });