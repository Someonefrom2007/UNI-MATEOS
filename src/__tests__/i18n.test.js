import { describe, it, expect, beforeEach } from "vitest";
import { translate, setLang, getLang, getDictionary, LANGUAGES } from "@/lib/i18n";

const LANGS = ["en", "ca", "es"];

beforeEach(() => {
  setLang("en"); // reset the module-level cache so test order never matters
  try {
    if (typeof localStorage !== "undefined") localStorage.clear();
  } catch {}
});

describe("i18n: translator", () => {
  it("parity: every shipped key exists in all three languages (no missing, no dangling)", () => {
    const sets = Object.fromEntries(LANGS.map((lang) => [lang, Object.keys(getDictionary(lang)).sort()]));
    const [enKeyList] = [sets.en];
    for (const lang of ["ca", "es"]) {
      expect(sets[lang]).toEqual(enKeyList);
    }
  });

  it("every value in every language is a non-empty string and never the raw key", () => {
    for (const lang of LANGS) {
      const dict = getDictionary(lang);
      for (const [key, value] of Object.entries(dict)) {
        expect(typeof value, `${lang}/${key} must be a string`).toBe("string");
        expect(value.trim().length, `${lang}/${key} must not be empty`).toBeGreaterThan(0);
        expect(value, `${lang}/${key} must not pass through the raw key`).not.toBe(key);
      }
    }
  });

  it("resolves via translate() without surprise passthroughs across languages", () => {
    for (const lang of LANGS) {
      for (const key of Object.keys(getDictionary(lang))) {
        const value = translate(lang, key);
        expect(value, `${lang}/${key} should resolve`).toBeDefined();
        expect(value, `${lang}/${key} should not pass through the raw key`).not.toBe(key);
      }
    }
  });

  it("returns the key itself when nothing exists anywhere", () => {
    expect(translate("en", "totally.unknown.key")).toBe("totally.unknown.key");
    expect(translate("ca", "totally.unknown.key")).toBe("totally.unknown.key");
  });

  it("getDictionary falls back to English for unknown languages", () => {
    expect(getDictionary("xx")).toBe(getDictionary("en"));
  });

  it("recognizes exactly the three supported languages", () => {
    expect(LANGUAGES.map((l) => l.code).sort()).toEqual(["ca", "en", "es"]);
  });
});

describe("i18n: AI offline indicator strings", () => {
  const OFFLINE_KEYS = ["ai.offline.banner", "ai.offline.hint", "ai.offline.badge"];

  it("resolves every offline-indicator key in all three languages", () => {
    for (const lang of LANGS) {
      const dict = getDictionary(lang);
      for (const key of OFFLINE_KEYS) {
        expect(dict[key], `${lang}/${key} missing`).toBeTypeOf("string");
        expect(dict[key].trim(), `${lang}/${key} empty`).not.toBe("");
        expect(translate(lang, key), `${lang}/${key} passthrough`).not.toBe(key);
      }
    }
  });

  it("actually translates them — no English copied into ca/es", () => {
    // The parity suite only proves the keys exist. This proves they differ, so
    // a "translation" that is just the English string still gets caught.
    for (const key of OFFLINE_KEYS) {
      const values = LANGS.map((lang) => getDictionary(lang)[key]);
      expect(new Set(values).size, `${key} is identical across all languages`).toBe(3);
    }
  });
});

describe("i18n: language switching", () => {
  it("persists the current language and round-trips", () => {
    setLang("es");
    expect(getLang()).toBe("es");
    setLang("ca");
    expect(getLang()).toBe("ca");
  });

  it("ignores unknown codes and keeps the current language", () => {
    setLang("ca");
    setLang("xx");
    expect(getLang()).toBe("ca");
  });
});