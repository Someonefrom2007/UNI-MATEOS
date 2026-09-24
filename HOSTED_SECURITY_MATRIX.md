# UNI·MATE — HOSTED SECURITY MATRIX

Status: **FIRST REAL HOSTED RUN EXECUTED 2026-09-24 — 0 PASS / 2 FAIL / 27 NOT EXECUTED (of 29)**

Per project rule, results are exactly one of `PASS`, `FAIL`, or `NOT EXECUTED`. An unexecuted hosted
test is **never** marked PASS regardless of local-mode evidence. The harness (`qa/hosted/verify-security.mjs`)
never mocks auth, JWTs, RLS, or Supabase responses; every row is recorded from the real hosted
boundary, or truthfully reported as NOT EXECUTED with its reason.

The local Founder/Admin implementation remains verified within local-environment limits
(`QA_MASTER_MATRIX.md`, `QA_FAILURES.md`, `QA_FINAL_REPORT.md`, reviewer run `3a1f038`).

## Required real resources

| Resource | Value location | Present this run |
|---|---|---|
| Hosted Supabase URL | `VITE_SUPABASE_URL` | ✅ `https://tqmhmpmfqmrtpizgluox.supabase.co` |
| Hosted anon key | `VITE_SUPABASE_ANON_KEY` | ✅ (never printed) |
| Founder account `miquel.rocas25@gmail.com` + password | `HOSTED_FOUNDER_*` | ✅ provided (never printed) |
| Separate student account + password | `HOSTED_STUDENT_*` | ✅ provided (never printed) |
| Service-role key (owner only) | `SUPABASE_SERVICE_ROLE_KEY` | ❌ not provided → idempotency row gated NOT EXECUTED |
| UNI·MATE schema applied to hosted project | migration | ❌ NOT applied — zero tables |

## First hosted run — observed evidence (2026-09-24)

Harness result: `0 pass / 2 fail / 27 NOT EXECUTED (of 29)`.

- **2 FAIL — founder.login / student.login.** Real `signInWithPassword` against the real hosted
  auth service returned `400 invalid_credentials` for both accounts. No matching user/password
  exists on this project.
- **5 anon rows — `NOT EXECUTED-missing-resource`.** Server returned `PGRST202` (function not found:
  `current_admin_role`, `bootstrap_founder`) and `PGRST205` (table not found: `admin_accounts`,
  `announcements`, `audit_log`). Independent probe: `GET /rest/v1/?apikey=anon` → **0 tables visible**.
  Conclusion: the hosted project is **empty** — `supabase/schema.sql` has **not** been applied.
- **15 founder + 7 student rows — NOT EXECUTED (`PREREQ-FAILED login`).**
- **1 row — boot.service-repeats-idempotent — NOT EXECUTED** (service-role gate).

Root cause (two, both environmental — no application defect found):
1. **Schema not applied to the hosted project.** No tables, no security functions, no RLS. This is a
   migration/configuration issue, not an authorization defect. Applying schema requires the owner's
   safe migration process (service-role key / SQL editor); NOT executed from this run.
2. **Login credentials invalid / accounts absent.** The provided founder and student passwords do not
   authenticate on this project. The correct accounts may live on a different project. Creating or
   promoting users here was not attempted (never fabricate identity).

## Final security matrix (evidence of 2026-09-24 run)

| Test | Founder | Student | Unauthenticated | Status |
|------|---------|---------|-----------------|--------|
| Login | FAIL | FAIL | n/a | ❌ 400 invalid_credentials (real hosted auth) |
| /admin (UI + route) | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | ❌ login prereq failed / browser run |
| Admin read (roster, users, subscriptions) | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | ❌ schema missing on hosted |
| Admin create (announcement, flag) | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | ❌ schema missing on hosted |
| Admin update (announcement, flag) | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | ❌ schema missing on hosted |
| Admin delete (announcement, flag) | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | ❌ schema missing on hosted |
| Feature flags | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | ❌ schema missing on hosted |
| Announcements | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED-missing-resource | ❌ |
| Audit logs | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED-missing-resource | ❌ |
| User administration (roster, lifecycle) | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | ❌ |
| Bootstrap (client-execution attempt) | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED-missing-resource | ❌ service idempotency ungated |
| Session expiry (revoked/invalid token) | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | ❌ login prereq failed |

