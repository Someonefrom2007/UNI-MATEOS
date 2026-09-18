import { describe, it, expect } from "vitest";
import { LANGUAGES, dictionaryFor } from "@/lib/i18n";

// The three dictionaries must stay in step. A key present in English but
// missing from Catalan or Spanish does not fail at runtime — `t()` silently
// falls back to English — so a translated UI can end up half-translated with
// nothing to catch it. This is that catch.
describe("i18n dictionaries", () => {
  const en = dictionaryFor("en");
  const enKeys = Object.keys(en);

  it("covers every language the picker offers", () => {
    LANGUAGES.forEach((l) => {
      expect(Object.keys(dictionaryFor(l.code)).length, `${l.code} is empty`).toBeGreaterThan(0);
    });
  });

  it.each(["ca", "es"])("has no key missing from %s", (code) => {
    const dict = dictionaryFor(code);
    const missing = enKeys.filter((k) => dict[k] === undefined);
    expect(missing, `${code} is missing: ${missing.join(", ")}`).toEqual([]);
  });

  it.each(["ca", "es"])("has no key that English lacks in %s", (code) => {
    const dict = dictionaryFor(code);
    const extra = Object.keys(dict).filter((k) => !(k in en));
    expect(extra, `${code} has orphan keys: ${extra.join(", ")}`).toEqual([]);
  });

  it.each(["ca", "es"])("translates each key rather than copying English in %s", (code) => {
    const dict = dictionaryFor(code);
    // Proper nouns and symbols are legitimately identical across languages;
    // whole sentences that are should not be.
    const untranslated = enKeys.filter(
      (k) => dict[k] === en[k] && en[k].trim().split(/\s+/).length >= 2,
    );
    expect(untranslated, `${code} still English: ${untranslated.join(", ")}`).toEqual([]);
  });

  it("keeps interpolation placeholders aligned across languages", () => {
    const placeholders = (v) => (String(v).match(/\{(\w+)\}/g) || []).sort().join(",");
    ["ca", "es"].forEach((code) => {
      const dict = dictionaryFor(code);
      const drift = enKeys.filter((k) => placeholders(en[k]) !== placeholders(dict[k]));
      expect(drift, `${code} placeholder drift: ${drift.join(", ")}`).toEqual([]);
    });
  });

  it("falls back to English for an unknown language", () => {
    expect(dictionaryFor("de")).toBe(en);
  });
});

