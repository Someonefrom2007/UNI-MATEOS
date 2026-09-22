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

- **Schema**: `supabase/schema.sql` is the single source of truth (tables, RLS policies, triggers, additive migrations). Apply it in the Supabase dashboard (SQL editor) or via the Supabase CLI before going live.
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

## Notes

- **RLS**: every data table has row-level security scoped to `auth.uid()`. The `user_profiles` row for `auth.users` is auto-provisioned by the `handle_new_user()` trigger.
- **Profile fields** (university, degree, target GPA, language, etc.) are stored in auth user metadata via `supabase.auth.updateUser({ data: ... })`.
- The grade/schedule/workload/insights engines in `src/lib/*Engine.js` and their tests are pinned — do not modify them.
- The test suite runs from `src` only (`vite.config.js`), so agent worktrees never inflate or break it.