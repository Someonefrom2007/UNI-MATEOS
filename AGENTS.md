# AGENTS.md

## Project Context

This is a UNI·MATE app repository (React 18 + Vite + shadcn/ui on Supabase). Treat it as user-owned application code, keep changes focused on the user's request, and preserve existing project conventions.

Start with `README.md` for local setup and environment variables.

## Key Files

- `src/`: frontend application source.
- `src/lib/supabase.js`: Supabase client (reads `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`).
- `src/lib/useUserData.js` + `src/lib/tables.js`: entity → table mapping and data layer (Supabase queries + realtime).
- `supabase/schema.sql`: **bootstrap baseline** snapshot of the database (RLS, triggers, Edge Function backing tables). Frozen from 2026-09-29 onward — see its header.
- `supabase/migrations/`: **source of truth** for anything after that. Apply in filename order, once, against a live database.
- `supabase/functions/`: deployed Edge Functions (`ai-assistant`, `google-calendar-sync`).
- `vite.config.js`: Vite config (react plugin + `@` alias).
- `.env.local`: local-only environment values; never commit secrets.

## Working Notes

- Use `npm run dev` (Vite) for local development; frontend-only against the hosted Supabase project.
- Run the relevant checks from `package.json` before finishing code changes: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` (or `npm run verify`).
- Never modify files under `src/lib/*Engine.js` or their test files — they are pinned engines.
- **Entitlement is server-authoritative.** `subscriptions.tier` is the only thing that grants a paid feature. `user_metadata.plan` is writable by the account owner, so it can neither grant nor revoke. When touching a paywalled surface, keep the UI gate, the edge function check, the RLS policy and `has_paid_entitlement()` in agreement.
- Changes to RLS, the paid tables or `advanced_analytics()` need a real hosted proof, not just unit tests: `npm run verify:hosted:all`. It writes nothing to production (fixtures run in a transaction that always rolls back).
- Never report a security check as passing unless it actually executed. `NOT EXECUTED` is a real outcome, not a pass.