// Notification preferences — minimal, device-local, injectable storage.
// The notification engine is derived (never stored rows), so per-device prefs
// are the right scope for "which groups I care about". Defaults include every
// group; missing keys resolve to enabled so older clients keep everything.

const PREFS_KEY = "unimate:notif:prefs";
const PREFS_EVENT = "unimate:notif-prefs";

export const NOTIFY_GROUPS = Object.freeze(["academic", "milestone", "community"]);

export const defaultPrefs = () => ({
  academic: true,
  milestone: true,
  community: true,
});

const defaultStore = () => {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
};

export const loadPrefs = (store = defaultStore()) => {
  const base = defaultPrefs();
  if (!store) return base;
  try {
    const raw = store.getItem(PREFS_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw);
    const out = { ...base };
    NOTIFY_GROUPS.forEach((g) => {
      out[g] = parsed[g] !== false;
    });
    return out;
  } catch {
    return base;
  }
};

export const savePrefs = (prefs, store = defaultStore()) => {
  if (!store) return;
  try {
    store.setItem(PREFS_KEY, JSON.stringify({ ...defaultPrefs(), ...prefs }));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event(PREFS_EVENT));
    }
  } catch {
    // storage unavailable — prefs apply for this session only
  }
};

/** Honest filtering: a group only disappears when its pref is explicitly off. */
export const filterNotifs = (notifs = [], prefs = defaultPrefs()) =>
  notifs.filter((n) => prefs[n.group] !== false);