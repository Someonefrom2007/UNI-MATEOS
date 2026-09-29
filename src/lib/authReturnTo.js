// Shared by the auth pages (Login, Register). Keep the redirect validation in
// one place — it is security-sensitive and easy to drift.

import { appPath } from "@/lib/appBase";

// Resolve ?returnTo= to a safe same-origin path, else the dashboard.
//
// The same-origin check alone is not enough: a value like /.//evil.com or
// /\evil.com parses same-origin but normalizes to a protocol-relative
// //evil.com when assigned to location.href — an open redirect. So require the
// resolved path to be exactly one leading slash (no "//" prefix, no backslash).
//
// The returned value is base-prefixed, because callers assign it to
// window.location.href (a full page load, which ignores the router's basename).
// appPath only ever prepends a fixed known-safe prefix to a path that already
// passed the single-slash check below, so it cannot reintroduce either of those
// two bypasses.
export function safeReturnTo() {
  const raw = new URLSearchParams(window.location.search).get("returnTo");
  if (!raw) return appPath("/dashboard");
  try {
    const url = new URL(raw, window.location.origin);
    if (url.origin !== window.location.origin) return "/dashboard";
    // Keep the known bootstrap params stripped so a pasted link cannot be used
    // as a token-carrying alias while same-origin.
    for (const p of ["access_token", "clear_access_token", "app_id", "app_base_url", "functions_version", "from_url"]) {
      url.searchParams.delete(p);
    }
    const path = url.pathname + url.search;
    if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return appPath("/dashboard");
    return appPath(path);
  } catch {
    return appPath("/dashboard");
  }
}