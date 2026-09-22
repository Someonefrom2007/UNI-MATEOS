// UNI·MATE Control Center — client-side console preferences.
//
// Display/UX preferences for this browser's operator, stored in localStorage —
// never in the database and never audited, because they carry no security
// meaning. Anything that affects the running product stays server-side.

const KEY = "unimate:admin-prefs";

export const PREF_DEFAULTS = Object.freeze({
  displayName: "UNI·MATE",
  landing: "overview",
});

const isRecord = (v) => v && typeof v === "object" && !Array.isArray(v);

/** Read preferences, coercing to defaults on any bad payload. */
export const loadPrefs = () => {
  if (typeof localStorage === "undefined") return { ...PREF_DEFAULTS };
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return { ...PREF_DEFAULTS, ...(isRecord(parsed) ? parsed : {}) };
  } catch {
    return { ...PREF_DEFAULTS };
  }
};

/** Persist preferences. Returns false when the browser refused. */
export const savePrefs = (prefs) => {
  if (typeof localStorage === "undefined") return false;
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...PREF_DEFAULTS, ...(isRecord(prefs) ? prefs : {}) }));
    return true;
  } catch {
    return false;
  }
};