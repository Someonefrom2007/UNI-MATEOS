# UNI·MATE Control Center — Security

How the console stays honest about who can do what, what gets recorded, and
what never happens automatically.

## 1. Authority never comes from the client

The browser console computes "what may I show?" — never "who am I?".

- Hosted identity is **server-derived**: a live JWT session, then
  `is_admin()` / `current_admin_role()` / `current_admin_permissions()`
  (SECURITY DEFINER RPCs reading `admin_accounts` — see `schema.sql`).
- A signed-in student gets `{ admin: false }` back from `whoami`; the console
  answers honestly and shows access denied, it does not fabricate a role.
- In the local workspace `localDevPrincipal()` yields a super-admin identity
  explicitly labeled `source: "local"` — `EnvBanner` repeats that it is
  **NOT server-enforced**. Local is a development convenience, never a
  production path.

## 2. Server-side enforcement

- `guard_admin_role` (SECURITY DEFINER trigger) restricts who may change
  `admin_accounts` to super admins.
- Table policies read `public.is_admin()` **per query**, so a compromised UI
  cannot widen its own access by calling extra RPCs — each RPC re-checks the
  caller from their JWT.
- The `admin-gateway` edge function forwards the caller's JWT to those RPCs and
  never uses the service-role key to impersonate anyone. Unknown or mutating
  actions (`entitlement`, `webhook-replay`, `purge-user`, …) are rejected with
  an explicit **"ops not enabled"** — the destructive surface does not exist in
  this build at all.

## 3. Audit trail

- Every sensitive action runs through `withAudit` (`auditLog.js`): the
  operation fails closed if the trail write cannot be prepared, and the entry
  records actor, action, target, detail.
- `audit_log` is append-only by policy (insert via `log_audit`, read via
  `audit_recent`, both admin-gated).
- The console UI only shows the trail; it cannot edit it.

## 4. The two-phase danger zones

- **User deletion**: `USERS` remove surfaces `deleteConsequences` (exact counts
  of what would be lost), requires the typed phrase from `ACTION_PHRASES`
  verified by `confirmPhrase`, and only then mutates inside `withAudit`. No
  click or accidental keyboard shortcut can delete an account.
- **Entitlement changes**: `reconcileEntitlement` is the single mutating step,
  guarded by `BILLING` permission plus the console's typed confirmations. Lemon
  Squeezy remains the billing source of truth; reconciliation diff-reports first,
  applies only the documented entitlement row, and audits the change.

## 5. No secrets, no raw SQL

- Edge-function secrets live only in `Deno.env`; the console never displays,
  echoes, or logs a secret or key.
- There is **no raw SQL console**. The Dev section exposes environment-safe
  operations only; destructive ops are deliberately out of the milestone.
- Feature flags are rollout/behavior toggles and are **never authorization**
  (see `ADMIN_PERMISSIONS.md`).

## 6. Visual honesty

- `EnvBanner` is rendered wherever a local/non-production principal shows up so
  an operator cannot mistake the local console for enforcement.
- `confirmWeight` scales confirmation phrasing with environment
  (local → preview → production) so the same flow is heavier where it matters.

## 7. Review loop

- The Security screen lists the admin roster and the recent audit trail for
  periodic access review.
- `adminSections`/`adminPrincipal`/`adminJourneys` test suites pin the
  permission map, identity shaping, and the full console flows — a change that
  silently widens access fails the gate.