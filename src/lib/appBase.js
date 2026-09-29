// Deployment base-path helpers.
//
// Vite's `base` is the one source of truth for where the app is served from.
// Locally that is "/". In production it is "/UNI-MATEOS/", because GitHub Pages
// serves a repository from a sub-path.
//
// React Router already handles this via `basename`, so <Link to="/grades"> is
// correct without any help. But code that does a FULL page load —
// window.location.href, or a Supabase redirectTo in an email link — bypasses
// the router entirely and would resolve against the origin root, landing on
// https://host/grades instead of https://host/UNI-MATEOS/grades. That 404s.
// These helpers make those call sites base-aware without changing what they
// mean.

const raw = (import.meta.env?.BASE_URL ?? "/") || "/";

/**
 * Normalized to a single leading and trailing slash: "/" or "/sub/".
 *
 * The trailing slash is not cosmetic: appPath() derives the prefix by dropping
 * the last character, so a base without one would slice a real character off
 * the segment and produce "/UNI-MATE-MATdashboard".
 */
export const APP_BASE = (raw.startsWith("/") ? raw : `/${raw}`).replace(/\/?$/, "/");

/**
 * Prefix a root-relative app path with the deployment base.
 *
 * Only ever prepends a fixed, known-safe prefix to a path that already starts
 * with a single "/" — so it cannot introduce a "//" protocol-relative prefix or
 * a backslash, and therefore cannot weaken the open-redirect checks in
 * authReturnTo.js. Idempotent: an already-prefixed path is returned unchanged.
 */
export function appPath(path) {
  const p = path || "/";
  if (APP_BASE === "/") return p.startsWith("/") ? p : `/${p}`;
  const bare = APP_BASE.slice(0, -1); // "/UNI-MATEOS"
  if (p === bare || p.startsWith(`${bare}/`)) return p;
  return `${bare}${p.startsWith("/") ? p : `/${p}`}`;
}

/** Absolute same-origin URL for an app path (for Supabase redirectTo). */
export function appUrl(path) {
  return window.location.origin + appPath(path);
}
