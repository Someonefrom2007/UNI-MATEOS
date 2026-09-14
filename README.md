# UNI·MATE — Academic OS

Your university, organized around you. A personal academic operating system for schedules, courses, tasks, exams, grades, notes, and focus.

## Stack

- **Frontend**: React 18 + Vite + shadcn/ui (Tailwind CSS)
- **Backend**: Supabase (Postgres + RLS, Auth, Edge Functions)
- **Data layer**: `@supabase/supabase-js` — see `src/lib/supabase.js`

## Prerequisites

1. Clone the repository.
2. Install dependencies: `npm install`.
3. Create `.env.local` with your Supabase project credentials:

```bash
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

`.env.example` has the same keys as a template — never commit real values.

## Run Locally

```bash
npm install
npm run dev        # Vite dev server (frontend against your hosted Supabase project)
```

Open `http://localhost:5173`. Auth, database, and Edge Functions are served by your Supabase project directly.

## Local workspace (no backend)

The app is local-first: the data adapter is chosen by environment at startup.

- **Supabase env vars present** → hosted backend, exactly as before (auth + realtime).
- **Supabase env vars absent** → the app runs as a fully local workspace: no login, all data persisted on-device under the `unimate:v1:` storage namespace. Accounts, password reset, Google Calendar sync, and the server-side AI assistant are unavailable in this mode and say so honestly.

The repository layer lives in `src/lib/repo/` (`storage.js`, `localRepo.js`, `select.js`); `useUserData` is the stable surface the UI talks to and branches internally. Local rows carry `id` / `user_id` / `created_at` / `updated_at` so they can later be pushed to Supabase by a matching adapter (Mission 2).

## Database & Edge Functions

- **Schema**: `supabase/schema.sql` is the source of truth (tables, RLS policies, triggers). Apply it in the Supabase dashboard (SQL editor) or via the Supabase CLI.
- **Edge Functions** (`supabase/functions/`):
  - `ai-assistant`: grounded academic copilot. Set `OPENAI_API_KEY` as a function secret to enable model answers (falls back to a deterministic data summary without it).
  - `google-calendar-sync`: Google Calendar connector stub (OAuth is not wired up yet).

Run Edge Functions locally with the Supabase CLI: `supabase functions serve`.

## Checks

Before finishing code changes, run:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## Notes

- **RLS**: every data table has row-level security scoped to `auth.uid()`. The `user_profiles` row for `auth.users` is auto-provisioned by the `handle_new_user()` trigger.
- **Profile fields** (university, degree, target GPA, language, etc.) are stored in auth user metadata via `supabase.auth.updateUser({ data: ... })`.
- The grade/schedule/workload/insights engines in `src/lib/*Engine.js` and their tests are pinned — do not modify them.