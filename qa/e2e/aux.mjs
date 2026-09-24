// Aux cross-system audit — command palette, QuickAdd empty-submit guard,
// i18n persistence, theme persistence, and responsive overflow across widths.
import {
  launch, gap, goto,
  allowDialogs, clearAll, tableRows, rowCount, openQuickAdd,
  clickText, hasText, bodyText, fillInput, chooseSelect,
  RUN, check, resetRun, storeJson, overflow,
} from "./helpers.mjs";

const nav = async (pg, path, wait = 1400) => {
  await goto(pg, path, wait);
  await allowDialogs(pg);
};

const run = async () => {
  resetRun("aux");
  const { b, p } = await launch({ width: 1440, height: 900 });
  const rec = { errorState: [] };
  const mon = { consoleErrors: [], pageErrors: [], failedRequests: [], badResponses: [] };
  p.on("console", (x) => { if (x.type() === "error" && !/React DevTools|Sourcemap/i.test(x.text())) mon.consoleErrors.push(x.text().slice(0, 160)); });
  p.on("pageerror", (e) => mon.pageErrors.push(String(e).slice(0, 160)));
  p.on("requestfailed", (r) => mon.failedRequests.push(r.url().slice(0, 120)));
  p.on("response", (r) => { if (r.status() >= 500) mon.badResponses.push(`${r.status()} ${r.url().slice(0, 120)}`); });

  try {
    await nav(p, "/dashboard", 2000);
    await clearAll(p);
    await nav(p, "/dashboard", 1600);

    // ---- Phase A: ⌘K / Ctrl+K palette opens, searches, navigates, closes ----
    await p.keyboard.down("Control");
    await p.keyboard.press("k");
    await p.keyboard.up("Control");
    await gap(450);
    const paletteOpen = await p.evaluate(() => !!document.querySelector('input[aria-label="Search courses, tasks and notes"]'));
    check("QA-aux ⌘K/Ctrl+K opens command palette", paletteOpen);

    hardFill2("QA-aux palette search input", await fillInput(p, "Search courses, tasks and notes", "course"), "no palette search input");
    await gap(500);
    const results = await p.evaluate(() => [...document.querySelectorAll('[role="dialog"] button')].map((o) => (o.textContent || "").trim()).filter(Boolean).join(" | "));
    check("QA-aux palette search surfaces results", results.length > 0, results.slice(0, 160));

    await clickText(p, "Courses");
    await gap(1200);
    check("QA-aux palette navigate to /courses", (await p.evaluate(() => location.pathname)) === "/courses", "path not /courses");

    await nav(p, "/dashboard", 1400);
    await p.keyboard.down("Control");
    await p.keyboard.press("k");
    await p.keyboard.up("Control");
    await gap(300);
    await p.keyboard.press("Escape");
    await gap(300);
    const paletteClosed = await p.evaluate(() => !document.querySelector('input[aria-label="Search courses, tasks and notes"]'));
    check("QA-aux palette Esc closes", paletteClosed);

    // ---- Phase B: QuickAdd — empty submit guarded, cancel leaves no row ----
    await nav(p, "/tasks", 1400);
    const tasksBefore = await rowCount(p, "tasks");
    await openQuickAdd(p, "Task");
    await gap(300);
    const dialogWithTitle = await p.evaluate(() => !!document.querySelector('input[placeholder="Finish Algorithms assignment"]'));
    hardFill2("QA-aux quickadd task dialog opens", dialogWithTitle, "no quickadd task form");
    await clickText(p, "Create Task");
    await gap(600);
    const tasksAfterEmpty = await rowCount(p, "tasks");
    check("QA-aux quickadd empty submit guarded (no row)", tasksAfterEmpty === tasksBefore, `${tasksBefore} -> ${tasksAfterEmpty}`);
    await p.keyboard.press("Escape");
    await gap(300);
    const tasksAfterCancel = await rowCount(p, "tasks");
    check("QA-aux quickadd cancel leaves no row", tasksAfterCancel === tasksBefore);

    // create a real task through the form to prove the write path exists
    await openQuickAdd(p, "Task");
    hardFill2("QA-aux quickadd task input reachable", await fillInput(p, "Title", "AUX quick add task"), "no title input");
    await clickText(p, "Create Task");
    await gap(900);
    const tasksAfterCreate = await rowCount(p, "tasks");
    const taskCreated = await p.evaluate(() =>
      (JSON.parse(localStorage.getItem("unimate:v1:tasks") || "[]")).some((t) => (t.title || "").includes("AUX quick add task")));
    check("QA-aux quickadd create task persists", tasksAfterCreate === tasksBefore + 1 && taskCreated, JSON.stringify({ tasksAfterCreate, taskCreated }));

    // ---- Phase C: i18n switch to Español + persistence across reload ----
    await nav(p, "/settings", 1500);
    const langOk = await chooseSelect(p, "Language", "Español");
    await gap(800);
    const langStored = await p.evaluate(() => localStorage.getItem("unimate-lang"));
    check("QA-aux i18n language select stores es", langOk && langStored === "es", `lang=${langStored}`);
    await nav(p, "/dashboard", 1400);
    check("QA-aux i18n UI actually translated (Dashboard→Panel)", await hasText(p, "Panel"), (await bodyText(p)).slice(0, 80));
    check("QA-aux i18n no raw nav key visible", !(await hasText(p, "nav.dashboard")));
    await p.reload({ waitUntil: "domcontentloaded" });
    await gap(1600);
    await allowDialogs(p);
    check("QA-aux i18n language persists after reload", await hasText(p, "Panel"));

    // ---- Phase D: theme light/dark toggle + persistence ----
    await nav(p, "/settings", 1500);
    const backToEnglish = await chooseSelect(p, "Idioma", "English");
    await gap(600);
    check("QA-aux i18n switch back to English", backToEnglish);
    await clickText(p, "Light");
    await gap(500);
    const lightState = await p.evaluate(() => ({
      cls: document.documentElement.classList.contains("light"),
      stored: localStorage.getItem("um-theme"),
    }));
    check("QA-aux theme Light applies + stores", lightState.cls && lightState.stored === "light", JSON.stringify(lightState));
    await p.reload({ waitUntil: "domcontentloaded" });
    await gap(1600);
    await allowDialogs(p);
    const lightAfterReload = await p.evaluate(() => document.documentElement.classList.contains("light"));
    check("QA-aux theme persists across reload", lightAfterReload);

    // ---- Phase E: responsive overflow 390–1920 ----
    const WIDTHS = [390, 640, 768, 1024, 1280, 1440, 1920];
    const PAGES = ["/dashboard", "/courses", "/notes", "/community", "/schedule", "/admin/"];
    let overflows = [];
    for (const w of WIDTHS) {
      await p.setViewport({ width: w, height: Math.max(800, Math.round(w * 0.9)) });
      for (const path of PAGES) {
        await nav(p, path, 1000);
        const o = await overflow(p);
        if (o.overflow) overflows.push(`${w}px ${path} (sw ${o.sw} vs iw ${o.iw})`);
      }
    }
    check("QA-aux responsive: zero horizontal overflow 390–1920", overflows.length === 0, overflows.join(" | ").slice(0, 400));

    check("QA-aux zero console/page errors", mon.consoleErrors.length === 0 && mon.pageErrors.length === 0, JSON.stringify({ c: mon.consoleErrors, p: mon.pageErrors }));
    check("QA-aux zero failed/5xx requests", mon.failedRequests.length === 0 && mon.badResponses.length === 0, JSON.stringify({ failed: mon.failedRequests, bad: mon.badResponses }));

    rec.final = { passed: RUN.checks.filter((c) => c.ok).length, failed: RUN.checks.filter((c) => !c.ok).length, total: RUN.checks.length };
    rec.expectedFails = RUN.checks.filter((r) => r.ok === false).map((r) => r.k);
    rec.totals = { consoleErrors: mon.consoleErrors.length, pageErrors: mon.pageErrors.length, failedRequests: mon.failedRequests.length, badResponses: mon.badResponses.length };
    await storeJson("aux-report.json", rec);
    const lines = RUN.checks.map((r) => `${r.ok ? "  OK " : " FAIL"} ${r.k}${r.ok ? "" : " :: " + (r.detail || "")}`);
    console.log(lines.join("\n") + `\n\nAux audit done: ${RUN.checks.filter((r) => r.ok).length}/${RUN.checks.length} passed, ${RUN.checks.filter((r) => !r.ok).length} failed`);
  } catch (e) {
    rec.errorState.push(String(e).slice(0, 300));
    console.log(`FATAL: ${e.stack ? e.stack.split("\n").slice(0, 5).join("\n") : e}`);
    console.log(`Aux audit done: ${RUN.checks.filter((r) => r.ok).length}/${RUN.checks.length} passed, ${RUN.checks.filter((r) => !r.ok).length} failed`);
    await storeJson("aux-report.json", rec);
  } finally {
    await b.close().catch(() => {});
  }
};

function hardFill2(name, ok, detail) {
  if (!ok) {
    check(name, false, detail);
    throw new Error(`${name} :: ${detail}`);
  }
}

run();