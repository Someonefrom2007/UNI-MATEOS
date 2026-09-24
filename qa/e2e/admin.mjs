// Admin (Control Center) audit — section render sweep, announcements CRUD,
// feature-flag create/toggle, users search, mobile drawer, console ⌘K search,
// and the founder entry points (subtle: Settings card + student ⌘K palette; no
// permanent item in the student nav) plus no-email/identity checks.
// Header: the client never gates on an email; authority comes from admin_accounts
// (founder role) via the SECURITY DEFINER helpers — RLS enforces it server-side.
import {
  launch, gap, goto,
  allowDialogs, clearAll, tableRows, fillInput, fillByPlaceholder,
  clickText, hasText, bodyText,
  RUN, check, resetRun, storeJson, summarize,
} from "./helpers.mjs";

// the admin console passes "Announcement"/"FeatureFlag"/"AuditLog", the student data
// layer passes snake_case table names). Read the ADMIN keys here.
const ANN_KEY = "Announcement";

const SECTIONS = [
  ["overview", "/admin/"],
  ["users", "/admin/users"],
  ["billing", "/admin/billing"],
  ["community", "/admin/community"],
  ["analytics", "/admin/analytics"],
  ["ai", "/admin/ai"],
  ["integrations", "/admin/integrations"],
  ["flags", "/admin/flags"],
  ["announcements", "/admin/announcements"],
  ["system", "/admin/system"],
  ["errors", "/admin/errors"],
  ["security", "/admin/security"],
  ["dev", "/admin/dev"],
  ["settings", "/admin/settings"],
  ["audit", "/admin/audit"],
];

// Fill the input/textarea nested inside a <label> whose text contains labelText.
async function fillLabeled(p, labelText, value) {
  const ok = await p.evaluate(([labelText, value]) => {
    const labels = [...document.querySelectorAll("label")];
    const el = labels.find((l) => (l.textContent || "").includes(labelText))?.querySelector("input, textarea");
    if (!el) return false;
    const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value").set.call(el, "");
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }, [labelText, value]);
  if (!ok) return false;
  const handle = await p.evaluateHandle((labelText) => {
    const labels = [...document.querySelectorAll("label")];
    return labels.find((l) => (l.textContent || "").includes(labelText))?.querySelector("input, textarea") || null;
  }, labelText);
  await handle.asElement().type(value, { delay: 1 });
  return true;
}

// Set a native <select> value (announcement severity/audience, flag plan floor).
async function setNativeSelect(p, labelText, value) {
  return p.evaluate(([labelText, value]) => {
    const labels = [...document.querySelectorAll("label")];
    const el = labels.find((l) => (l.textContent || "").includes(labelText))?.querySelector("select");
    if (!el) return false;
    el.value = value;
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }, [labelText, value]);
}

