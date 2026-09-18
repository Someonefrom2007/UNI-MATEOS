import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  loadDismissed, dismissItem, restoreItem, clearDismissed, saveDismissed,
  loadSeen, markSeen, unseenCount, loadPrefs, savePrefs, applyPrefs, DEFAULT_PREFS,
  NOTIF_CHANGED_EVENT,
} from "@/lib/notificationStore";

// The suite runs in the node environment (see vite.config.js), so the browser
// globals the store guards on have to be supplied explicitly.
const makeStorage = () => {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    clear: () => map.clear(),
  };
};

let originalLocalStorage;
let originalWindow;

beforeEach(() => {
  originalLocalStorage = globalThis.localStorage;
  originalWindow = globalThis.window;
  globalThis.localStorage = makeStorage();
  globalThis.window = { dispatchEvent: () => true, addEventListener() {}, removeEventListener() {} };
});

afterEach(() => {
  globalThis.localStorage = originalLocalStorage;
  globalThis.window = originalWindow;
});

describe("dismissed keys", () => {
  it("starts empty and accumulates without duplicates", () => {
    expect(loadDismissed()).toEqual([]);
    dismissItem("a");
    dismissItem("b");
    dismissItem("a");
    expect(loadDismissed()).toEqual(["a", "b"]);
  });

  it("ignores an empty key rather than storing a blank entry", () => {
    dismissItem("");
    expect(loadDismissed()).toEqual([]);
  });

  it("restores one key and clears the rest", () => {
    dismissItem("a");
    dismissItem("b");
    expect(restoreItem("a")).toEqual(["b"]);
    expect(clearDismissed()).toEqual([]);
  });

  it("ignores a corrupt payload instead of throwing", () => {
    localStorage.setItem("um-notif-dismissed", "{not json");
    expect(loadDismissed()).toEqual([]);
  });

  it("ignores a payload that is valid JSON but not a list", () => {
    localStorage.setItem("um-notif-dismissed", JSON.stringify({ a: 1 }));
    expect(loadDismissed()).toEqual([]);
  });

  it("saveDismissed replaces the whole list", () => {
    dismissItem("a");
    expect(saveDismissed(["x", "y"])).toEqual(["x", "y"]);
    expect(loadDismissed()).toEqual(["x", "y"]);
  });
});

describe("seen tracking", () => {
  const crit = (key) => ({ key, severity: "critical", category: "deadline" });

  it("starts with everything unseen", () => {
    expect(loadSeen()).toEqual([]);
    expect(unseenCount([crit("a")])).toBe(1);
  });

  it("clears the badge for the items that were on screen", () => {
    const items = [crit("a"), crit("b")];
    markSeen(items);
    expect(loadSeen()).toEqual(["a:critical", "b:critical"]);
    expect(unseenCount(items)).toBe(0);
  });

  it("alerts again for a new critical item even when the total is unchanged", () => {
    markSeen([crit("a"), crit("b")]);
    // "a" resolved and "c" appeared: the count is still two, but "c" is new.
    expect(unseenCount([crit("b"), crit("c")])).toBe(1);
  });

  it("does not badge warnings or info", () => {
    expect(unseenCount([{ key: "w", severity: "warning" }, { key: "i", severity: "info" }])).toBe(0);
  });

  it("treats a missing or junk stored value as unseen", () => {
    localStorage.setItem("um-notif-seen", "abc");
    expect(loadSeen()).toEqual([]);
    expect(unseenCount([crit("a")])).toBe(1);
  });
});

describe("category preferences", () => {
  it("defaults to every category on", () => {
    expect(loadPrefs()).toEqual(DEFAULT_PREFS);
    expect(Object.values(DEFAULT_PREFS).every(Boolean)).toBe(true);
  });

  it("merges a partial payload over the defaults", () => {
    localStorage.setItem("um-notif-prefs", JSON.stringify({ wellbeing: false }));
    expect(loadPrefs().wellbeing).toBe(false);
    expect(loadPrefs().deadline).toBe(true);
  });

  it("filters items by the disabled category", () => {
    const items = [{ category: "deadline" }, { category: "wellbeing" }];
    expect(applyPrefs(items, { ...DEFAULT_PREFS, wellbeing: false })).toEqual([{ category: "deadline" }]);
  });

  it("treats only explicit false as off", () => {
    const items = [{ category: "exam" }];
    expect(applyPrefs(items, {})).toHaveLength(1);
    expect(savePrefs({ exam: false }).exam).toBe(false);
  });
});

describe("change broadcast", () => {
  it("fires on dismiss, restore and clear so other mounts resync", () => {
    const spy = vi.fn();
    globalThis.window.dispatchEvent = spy;

    dismissItem("a");
    restoreItem("a");
    clearDismissed();
    markSeen([]);

    expect(spy).toHaveBeenCalledTimes(4);
    expect(spy.mock.calls[0][0].type).toBe(NOTIF_CHANGED_EVENT);
  });
});