## Test-by-test status (spec §2–§12)

| # | Test | Result (2026-09-24) |
|---|---|---|
| 2 | Founder account receives intended authorization | NOT EXECUTED — founder.login FAILs (invalid_credentials); role rescue unverifiable |
| 3 | Live founder login flow | FAIL at login: real auth service 400 invalid_credentials; remainder NOT EXECUTED |
| 4 | Live logout → /admin blocked; old session unusable | NOT EXECUTED — founder login prereq failed |
| 5 | Real student: console absent, /admin + routes denied, admin data/mutations blocked | NOT EXECUTED — student.login FAILs (invalid_credentials) |
| 6 | RLS verify: founder permitted / student denied / anon denied per table | NOT EXECUTED — schema absent on hosted (PGRST202/205) |
| 7 | Server-side authorization with UI bypassed: direct admin mutations as student | NOT EXECUTED — login prereq failed |
| 8 | JWT/role tampering: client state changes never change server authz | NOT EXECUTED — requires live admin session (by-construction only so far) |
| 9 | Founder role persists; reload; sign out; re-sign-in; no duplicates | NOT EXECUTED — login prereq failed |
| 10 | Bootstrap safety: idempotent, no dupes, no escalation, service-role-only | NOT EXECUTED — function absent on hosted; service-role gate not armed |
| 11 | Session expiration/invalid → /admin denied | NOT EXECUTED — login prereq failed |
| 12 | Admin data isolation: non-admin never receives admin data | NOT EXECUTED — requires live student sessions + schema |

## How to complete the remaining rows

1. **Apply `supabase/schema.sql` to `https://tqmhmpmfqmrtpizgluox.supabase.co`** (owner / SQL editor /
   service role). Re-run the harness; the 5 missing-resource anon rows then become real RLS verdicts.
2. **Provision the real Founder + Student accounts on this project** (register/confirm + set the
   passwords that match `HOSTED_FOUNDER_PASSWORD` / `HOSTED_STUDENT_PASSWORD`), then run:
   `node qa/hosted/verify-security.mjs` with `.env.local` loaded. Login rows resolve first.
3. Founder browser pass (login → Console visible, all sections; logout → `/admin` denied).
4. Owner-only (never in CI): set `SUPABASE_SERVICE_ROLE_KEY` + `HOSTED_BOOTSTRAP_RUN=1` for the
   idempotency row, or run the bootstrap through the SQL editor as documented.
5. Only then are any additional rows convertible to PASS/FAIL with evidence.

## Failures — permanent record

| Test | Observed | Root cause | Affected layer | Status |
|------|----------|------------|----------------|--------|
| founder.login | 400 `invalid_credentials` (real auth service) | account absent/password mismatch on this project | environment/configuration | recorded FAIL; no app change |
| student.login | 400 `invalid_credentials` (real auth service) | account absent/password mismatch on this project | environment/configuration | recorded FAIL; no app change |

No application/schema authorization defect was discovered by the run. No security policy was
weakened. No behavior was changed to force PASS. No credentials were printed or committed.

## Hard rules honored here

- No mocked auth/JWT/RLS; no hosted request replaced by local-mode behaviour.
- `PGRST202/205` (resource not found) is reported as `NOT EXECUTED-missing-resource`, never PASS.
  (Harness classifier removed the earlier false `PASS-denied` reading of "table/function not found";
  privileged-login downstream rows are now explicitly `NOT EXECUTED — PREREQ-FAILED`.)
- The client never reads authorization from localStorage/IndexedDB/plan/UI state
  (by construction — see `src/lib/admin/*`); live proof awaits a working hosted session.
- Runner secrets live in the environment / `.env.local` (gitignored), never in this repository.

_Last updated: 2026-09-24 — after first real hosted run (0 PASS / 2 FAIL / 27 NOT EXECUTED)._