const run = async () => {
  resetRun("admin");
  const { b, p } = await launch();
  const rec = { errorState: [], expectedFails: [] };
  let mon = null;

  const monitorStart = (pg) => {
    const m = { consoleErrors: [], pageErrors: [], failedRequests: [], badResponses: [] };
    pg.on("console", (x) => { if (x.type() === "error" && !/React DevTools|Sourcemap/i.test(x.text())) m.consoleErrors.push(x.text().slice(0, 160)); });
    pg.on("pageerror", (e) => m.pageErrors.push(String(e).slice(0, 160)));
    pg.on("requestfailed", (r) => m.failedRequests.push(r.url().slice(0, 120)));
    pg.on("response", (r) => { if (r.status() >= 500) m.badResponses.push(`${r.status()} ${r.url().slice(0, 120)}`); });
    return m;
  };

  const nav = async (path, wait = 1400) => {
    await goto(p, path, wait);
    await allowDialogs(p);
  };

  const bootPlain = async (path = "/dashboard") => {
    if (!mon) mon = monitorStart(p);
    await nav(path, 2000);
    return mon;
  };

  try {
    await bootPlain();
    await clearAll(p);
    await nav("/admin", 1800);

    // ---- Phase A: every admin section renders inside the console shell ----
    for (const [id, path] of SECTIONS) {
      await nav(path, 1300);
      const pathname = await p.evaluate(() => location.pathname);
      const rendered = await p.evaluate(() => ({
        hasH1: !!document.querySelector("main h1, h1"),
        shellText: document.body.innerText.includes("Control Center"),
        len: document.body.innerText.length,
      }));
      const errs = mon.consoleErrors.length + mon.pageErrors.length;
      check(`QA-admin [${id}] renders shell at ${path}`, rendered.shellText && rendered.hasH1 && rendered.len > 300 && errs === 0, JSON.stringify({ pathname, ...rendered, errs }));
    }

    // ---- Phase B: Announcements CRUD + audit trail ----
    await nav("/admin/announcements", 1300);
    await clickText(p, "New announcement");
    await gap(500);
    hardFill("QA-admin announcement create dialog", await fillLabeled(p, "Title", "QA maintenance window"), "no title input");
    hardFill("QA-admin announcement body input", await fillLabeled(p, "Body", "Planned maintenance Saturday 02:00–04:00 UTC."), "no body input");
    hardFill("QA-admin announcement severity select", await setNativeSelect(p, "Severity", "maintenance"), "no severity select");
    check("QA-admin announcement audience select", await setNativeSelect(p, "Audience", "all"));
    await clickText(p, "Save");
    await gap(900);
    const anns = await tableRows(p, ANN_KEY);
    const ann = anns.find((a) => a.title === "QA maintenance window");
    hardFill("QA-admin announcement persisted", ann && ann.severity === "maintenance" && ann.audience === "all" && (ann.body || "").includes("Planned maintenance"), JSON.stringify(anns));

    await clickText(p, "Edit");
    await gap(500);
    hardFill("QA-admin announcement edit fills form", ann && (await fillLabeled(p, "Body", "QA maintenance window v2 — rescheduled to Sunday.")), "edit dialog body missing");
    await clickText(p, "Save");
    await gap(900);
    check("QA-admin announcement update persists", (await tableRows(p, ANN_KEY)).find((a) => a.id === ann.id)?.body?.includes("v2"), JSON.stringify((await tableRows(p, ANN_KEY)).find((a) => a.id === ann.id)?.body));

    await clickText(p, "Delete");
    await gap(900);
    check("QA-admin announcement delete removes row", !(await tableRows(p, ANN_KEY)).find((a) => a.id === ann.id), "announcement remains");
    const audit = await tableRows(p, "AuditLog");
    check("QA-admin audit trail records announcement actions", ["announcement.create", "announcement.update", "announcement.delete"].every((a) => audit.some((l) => l.action === a)), JSON.stringify(audit.map((l) => l.action).slice(-6)));

    // ---- Phase C: Feature flags create + enable/disable round-trip ----
    await nav("/admin/flags", 1300);
    await clickText(p, "New flag");
    await gap(500);
    hardFill("QA-admin flag create dialog", await fillLabeled(p, "Key", "qa_weekend_flag"), "no key input");
    await fillByPlaceholder(p, "What it toggles", "QA weekend dashboard experiment");
    await p.evaluate(() => {
      const n = document.querySelector('input[type="number"]');
      if (n) {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(n, "50");
        n.dispatchEvent(new Event("input", { bubbles: true }));
        n.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    await clickText(p, "Create flag");
    await gap(900);
    const flags = await tableRows(p, "FeatureFlag");
    const flagRow = flags.find((f) => f.key === "qa_weekend_flag");
    hardFill("QA-admin flag persisted (created disabled)", flagRow && flagRow.enabled === false && Number(flagRow.rollout_pct) === 50, JSON.stringify(flags));

    await clickText(p, "Enable qa_weekend_flag");
    await gap(900);
    check("QA-admin flag enable persists", (await tableRows(p, "FeatureFlag")).find((f) => f.key === "qa_weekend_flag")?.enabled === true);
    await clickText(p, "Disable qa_weekend_flag");
    await gap(900);
    check("QA-admin flag disable persists", (await tableRows(p, "FeatureFlag")).find((f) => f.key === "qa_weekend_flag")?.enabled === false);

    // ---- Phase D: Users page search input ----
    await nav("/admin/users", 1300);
    hardFill("QA-admin users search input", await fillInput(p, "Search users", "local@unimate"), "no users search");

    // ---- Phase F: console ⌘K search navigates ----
    await nav("/admin/", 1300);
    await p.evaluate(() => { const b = [...document.querySelectorAll("button")].find((x) => (x.textContent || "").includes("Search console…")); if (b) b.click(); });
    await gap(500);
    hardFill("QA-admin command palette opens", await fillInput(p, "Search Control Center", "announ"), "no palette input");
    await gap(400);
    const found = await p.evaluate(() => [...document.querySelectorAll("[role='command'] button, [role='option'], a, button")].filter((x) => (x.textContent || "").includes("Announcements")).map((x) => (x.textContent || "").trim()).join("|"));
    const navOk = await clickText(p, "Announcements");
    await gap(1000);
    const palettePath = await p.evaluate(() => location.pathname);
    check("QA-admin command palette navigates to /admin/announcements", navOk && palettePath === "/admin/announcements", JSON.stringify({ found, palettePath }));

    // ---- Phase G: subtle founder entry points — NOT permanent student nav ----
    await nav("/dashboard", 1500);
    const navExposure = await p.evaluate(() => ({
      adminLinks: [...document.querySelectorAll("a")].map((a) => a.getAttribute("href")).filter((h) => h && h.startsWith("/admin")),
      hasControlCenter: /control center/i.test(document.body.innerText),
    }));
    check("QA-admin no permanent Control Center item in student nav", navExposure.adminLinks.length === 0 && !navExposure.hasControlCenter, JSON.stringify(navExposure));

    // Settings → Founder Console
    await nav("/settings", 1500);
    const settingsCard = await hasText(p, "Founder Console");
    const emailLeakSettings = await p.evaluate(() => document.body.innerText.includes("miquel.rocas25@gmail.com"));
    check("QA-admin Settings exposes Founder Console without leaking email", settingsCard === true && emailLeakSettings === false, JSON.stringify({ settingsCard, emailLeakSettings }));
    const fromSettings = await clickText(p, "Open Founder Console");
    await gap(1200);
    check("QA-admin Settings → Founder Console → /admin", fromSettings && (await p.evaluate(() => location.pathname)) === "/admin", String(await p.evaluate(() => location.pathname)));

    const founderLabel = await p.evaluate(() => /founder/i.test(document.body.innerText));
    const emailLeakAdmin = await p.evaluate(() => document.body.innerText.includes("miquel.rocas25@gmail.com"));
    check("QA-admin console shows Founder identity, no email", founderLabel === true && emailLeakAdmin === false, JSON.stringify({ founderLabel, emailLeakAdmin }));

    const lsOk = await p.evaluate(() => {
      const vals = Array.from({ length: localStorage.length }, (_, i) => localStorage.getItem(localStorage.key(i)) || "");
      return !vals.some((v) => v.includes("miquel.rocas25@gmail.com"));
    });
    check("QA-admin founder email never stored client-side", lsOk);

    // ⌘K palette → Founder Console
    await nav("/dashboard", 1500);
    await p.evaluate(() => window.dispatchEvent(new CustomEvent("unimate:palette")));
    await gap(500);
    hardFill("QA-admin student ⌘K palette opens", await fillInput(p, "Search courses, tasks and notes", "founder"), "no palette input");
    await gap(400);
    const pal = await p.evaluate(() => ({
      hasConsole: [...document.querySelectorAll("[role='dialog'] button")].some((b) => (b.textContent || "").includes("Founder Console")),
      labels: [...document.querySelectorAll("[role='dialog'] button")].map((b) => (b.textContent || "").trim().slice(0, 40)),
    }));
    check("QA-admin ⌘K → Founder Console result", pal.hasConsole, JSON.stringify(pal.labels));
    const palNav = await p.evaluate(() => {
      const b = [...document.querySelectorAll("[role='dialog'] button")].find((x) => (x.textContent || "").includes("Founder Console"));
      if (b) { b.click(); return true; }
      return false;
    });
    await gap(1200);
    check("QA-admin ⌘K → Founder Console → /admin", palNav && (await p.evaluate(() => location.pathname)) === "/admin", String(await p.evaluate(() => location.pathname)));

    // ---- Phase E: mobile drawer (fresh narrow browser) ----
    const mb = await launch();
    const mp = mb.p;
    try {
      await mp.setViewport({ width: 390, height: 844 });
      await goto(mp, "/admin", 1600);
      await allowDialogs(mp);
      const mobileM = monitorStart(mp);
      await clickText(mp, "Open menu");
      let drawerShown = false;
      for (let i = 0; i < 8 && !drawerShown; i++) { await gap(300); drawerShown = await mp.evaluate(() => !!document.querySelector('[aria-label="Close menu"]')); }
      check("QA-admin mobile drawer opens", drawerShown);
      const backClicked = await mp.evaluate(() => {
        const link = document.querySelector('.fixed.inset-0.z-50 a[href="/dashboard"]');
        if (link) { link.click(); return true; }
        return false;
      });
      await gap(1000);
      check("QA-admin mobile back-to-student navigates", backClicked && (await mp.evaluate(() => location.pathname)) === "/dashboard");
      check("QA-admin mobile console/page errors", mobileM.consoleErrors.length + mobileM.pageErrors.length === 0, JSON.stringify(mobileM));
    } finally {
      await mb.b.close().catch(() => {});
    }

    // ---- Overall error checks ----
    check("QA-admin zero console/page errors", mon.consoleErrors.length === 0 && mon.pageErrors.length === 0, JSON.stringify(mon));
    check("QA-admin zero failed/5xx requests", mon.failedRequests.length === 0 && mon.badResponses.length === 0, JSON.stringify({ failed: mon.failedRequests.length, bad: mon.badResponses.length }));

    rec.final = { passed: RUN.checks.filter((c) => c.ok).length, failed: RUN.checks.filter((c) => !c.ok).length, total: RUN.checks.length };
    rec.expectedFails = RUN.checks.filter((r) => r.ok === false).map((r) => r.k);
    await storeJson("admin-report.json", rec);
    const lines = RUN.checks.map((r) => `${r.ok ? "  OK " : " FAIL"} ${r.k}${r.ok ? "" : " :: " + (r.detail || "")}`);
    console.log(lines.join("\n") + `\n\nAdmin audit done: ${RUN.checks.filter((r) => r.ok).length}/${RUN.checks.length} passed, ${RUN.checks.filter((r) => !r.ok).length} failed`);
  } catch (e) {
    rec.errorState.push(String(e).slice(0, 300));
    console.log(`FATAL: ${e.stack ? e.stack.split("\n").slice(0, 5).join("\n") : e}`);
    console.log(`Admin audit done: ${RUN.checks.filter((r) => r.ok).length}/${RUN.checks.length} passed, ${RUN.checks.filter((r) => !r.ok).length} failed`);
    await storeJson("admin-report.json", rec);
  } finally {
    await b.close().catch(() => {});
  }
};

// throw on missing form field — fail fast but record context
function hardFill(name, ok, detail) {
  if (!ok) {
    check(name, false, detail);
    throw new Error(`${name} :: ${detail}`);
  }
}

run();