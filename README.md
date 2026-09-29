# UNI·MATE — Academic OS

Your university, organized around you. A personal academic operating system for schedules, courses, tasks, exams, grades, notes, focus, and planning — local-first, with a hosted backend when configured.

## Stack

- **Frontend**: React 18 + Vite (rolldown) + shadcn/ui (Tailwind CSS), `react-router-dom`, framer-motion
- **Backend**: Supabase (Postgres + RLS, Auth, Edge Functions)
- **Data layer**: `src/lib/useUserData.js` over the repository adapter (`src/lib/repo/`) — local storage or Supabase, selected by environment at startup

## Prerequisites

1. Clone the repository.
2. Install dependencies: `npm install`.
3. Create `.env.local` with your Supabase project credentials (only if you want the hosted backend):

```bash
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

`.env.example` lists every variable (client + server-side Edge Function secrets) — never commit real values.

## Run Locally

```bash
npm install
npm run dev        # Vite dev server (hosted backend when env is present, otherwise local)
```

Open `http://localhost:5173`. Auth, database, and Edge Functions are served by your Supabase project directly when configured.

## Production

**https://someonefrom2007.github.io/UNI-MATEOS/**

Deployed from `main` by `.github/workflows/deploy.yml` (GitHub Pages, `build_type: workflow`). Every push to `main` rebuilds and republishes; the deploy commit is the commit that is live.

- **Backend:** `tqmhmpmfqmrtpizgluox` (the only project with the full schema). The client bundle references that URL and no other.
- **Env configured:** `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, as repository Actions *variables*. Both are public by design — the anon key is protected by RLS, not by secrecy. The service-role key and the `LEMON_SQUEEZY_*` secrets live on the Supabase project as Edge Function secrets and must never be added to the workflow or the repo.
- **Sub-path hosting:** GitHub Pages serves a repository from `/UNI-MATEOS/`, so the build base is baked in via `BASE_PATH`. Anything that bypasses React Router — `window.location.href`, Supabase `redirectTo` — must go through `src/lib/appBase.js` (`appPath`/`appUrl`) or it will resolve against the origin root and 404. A test walks `src/` and fails on any regression of that.
- **Deep links return HTTP 404.** Pages has no SPA rewrite, so the workflow copies the built `index.html` to `404.html`; the app boots and routes client-side, which works but serves a 404 status. Fine behind login, worth knowing before relying on status codes or SEO. A custom domain would fix it properly.
- **Verify a deploy:** `node qa/hosted/verify-browser.mjs --base https://someonefrom2007.github.io/UNI-MATEOS` runs the real browser against the live URL.

## Local workspace (no backend, no env)

The app is local-first: the data adapter is chosen by environment at startup.

- **Supabase env vars present** → hosted backend: auth + realtime + edge functions.
- **Supabase env vars absent** → fully local workspace: no login, all data persisted on-device under the `unimate:v1:` storage namespace. Accounts, password reset, and live OAuth/provider flows are unavailable in this mode and say so honestly. Plan upgrades there are a clearly labeled **simulated** preview.

The repository layer lives in `src/lib/repo/` (`storage.js`, `localRepo.js`, `supabaseRepo.js`, `select.js`); `useUserData` is the stable surface the UI talks to. Local rows carry `id` / `user_id` / `created_at` / `updated_at` so they can be pushed to Supabase by the matching adapter.

## What's inside

- **Full academic OS** — Courses, Schedule (day/week/month + ICS feeds), Tasks, Exams, Grades (0–10, ECTS-weighted, Matrícula de Honor), Notes, Resources, Focus timer, Goals, Habits, Workload, Insights, Sticky Wall with floating stickies, Attendance, Timeline.
- **Rescue My Week** (`/rescue`) — an honest recovery plan over your real free time, with adopt-to-schedule.
- **Billing** — Lemon Squeezy checkout/entitlement via the `lemon-squeezy` edge function (server-authoritative webhooks). Unconfigured deployments show COMING SOON; the local workspace shows a simulated toggle.
- **Google Calendar & Google Drive** — real OAuth2 connectors (`google-calendar-sync`, `google-drive` edge functions) pulling events into Schedule and files into Resources, deduplicated. Unconfigured deployments show an honest COMING SOON state.
- **AI Assistant** — `ai-assistant` edge function grounded in your data (falls back to a deterministic summary without `OPENAI_API_KEY`).
- **Community** — discover feeds, communities & study groups, moderation, save/report; initials-only identity; academic data never exposed.
- **i18n** — en / ca / es (Settings → Language; also on Profile).

## Database & Edge Functions

