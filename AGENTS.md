# AGENTS.md

## Project Context

This is a UNI·MATE app repository (React 18 + Vite + shadcn/ui on Supabase). Treat it as user-owned application code, keep changes focused on the user's request, and preserve existing project conventions.

Start with `README.md` for local setup and environment variables.

## Key Files

- `src/`: frontend application source.
- `src/lib/supabase.js`: Supabase client (reads `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`).
- `src/lib/useUserData.js` + `src/lib/tables.js`: entity → table mapping and data layer (Supabase queries + realtime).
- `supabase/schema.sql`: database schema source of truth (RLS, triggers, Edge Function backing tables).
- `supabase/functions/`: deployed Edge Functions (`ai-assistant`, `google-calendar-sync`).
- `vite.config.js`: Vite config (react plugin + `@` alias).
- `.env.local`: local-only environment values; never commit secrets.

## Working Notes

- Use `npm run dev` (Vite) for local development; frontend-only against the hosted Supabase project.
- Run the relevant checks from `package.json` before finishing code changes: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.
- Never modify files under `src/lib/*Engine.js` or their test files — they are pinned engines.