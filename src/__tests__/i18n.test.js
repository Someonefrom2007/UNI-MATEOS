import { describe, it, expect, beforeEach } from "vitest";
import { translate, setLang, getLang, LANGUAGES } from "@/lib/i18n";

const ANCHORS = [
  "nav.dashboard", "nav.rescue", "nav.integrations", "nav.home",
  "title.settings.subtitle", "title.profile", "title.plans", "title.rescue.subtitle",
  "settings.appearance", "settings.theme.dark", "settings.language", "settings.language.saved",
  "settings.notifications", "settings.notify.on", "settings.data.export", "settings.data.wipe",
  "settings.confirm.wipe2", "settings.account",
  "plans.active", "plans.tag.ultimate", "plans.waitlist.joined", "plans.footer.local",
  "profile.fields.university", "profile.save", "profile.localNote",
  "integrations.footer", "integrations.status.synced", "integrations.drive.syncFiles",
];

const LANGS = ["en", "ca", "es"];

beforeEach(() => {
  setLang("en"); // reset the module-level cache so test order never matters
  try {
    if (typeof localStorage !== "undefined") localStorage.clear();
  } catch {}
});

describe("i18n: translator", () => {
  it("resolves every shipped anchor in all three languages with real translations", () => {
    for (const key of ANCHORS) {
      for (const lang of LANGS) {
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

  it("recognizes exactly the three supported languages", () => {
    expect(LANGUAGES.map((l) => l.code).sort()).toEqual(["ca", "en", "es"]);
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