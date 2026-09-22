# UNI·MATE Control Center — Permissions

The single mapping from an admin role to what it may do lives in
`src/lib/admin/permissions.js`. `admin_accounts` in the database is the source
of truth for who is an admin and with which role.

## 1. Roles

| Role | Meaning | Granted by |
|---|---|---|
| `super_admin` | Full access, including `system.manage` and phrase-gated deletion | `guard_admin_role` (trigger) / manual insert |
| `admin` | Day-to-day operations (the default set, minus `system.manage`) | `guard_admin_role` / profile settings |
| `user` | Everyone else — never an admin | n/a |

Roles map to permissions through `permissionsFor(membership)` — the only place
that mapping exists: `super_admin` ⇒ all permissions, `admin` ⇒ the default
admin set (or an explicit granted set), anything else ⇒ `[]`.

## 2. The permission catalog (real keys, used verbatim)

Permission keys are dotted identifiers. Sections ask for exactly one
(`sections.js`); engines re-check where destructive.

| Permission (`PERMISSIONS.*`) | Sections that gate on it | Who holds it |
|---|---|---|
| `users.read` | `users` | admin, super_admin |
| `users.manage` | destructive user ops | admin, super_admin |
| `billing.read` | `billing` | admin, super_admin |
| `billing.manage` | reconcile/entitlement ops | admin, super_admin |
| `community.moderate` | `community` | admin, super_admin |
| `analytics.read` | `analytics` | admin, super_admin |
| `settings.manage` | `announcements`, `settings` | admin, super_admin |
| `feature_flags.manage` | `flags` | admin, super_admin |
| `ai.manage` | `ai` | admin, super_admin |
| `system.read` | `overview`, `integrations`, `system`, `errors`, `security`, `audit` | admin, super_admin |
| `system.manage` | `dev` (Developer Tools) | **super_admin only** |

`DEFAULT_ADMIN_PERMISSIONS` is exactly the catalog minus `system.manage`; a
plain admin whose membership row lists specific permissions uses that granted
set instead. Nothing outside `permissions.js` decides what a role can do.

## 3. Checks in the console

`useAdmin` (`src/lib/admin/useAdmin.jsx`) exposes `can(permission)` and
`isAdmin`. Routes are wrapped in `RequirePermission(permission)`, and side nav
lists only `permittedSections(principal)` (redundant with route guards, by
design). Engines re-check internally where the action is destructive:
`moderation.canModerate(principal, action)` enforces removal/escalation for
super admins, `users.deleteConsequences` + `confirmPhrase` phrase-gate deletion,
`reconcile.reconcileEntitlement` is the only entitlement mutation.

## 4. Server-side truth

The client checks are convenience; the server decides. `guard_admin_role`
(SECURITY DEFINER trigger) enforces that only a `super_admin` can change an
admin account's role. `is_admin()` / `current_admin_role()` /
`current_admin_permissions()` re-derive the caller from their JWT on every call
— a request can never claim a role, it must hold one. The `admin-gateway` edge
function answers `whoami`/`audit`/`roster` through those RPCs, and deliberately
rejects every mutating ops action (`system.manage` in the console still has no
server backend today, which is honest).

## 5. Two hard rules, again

1. **Feature flags are not authorization.** Flags change rollout/behavior;
   permissions gate access. Referenced from `featureFlags.js`, a flag can never
   grant `system.manage`.
2. **Deletion is phrase-gated and audited.** Delivering a user deletion requires
   `actionPhrase` from `users.js`, equals-check with `confirmPhrase`, and the
   write runs inside `withAudit` (see `auditLog.js`). No click can delete a user.

## 6. Local workspace

In the local workspace `localDevPrincipal()` returns a super_admin marked
`source: "local"` and `adminEnv()` labels it `local`; every screen shows this is
unenforced against a real server (`EnvBanner`), and `confirmWeight` stays light.
The road to production: apply `supabase/schema.sql`, mint `admin_accounts` rows,
and let `shapeHostedPrincipal` take over.