- **Schema**: `supabase/schema.sql` is the bootstrap **baseline** snapshot (tables, RLS policies, triggers). Apply it first via the Supabase dashboard (SQL editor) or the Supabase CLI.
- **Migrations**: `supabase/migrations/` is the **source of truth** once a database exists. Apply in filename order, before `schema.sql` ever gets re-run.
  - `20260929000000_paid_entitlement_enforcement.sql` — makes the database the paywall: `has_paid_entitlement()` reads `subscriptions` only (never the client-writable `user_metadata.plan`), and every CRUD policy on `flashcards` / `flashcard_decks` / `study_plans` / `study_plan_items` becomes `auth.uid() = user_id AND has_paid_entitlement()`. Admin is exempt. Focus sessions, tasks, grades and courses stay ungated — they are free-tier data.
  - It also adds `advanced_analytics()`, a `SECURITY DEFINER` derived read that computes the paid Analytics numbers server-side and returns `42501` for non-entitled callers, so the Pro maths is no longer reproducible from free-tier tables in the browser.
  - The migration is written to be re-runnable: it narrows policies by `DROP` + `CREATE`, and every replacement is strictly narrower than the policy it replaces, so a re-run can never widen access.
- **Edge Functions** (`supabase/functions/`):
  - `ai-assistant` — grounded academic copilot. Set `OPENAI_API_KEY` as a function secret for model answers (deterministic summary without it).
  - `lemon-squeezy` — checkout / status / manage + HMAC-verified webhook → entitlements.
  - `google-calendar-sync` — OAuth connect + calendar sync into `schedule_events` (dedup by `google_event_id`).
  - `google-drive` — OAuth connect + file sync into `resources` (dedup by `drive_file_id`).
- **Secrets**: all provider secrets are server-side Edge Function secrets (`LEMONSQUEEZY_*`, `GOOGLE_*_CLIENT_*`, `OPENAI_API_KEY`). See `.env.example`. Never put them in `VITE_*` variables — the browser must never see them.

Run Edge Functions locally with the Supabase CLI: `supabase functions serve`.

## Checks

Before finishing code changes, run:

```bash
npm run verify
```

(equivalent to `npm run typecheck && npm run lint && npm test && npm run build`).

### Hosted checks

`npm run verify` is fully local. To prove the security posture against the **real** hosted project:

```bash
npm run verify:hosted:all   # or verify:hosted / verify:entitlement individually
```

- `verify:hosted` — real logins, real JWTs, real PostgREST. Proves a free user cannot read or write the paid tables, cannot call `advanced_analytics`, that a founder still can, and that anon is refused.
- `verify:entitlement` — database-level. The paywall lives in RLS, so it has to impersonate `authenticated` and flip subscription rows, which no client may legitimately do. It runs inside a single transaction that always ends in `ROLLBACK`, so no fixture or subscription ever reaches production. It reads the Supabase CLI token from the macOS keychain (never printed, never written); no service-role key is required.

Both report `PASS` / `FAIL` / `NOT EXECUTED` and exit non-zero on any failure. `NOT EXECUTED` is never rounded up to a pass — a missing credential degrades a whole matrix rather than quietly going green. `verify-entitlement` additionally asserts its own **non-vacuity**: it reinstates the pre-migration ownership-only policy inside a rolled-back transaction and confirms a free caller can then read the row, which proves the denial checks can actually detect the hole they claim to close.

## Notes

- **RLS**: every data table has row-level security scoped to `auth.uid()`. The `user_profiles` row for `auth.users` is auto-provisioned by the `handle_new_user()` trigger.
- **Entitlement is server-authoritative**: `subscriptions.tier` (written only by the `lemon-squeezy` webhook with the service role) is the single source of truth, checked by both edge functions and now by RLS. `user_metadata.plan` is writable by the account owner via `auth.updateUser()`, so it can neither grant nor revoke a paid feature.
- **Known inconsistency — staff without a subscription row.** `has_paid_entitlement()` ORs in `is_admin()`, so the database treats staff as entitled. The client's plan comes from the `lemon-squeezy` `status` action, which reports `free` when there is no `subscriptions` row. A founder with no subscription row therefore sees the Pro paywall in the UI even though the RPC would happily serve them. This fails **closed**, so it is not a security hole — it under-grants. Aligning the two is a product decision (either seed a subscription for staff, or have `status` return an entitlement flag derived from the same rule as the database) and is deliberately not done here.
- **Profile fields** (university, degree, target GPA, language, etc.) are stored in auth user metadata via `supabase.auth.updateUser({ data: ... })`.
- The grade/schedule/workload/insights engines in `src/lib/*Engine.js` and their tests are pinned — do not modify them.
- The test suite runs from `src` only (`vite.config.js`), so agent worktrees never inflate or break it.