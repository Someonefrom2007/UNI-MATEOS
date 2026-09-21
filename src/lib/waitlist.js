// Waitlist capture — the pre-launch conversion surface. Pure email validation
// plus a tiny on-device store so local/demo workspaces can join the list too
// (hosted writes go through the waitlist table + repository).
import { getDefaultStorage } from "@/lib/repo/storage";

export const WAITLIST_KEY = "local-waitlist";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Basic but strict enough for capture: one at-sign, one dot after it, no spaces.
 * @param {string} email
 * @returns {boolean}
 */
export const isValidEmail = (email = "") =>
  typeof email === "string" && email.trim().length <= 254 && EMAIL_RE.test(email.trim());

/**
 * @param {object} storage
 * @returns {Array<{email: string, tier: string, source: string, created_at: string}>}
 */
export const loadLocalWaitlist = (storage = getDefaultStorage()) => {
  try {
    const raw = storage.getItem(WAITLIST_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
};

/**
 * Append an email to the on-device waitlist. Returns ok:false for invalid
 * input and ok:true, duplicate:true when the email is already captured.
 * @param {string} email
 * @param {string} [tier]
 * @param {object} [storage]
 * @returns {{ok: boolean, duplicate?: boolean}}
 */
export const addLocalWaitlist = (email, tier = "pro", storage = getDefaultStorage()) => {
  const clean = String(email || "").trim();
  if (!isValidEmail(clean)) return { ok: false };
  const key = clean.toLowerCase();
  if (isOnLocalWaitlist(clean, storage)) return { ok: true, duplicate: true };
  const list = loadLocalWaitlist(storage);
  list.push({ email: clean, tier, source: "plans", created_at: new Date().toISOString() });
  storage.setItem(WAITLIST_KEY, JSON.stringify(list));
  return { ok: true, duplicate: false };
};

/**
 * @param {string} email
 * @param {object} [storage]
 * @returns {boolean}
 */
export const isOnLocalWaitlist = (email, storage = getDefaultStorage()) => {
  if (!email) return false;
  const key = String(email).trim().toLowerCase();
  return loadLocalWaitlist(storage).some((e) => String(e.email || "").trim().toLowerCase() === key);
};