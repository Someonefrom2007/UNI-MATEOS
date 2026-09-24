# UNI·MATE — HOSTED SECURITY MATRIX

Status: **NOT EXECUTED — HOSTED ENVIRONMENT REQUIRED**

This matrix records the live, hosted security boundary once a real Supabase project and deployed
environment are available. Per project rule, results are only ever `PASS`, `FAIL`, or
`NOT EXECUTED`. An unexecuted hosted test is **never** marked PASS, regardless of local-mode
evidence.

The local Founder/Admin implementation is considered verified within local-environment limits
(`QA_MASTER_MATRIX.md`, `QA_FAILURES.md`, `QA_FINAL_REPORT.md`, reviewer run `3a1f038`). This
document is exclusively about the **real hosted boundary**: real auth, real JWT, real Supabase,
real RLS, real server authorization, the real Founder account, and a real student account.

## Required real resources (none present in this workspace)

| Resource | Value location | Present here |
|---|---|---|
| Hosted Supabase URL | `VITE_SUPABASE_URL` | ❌ (no `.env.local`) |
| Hosted anon key | `VITE_SUPABASE_ANON_KEY` | ❌ |
| Founder account `miquel.rocas25@gmail.com` + password | `HOSTED_FOUNDER_*` (runner env) | ❌ |
| Separate hosted student account + password | `HOSTED_STUDENT_*` (runner env) | ❌ |
| Service-role key (owner only — bootstrap authority) | `SUPABASE_SERVICE_ROLE_KEY` (owner env only) | ❌ |
| Apply `supabase/schema.sql` to the hosted project | migration | ❌ |

## Final security matrix

Founder = `miquel.rocas25@gmail.com` (role `founder`, `enabled = true`). Status column is the only
official batch; the per-actor columns are the record state, all currently `NOT EXECUTED`.

| Test | Founder | Student | Unauthenticated | Status |
|------|---------|---------|-----------------|--------|
| Login | NOT EXECUTED | NOT EXECUTED | n/a (no session) | ❌ hosted login unrun |
| /admin (UI + route) | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | ❌ needs hosted browser session |
| Admin read (roster, users, subscriptions) | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | ❌ |
| Admin create (announcement, flag) | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | ❌ |
| Admin update (announcement, flag) | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | ❌ |
| Admin delete (announcement, flag) | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | ❌ |
| Feature flags | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | ❌ |
| Announcements | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | ❌ |
| Audit logs | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | ❌ |
| User administration (roster, lifecycle) | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | ❌ |
| Bootstrap (client-execution attempt) | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | ❌ NEED service role to re-run idempotency |
| Session expiry (revoked/invalid token) | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | ❌ |

## Test-by-test status (spec §2–§12)

| # | Test | Result |
|---|---|---|
| 2 | Founder account receives intended authorization | NOT EXECUTED — hosted login + RPC required |
| 3 | Live founder login flow (sign in, session, hydrate, authorisation, console, 9 sections) | NOT EXECUTED — real password + hosted app run required |
| 4 | Live logout → /admin and all admin routes blocked; old session unusable | NOT EXECUTED |
| 5 | Separate real student: app works, console absent, /admin + every route denied, admin data/mutations blocked (direct API) | NOT EXECUTED — need second real account |
| 6 | RLS verify: founder permitted / student denied / unauthenticated denied per table (admin_accounts, announcements, flags, admin/user data, audit, others) for SELECT/INSERT/UPDATE/DELETE | NOT EXECUTED |
| 7 | Server-side authorization with UI bypassed: direct admin mutations as student (announcements, flags, privileged user ops, dev/admin ops) | NOT EXECUTED |
| 8 | JWT/role tampering: localStorage/IndexedDB/UI/plan state changes never change server authz | NOT EXECUTED (by-construction only, see note) |
| 9 | Founder role persists in hosted DB; reload; sign out; re-sign-in; no duplicate rows | NOT EXECUTED |
| 10 | Bootstrap safety: repeated execution idempotent, no dupes, no escalation, no client-accessible bootstrap, service-role-only | NOT EXECUTED — service role required for the safe repeat pass |
| 11 | Session expiration/invalid → /admin denied/redirect; stale client state cannot preserve access | NOT EXECUTED |
| 12 | Admin data isolation: non-admin never receives admin data via route/table/network/local-state/direct API | NOT EXECUTED |

## Execution plan once credentials are available

1. Export the real hosted `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` and the two account
   passwords; configure the app build with the hosted env; apply `supabase/schema.sql` to the project.
2. Run the turnkey harness (real auth + real RLS, no mocks):
   `HOSTED_URL=… HOSTED_ANON_KEY=… HOSTED_FOUNDER_EMAIL=miquel.rocas25@gmail.com HOSTED_FOUNDER_PASSWORD=… HOSTED_STUDENT_EMAIL=… HOSTED_STUDENT_PASSWORD=… node qa/hosted/verify-security.mjs`
   → writes `qa/hosted/hosted-security-report.json` with PASS/FAIL/NOT EXECUTED per row + evidence.
3. Browser pass on the hosted app (login as founder: console visible, all sections; login as student:
   no console, direct `/admin` + every route denied; logout: `/admin` denied).
4. Owner-only (never in CI, never committed): run `SELECT bootstrap_founder('miquel.rocas25@gmail.com')`
   twice and confirm one row, no escalation.
5. Update this matrix to PASS/FAIL accordingly.

## Hard rules honored here

- No mocked auth/JWT/RLS; no hosted request replaced by local-mode behaviour.
- No substitute evidence for missing hosted reality is converted into PASS.
- The client never reads authorization from localStorage/IndexedDB/plan/UI state
  (by construction — see `src/lib/admin/*`); the live proof is loaded only by the hosted run.
- Runner secrets live in the environment, never in this repository.

_Last updated: 2026-09-24 (all rows NOT EXECUTED)._