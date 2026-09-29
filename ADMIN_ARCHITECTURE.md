# UNI·MATE Control Center — Architecture

The admin console (`/admin`) is the private operating surface behind UNI·MATE.
This guide maps what exists, how it is layered, and where each decision lives.

## 1. Layers

```
 pages/admin/*.jsx       15 screens (route components, no business rules)
        │  useAdmin()  →  principal + env   RequireAdmin / RequirePermission
        ▼
 components/admin/       AdminShell, EnvBanner, ⌘K AdminCommandPalette
        │
        ▼
 lib/admin/*.js         Pure, dependency-free engines (the "core"):
                        permissions · principal · featureFlags · auditLog ·
                        reconcile · moderation · users · pulse · probes ·
                        metrics · announcements · search · sections · prefs
        │
        ▼
 data access             getAppRepo() → local repo (localStorage) or Supabase
 edge functions          admin-gateway (read envelope) · ai-assistant ·
                         lemon-squeezy · google-calendar-sync · google-drive
```

Rules that hold the console together:

- Pages import the pure engines; they never re-implement a transition, a
  percentage, or an authorization check. Tests lock the engines separately.
- The engines have **no React and no Supabase imports** (except `probes.js`,
  which additionally performs reachability probes through real channels).
- Data is always honest: no invented metrics, statuses, or billing numbers.

## 2. The pure core (`src/lib/admin/`)

| Module | Responsibility |
|---|---|
| `permissions.js` | Roles, the permission catalog, `permissionsFor`/`can`/`isKnownPermission`/`principalFrom`. The only place roles map to permissions. |
| `principal.js` | Identity shaping: hosted (server-checked) vs local (dev-only, unenforced), `adminEnv`, `confirmWeight`. |
| `featureFlags.js` | `DEFAULT_FLAGS`, `evaluateFlag` (env/plan/rollout gates). Flags are never authorization. |
| `auditLog.js` | `auditEntry`/`logAudit`/`withAudit`/`recentAudit`/`filterAudit` — append-only, failure-safe. |
| `reconcile.js` | Lemon Squeezy → `subscriptions` → entitlement diffing; only reports, only adjusts entitlements. |
| `moderation.js` | Report/content state machines + `canModerate` (remove = super_admin). |
| `users.js` | Account lifecycle + `deleteConsequences`/`confirmPhrase` (no one-click deletion). |
| `pulse.js` | Honest service classification (operational/degraded/unavailable/not_configured/unknown). |
| `probes.js` | Real probes via the right channels (`database`/`adminGate`/`billing`/`google` + no-cost `assistant`). |
| `metrics.js` | Real-data aggregation; null telemetry stays null. |
| `announcements.js` | Severity/audience/window gating + validation. |
| `search.js` | ⌘K index, ranked search, permission filter, LRU recents. |
| `sections.js` | Section registry (paths, icons, permissions) — drives nav, routes, search. |
| `prefs.js` | Client-side console prefs (display name, landing section) via localStorage. |
| `useAdmin.jsx` | React layer: `AdminProvider`, `RequireAdmin`, `RequirePermission`. |

## 3. Rendering a section

`App.jsx` declares one route per section under `/admin`:

```
/admin        → AdminLayout (AdminProvider) → RequireAdmin → AdminShell
/admin        (index) overview
/admin/:id    each SECTIONS entry, wrapped in RequirePermission(permission)
```

`AdminShell` renders side nav from `permittedSections(principal)`, so locked
sections are not even listed; `RequirePermission` guards the route separately
(defense in depth). `AdminCommandPalette` reuses `sections.js` + `search.js`.

## 4. Identity resolution

- **Hosted**: `supabase.auth.getUser()` must resolve a live session, then
  `is_admin()` / `current_admin_role()` / `current_admin_permissions()` RPCs
  (SECURITY DEFINER, reading `admin_accounts`) shape the principal. A missing
  schema surfaces as **unconfigured**, never as admin.
- **Local workspace**: `localDevPrincipal()` — a super-admin identity marked
  `source: "local"`; `EnvBanner` and every screen show it is NOT
  server-enforced.

## 5. The AI probe (no LLM cost)

`probeAssistant()` in `probes.js` invokes `ai-assistant` with an **empty body**,
which the edge rejects before any OpenAI call:

- `400` → deployed + JWT verified + plan gate passed → OPERATIONAL
- `402` → reachable, session not on an entitled plan → DEGRADED
- `401` → reachable, no valid session → DEGRADED
- `404` → not deployed → UNAVAILABLE

The console never fires a live completion.

## 6. Billing reconciliation

`reconcile.js` models the chain
`Lemon Squeezy (webhook/payment source of truth) → subscriptions row
(entitlement, authoritative) → auth user_metadata.plan (display mirror)`.
The `subscriptions.tier` row is the entitlement of record: RLS grants the
client SELECT-own only, with no client INSERT/UPDATE, so a user cannot grant
themselves a tier. `user_metadata.plan` is a display convenience written by the
webhook and must never be used for an authorization decision — the account
owner can write their own metadata.
`reconcile.js` returns `{ ok, matches, mismatches, suggestedPlan }`. The only
mutating console step is `reconcileEntitlement`, which sets the entitlement
plan; every real write runs inside `withAudit` and lands in `audit_log`.

## 7. Student-app consumption

`src/lib/useFeatureFlags.js` reads the `feature_flags` table through the shared
repo and evaluates flags with the same `featureFlags` engine. It is wired into
`AIAssistant` (honest unavailable state) and is additive-only: defaults cover
any unpersisted key.