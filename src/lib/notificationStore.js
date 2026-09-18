// Persisted attention state: dismissed item keys and the last-seen timestamp.
// Stored locally like the other small preference stores (feeds, theme, lang) —
// it is per-device UI state, not academic data, so it does not belong in the
// synced tables.

// The bell and the attention page each keep their own copy of this state, so a
// dismissal in one has to tell the other — otherwise the page still lists an
// item the bell just hid.
export const NOTIF_CHANGED_EVENT = "unimate:notif-changed";

export const notifyNotifChanged = () => {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(NOTIF_CHANGED_EVENT));
};

const DISMISSED_KEY = "um-notif-dismissed";
const SEEN_KEY = "um-notif-seen";
const PREFS_KEY = "um-notif-prefs";

const readArray = (key) => {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
};

const writeArray = (key, value) => {
  if (typeof localStorage !== "undefined") localStorage.setItem(key, JSON.stringify(value));
  return value;
};

export const loadDismissed = () => readArray(DISMISSED_KEY);

export const dismissItem = (key) => {
  if (!key) return loadDismissed();
  const next = writeArray(DISMISSED_KEY, Array.from(new Set([...loadDismissed(), key])));
  notifyNotifChanged();
  return next;
};

export const restoreItem = (key) => {
  const next = writeArray(DISMISSED_KEY, loadDismissed().filter((k) => k !== key));
  notifyNotifChanged();
  return next;
};

export const saveDismissed = (keys) => {
  const next = writeArray(DISMISSED_KEY, Array.isArray(keys) ? keys : []);
  notifyNotifChanged();
  return next;
};

export const clearDismissed = () => {
  const next = writeArray(DISMISSED_KEY, []);
  notifyNotifChanged();
  return next;
};

// "Seen" tracks which critical items have been shown, as a set of keys rather
// than a count. A count would go wrong the moment one urgent item is resolved
// and another appears: the total stays the same, so the badge would never
// light up for the new one.
export const loadSeen = () => readArray(SEEN_KEY);

export const seenKey = (item) => `${item.key}:${item.severity}`;

export const markSeen = (items = []) => {
  // Opening the panel acknowledges exactly the critical items showing now.
  // Keys for items that later resolve drop out on their own, and anything new
  // is absent from the set, so it alerts.
  const next = writeArray(SEEN_KEY, items.filter((i) => i.severity === "critical").map(seenKey));
  notifyNotifChanged();
  return next;
};

export const unseenItems = (items = []) => {
  const seen = new Set(loadSeen());
  return items.filter((i) => i.severity === "critical" && !seen.has(seenKey(i)));
};

export const unseenCount = (items = []) => unseenItems(items).length;

// Category opt-outs, so a student who finds exam reminders noisy can turn off
// just that group. Defaults are all on.
export const DEFAULT_PREFS = { deadline: true, exam: true, schedule: true, risk: true, wellbeing: true };

export const loadPrefs = () => {
  if (typeof localStorage === "undefined") return { ...DEFAULT_PREFS };
  try {
    const raw = JSON.parse(localStorage.getItem(PREFS_KEY) || "{}");
    return { ...DEFAULT_PREFS, ...(raw && typeof raw === "object" ? raw : {}) };
  } catch {
    return { ...DEFAULT_PREFS };
  }
};

export const savePrefs = (prefs) => {
  const next = { ...DEFAULT_PREFS, ...(prefs || {}) };
  if (typeof localStorage !== "undefined") localStorage.setItem(PREFS_KEY, JSON.stringify(next));
  return next;
};

export const applyPrefs = (items = [], prefs = loadPrefs()) =>
  items.filter((i) => prefs[i.category] !== false);
