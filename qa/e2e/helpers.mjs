import { launch, monitor, gap, goto, ensureAuthed, rowsOf, bodyText, setVal, setDate, setSelect, clickByText, dialogChip, closeDialog, openQuickAdd, hasText, summarize } from "../helpers.mjs";

export { launch, monitor, gap, goto, ensureAuthed, rowsOf, bodyText, setVal, setDate, setSelect, clickByText, dialogChip, closeDialog, openQuickAdd, hasText, summarize };

export const BASE = "http://localhost:5130";

// Defers the window.confirm for demo seeding etc.
export async function allowDialogs(p) {
  await p.evaluate(() => {
    window.confirm = () => true;
    window.alert = () => {};
  });
}

export const seed = async (p, table, rows) => {
  await p.evaluate(([t, rs]) => {
    localStorage.setItem("unimate:v1:" + t, JSON.stringify(rs));
  }, [table, rows]);
  return rows.length;
};

export const seedRow = async (p, table, row) => {
  await p.evaluate(([t, r]) => {
    try {
      const raw = localStorage.getItem("unimate:v1:" + t);
      const rows = raw ? JSON.parse(raw) : [];
      if (Array.isArray(rows)) rows.push(r);
      localStorage.setItem("unimate:v1:" + t, JSON.stringify(rows));
    } catch {}
  }, [table, row]);
};

export const rowCount = async (p, table) => {
  return p.evaluate((t) => {
    try {
      const raw = localStorage.getItem("unimate:v1:" + t);
      const rows = JSON.parse(raw || "[]");
      return Array.isArray(rows) ? rows.length : 0;
    } catch {
      return 0;
    }
  }, table);
};

export const tableRows = async (p, table) => {
  return p.evaluate((t) => {
    try {
      return JSON.parse(localStorage.getItem("unimate:v1:" + t) || "[]");
    } catch {
      return [];
    }
  }, table);
};

export const clearAll = async (p) => {
  await p.evaluate(() => {
    Object.keys(localStorage)
      .filter((k) => k.startsWith("unimate:v1:") || k === "um-theme" || k.startsWith("unimate:admin") || k === "um-desk" || k.startsWith("unimate:"))
      .forEach((k) => localStorage.removeItem(k));
  });
};

export const localVal = async (p, key) => p.evaluate((k) => localStorage.getItem(k), key);

// ---- Radix Select helper: open trigger by aria-label, click item by text ----
export async function chooseSelect(p, ariaLabel, valueText) {
  const trigger = await p.evaluateHandle((a) => {
    const els = [...document.querySelectorAll('[aria-label="' + a + '"]')];
    return els[els.length - 1] || null;
  }, ariaLabel);
  if (!trigger) return false;
  await trigger.asElement().click();
  await gap(250);
  const picked = await p.evaluate((vt) => {
    const item = [...document.querySelectorAll('[role="option"]')].find((o) => {
      const t = (o.textContent || "").trim();
      return t === vt || t.startsWith(vt);
    });
    if (item) { item.click(); return true; }
    return false;
  }, valueText);
  await gap(300);
  return picked;
}

export async function fillInput(p, ariaLabel, value) {
  let el = null;
  for (let i = 0; i < 5 && !el; i++) {
    el = await p.evaluateHandle((a) => {
      const els = [...document.querySelectorAll('[aria-label="' + a + '"]')];
      return els[els.length - 1] || null;
    }, ariaLabel);
    if (!el.asElement()) { el.dispose(); el = null; await new Promise((r) => setTimeout(r, 300)); }
  }
  const input = el?.asElement();
  if (!input) return false;
  await input.evaluate((n) => {
    const proto = n.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value").set.call(n, "");
    n.dispatchEvent(new Event("input", { bubbles: true }));
    n.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await input.type(value, { delay: 1 });
  return true;
}

export async function fillByPlaceholder(p, placeholder, value) {
  const el = await p.evaluateHandle((pl) => {
    const els = [...document.querySelectorAll('input[placeholder="' + pl + '"], textarea[placeholder="' + pl + '"]')];
    return els[els.length - 1] || null;
  }, placeholder);
  if (!el) return false;
  await el.asElement().evaluate((n) => {
    const proto = n.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value").set.call(n, "");
    n.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await el.asElement().type(value, { delay: 1 });
  return true;
}

export async function clickText(p, text, { all = false } = {}) {
  return p.evaluate(({ text, all }) => {
    const els = [...document.querySelectorAll("button, a, [role='button'], [role='menuitem'], label, [role='option']")];
    const found = els.filter((e) => {
      const t = (e.getAttribute("aria-label") || e.textContent || "").trim();
      return t === text || t.startsWith(text + " ");
    });
    const el = found[0];
    if (!el) return false;
    el.click();
    return true;
  }, { text, all });
}

export async function hoverText(p, text) {
  return p.evaluate((t) => {
    const els = [...document.querySelectorAll("button, a, [role='button'], [role='menuitem']")];
    const el = els.find((e) => {
      const s = (e.getAttribute("aria-label") || e.textContent || "").trim();
      return s === t || s.startsWith(t + " ");
    });
    if (!el) return false;
    el.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    return true;
  }, text);
}

export const overflow = async (p) =>
  p.evaluate(() => {
    const doc = document.documentElement;
    return { sw: doc.scrollWidth, iw: window.innerWidth, overflow: doc.scrollWidth > window.innerWidth + 1 };
  });

export const storeJson = async (file, obj) => {
  const { writeFileSync } = await import("node:fs");
  writeFileSync(new URL(file, import.meta.url), JSON.stringify(obj, null, 1));
  return true;
};

export const readJson = async (file) => {
  const { readFileSync } = await import("node:fs");
  try {
    return JSON.parse(readFileSync(new URL(file, import.meta.url), "utf8"));
  } catch {
    return {};
  }
};

// Unified check collector
export const RUN = { name: "run", checks: [] };
export const check = (k, ok, detail = "") => {
  RUN.checks.push({ k, ok, detail });
  process.stdout.write(`${ok ? "  OK " : " FAIL"} ${k}${detail ? " :: " + detail.slice(0, 140) : ""}\n`);
};

export const resetRun = (name) => {
  RUN.name = name;
  RUN.checks = [];
};