import { describe, it, expect, beforeEach } from "vitest";
import {
  NOTIFY_GROUPS,
  defaultPrefs,
  loadPrefs,
  savePrefs,
  filterNotifs,
} from "@/lib/notifyPrefs";

const memory = () => {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
};

const notif = (group, id) => ({ id, group, title: group });

describe("notifyPrefs", () => {
  beforeEach(() => {
    if (typeof localStorage !== "undefined") localStorage.clear();
  });

  it("defaults to every group enabled", () => {
    expect(defaultPrefs()).toEqual({ academic: true, milestone: true, community: true });
    expect(NOTIFY_GROUPS).toEqual(["academic", "milestone", "community"]);
  });

  it("loads defaults when nothing is stored", () => {
    expect(loadPrefs(memory())).toEqual(defaultPrefs());
  });

  it("loads stored prefs and never invents groups", () => {
    const store = memory();
    savePrefs({ academic: false, community: false }, store);
    const prefs = loadPrefs(store);
    expect(prefs.academic).toBe(false);
    expect(prefs.community).toBe(false);
    expect(prefs.milestone).toBe(true);
  });

  it("treats legacy/missing prefs as enabled", () => {
    const store = memory(); // nothing written
    expect(loadPrefs(store)).toEqual(defaultPrefs());
  });

  it("filters notifications by explicitly-off groups only", () => {
    const notifs = [
      notif("academic", "a1"),
      notif("milestone", "m1"),
      notif("community", "c1"),
    ];
    expect(filterNotifs(notifs, { academic: true, milestone: true, community: false })).toHaveLength(2);
    expect(filterNotifs(notifs, defaultPrefs())).toHaveLength(3);
    expect(filterNotifs([], defaultPrefs())).toEqual([]);
  });
});