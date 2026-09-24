// QA harness shared helpers — local-mode UNI·MATE browser audit.
import puppeteer from "puppeteer-core";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
export const BASE = "http://localhost:5130";
const IGNORED_STATUS = [/favicon/i, /\.(svg|png|ico)$/i];
const IGNORED_CONSOLE = [
  /Download the React DevTools/i,
  /Sourcemap for/i,
];

export const gap = (ms) => new Promise((r) => setTimeout(r, ms));

export async function launch(viewport = { width: 1440, height: 900 }) {
  const b = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
    protocolTimeout: 60000,
  });
  const p = await b.newPage();
  await p.setViewport(viewport);
  return { b, p };
}

// Fresh page session object that records console/page/network failures.
export function monitor(p) {
  const rec = {
    consoleErrors: [],
    pageErrors: [],
    failedRequests: [],
    badResponses: [],
  };
  p.on("console", (m) => {
    if (m.type() === "error") {
      const t = m.text();
      if (!IGNORED_CONSOLE.some((r) => r.test(t))) rec.consoleErrors.push(t.slice(0, 200));
    }
  });
  p.on("pageerror", (e) => rec.pageErrors.push(String(e).slice(0, 200)));
  p.on("requestfailed", (r) => {
    const u = r.url();
    if (!IGNORED_STATUS.some((re) => re.test(u))) rec.failedRequests.push(`${u} :: ${r.failure()?.errorText || "?"}`);
  });
  p.on("response", (r) => {
    if (r.status() >= 400) {
      const u = r.url();
      if (!IGNORED_STATUS.some((re) => re.test(u))) rec.badResponses.push(`${r.status()} ${u}`);
    }
  });
  return rec;
}

export async function goto(p, path, wait = 1400) {
  await p.goto(BASE + path, { waitUntil: "domcontentloaded", timeout: 20000 });
  await gap(wait);
}

export async function ensureAuthed(p) {
  await goto(p, "/dashboard", 1500);
  const ok = await p.evaluate(() => {
    return (document.body && document.body.innerText.length > 60) || !!document.querySelector("nav, aside");
  });
  if (!ok) {
    await goto(p, "/login", 1000);
    await goto(p, "/dashboard", 1500);
  }
}

export const rowsOf = (table) => (p) =>
  p.evaluate((t) => {
    try {
      return JSON.parse(localStorage.getItem("unimate:v1:" + t) || "[]");
    } catch {
      return [];
    }
  }, table);

export const bodyText = (p) => p.evaluate(() => document.body?.innerText || "");

// Set a text input value reliably (React-friendly native setter + input event).
export async function setVal(p, sel, text) {
  const el = await p.$(sel);
  if (!el) return false;
  await el.evaluate((n) => {
    const proto = n.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value").set.call(n, "");
    n.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await el.type(text, { delay: 3 });
  return true;
}

export async function setDate(p, sel, val) {
  const el = await p.$(sel);
  if (!el) return false;
  await el.evaluate((node, v) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(node, v);
    node.dispatchEvent(new Event("input", { bubbles: true }));
    node.dispatchEvent(new Event("change", { bubbles: true }));
  }, val);
  return true;
}

export async function setSelect(p, sel, val) {
  const el = await p.$(sel);
  if (!el) return false;
  await el.evaluate((node, v) => {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set.call(node, v);
    node.dispatchEvent(new Event("change", { bubbles: true }));
  }, val);
  return true;
}

export async function clickByText(p, text, scope = null) {
  return p.evaluate(({ text, scope }) => {
    const root = scope ? document.querySelector(scope) : document;
    if (!root) return false;
    const isInput = ["INPUT", "TEXTAREA", "SELECT"].includes(root.tagName);
    const el = isInput
      ? root
      : [...root.querySelectorAll("button, a, [role='button'], label")]
          .map((e) => ({ e, t: (e.getAttribute("aria-label") || e.textContent || "").trim() }))
          .filter((o) => o.t)
          .find((o) => o.t === text || o.t.startsWith(text + " "))?.e;
    if (!el) return false;
    el.click();
    return true;
  }, { text, scope });
}

export async function dialogChip(p, text) {
  return p.evaluate((t) => {
    const el = [...document.querySelectorAll('[role="dialog"] button')].find((b) => b.textContent.trim() === t);
    if (el) { el.click(); return true; }
    return false;
  }, text);
}

export async function closeDialog(p) {
  await p.evaluate(() => {
    const e = [...document.querySelectorAll('[role="dialog"] button')].find((b) => b.textContent.trim() === "Close");
    if (e) e.click();
  });
  await gap(250);
}

export async function openQuickAdd(p, kind) {
  await p.evaluate(() => {
    const z = document.querySelector("[data-state='open']");
    const btn = [...document.querySelectorAll('button[aria-label="Quick add"]')][0];
    if (btn) btn.click();
  });
  await gap(350);
  await dialogChip(p, kind);
  await gap(300);
}

export const hasText = (p, needle) => p.evaluate((n) => document.body.innerText.toLowerCase().includes(n.toLowerCase()), needle);

export function summarize(rec) {
  const e = [...rec.consoleErrors, ...rec.pageErrors];
  return {
    consoleErrors: rec.consoleErrors.length,
    pageErrors: rec.pageErrors.length,
    failedRequests: rec.failedRequests.length,
    badResponses: rec.badResponses.length,
    errors: [...new Set(e)].slice(0, 6),
  };
}