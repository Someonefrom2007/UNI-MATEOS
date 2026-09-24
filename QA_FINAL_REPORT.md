# UNI·MATE — QA FINAL REPORT

Full-system audit of the UNI·MATE React app in local workspace mode (no Supabase env → synthetic
identity, `unimate:v1:` persistence, DEV-ONLY auto-granted admin). Everything below was executed in
a real browser (puppeteer-core + Chrome) against the live Vite dev server.

## Result summary

| Gate | Result |
|------|--------|
| Commands | typecheck · lint · 664 unit tests (51 files) · production build — **all green** |
| Route sweep | **59/59** pages render, no blanks/crashes/overflows, status 200 (10 browser-cache 304s = fine), 0 console/page/network errors |
| Student CRUD | **102/102** — creates, edits, deletes, pins, autosave, permissions-free dense flows + survive-reload sweep |
| Admin console | **28/28** — 15 sections render permission-filtered, announcements CRUD + audit trail, feature-flag create + enable/disable, users search, ⌘K search, mobile drawer, entry point |
| Cross-system | **17/17** — ⌘K palette (open/search/navigate/close), QuickAdd empty-submit guard, i18n en→es→en persisted across reload, theme light/dark persisted, responsive 390–1920 with zero horizontal overflow on 6 key pages |

## Product defects found & fixed

1. **Admin had no entry point in the student app** (the reported issue) — `AdminProvider` now wraps
   the student shell; admins get an authorization-aware "Control Center" link in the sidebar and the
   mobile drawer. (`src/App.jsx`, `src/components/AppShell.jsx`)
2. **Admin mobile drawer never opened** — `setMobileNav(false)` was being *called during render* via
   `onClick={closeMobile ? setMobileNav(false) : undefined}`; now a proper handler. Opens/closes and
   "back to student app" verified at 390 px in dev and production builds. (`AdminShell.jsx`)
3. **Dashboard PulseCard CTA wrong when courses existed but no grades** — now course-count aware
   ("Log a grade" vs "Add your first course"). (`PulseCard.jsx`, `Dashboard.jsx`)

Detail + root causes in `QA_FAILURES.md`.

## Coverage map

`QA_MASTER_MATRIX.md` tracks every page, entity, admin section, and cross-system concern with a
status. Notable remaining 🔲 rows (unverified in-browser, by design or scope): external integrations
(Google Calendar/Drive, Lemon Squeezy, AI — architecture+unit verified, live can't run locally),
deep admin actions (billing reconcile, webhook replay, content moderation, dev playground,
console prefs), and a few CRUD sub-flows (grades/attendance/flashcards/study-plan materialization).

## Founder authorization model (added)

- **Role hierarchy**: `founder > super_admin > admin > student`. `founder` holds
  the full permission catalog (including `system.manage` / Developer Tools) and
  the founder's identity renders as "Miquel / Founder" with the initials avatar —
  the account email is never shown in the console or leaked to students.
- **Server-side truth**: authority lives only in `admin_accounts`
  (`role`, `enabled`); SECURITY DEFINER `is_admin()` / `current_admin_role()` /
  `current_admin_permissions()` gate every RLS policy and re-derive the caller
  from the JWT — nothing a student can type, store, or mutate grants access.
  `enabled = false` is the instant kill-switch. Email gating is not used
  anywhere — no code checks `user.email ===` for authorization.
- **Idempotent bootstrap**: `bootstrap_founder(p_email)` resolves `FOUNDER_EMAIL`
  → `auth.users.id`, inserts `role = 'founder', enabled = true`
  `ON CONFLICT (user_id) DO NOTHING`, and is executable only by service_role /
  SQL owner. The schema seed provisions this deployment's founder; re-runs never
  duplicate and never overwrite existing memberships. The email is absent from
  the client bundle, localStorage, and API responses (verified by grep + E2E).
- **Entry is subtle, not cluttered**: Settings → "Founder Console" card and
  ⌘K/Ctrl+K → "Founder Console". No permanent item in the student nav, no second
  login, no secret URL. Direct `/admin` typing still goes through `RequireAdmin`
  + per-section `RequirePermission`, enforced again by RLS.

## Deliberate boundaries respected

- No changes under `src/lib/*Engine.js` or their tests (pinned engines).
- Only real behaviour counts — no mocked assertions; one expected-fail check (A01 entry point) was
  carried until the root cause was fixed and then flipped to pass.
- No features removed or replaced; three targeted root-cause fixes only.

## How to re-run

```
npm run dev            # Vite on :5130
node qa/e2e/routes.mjs # → routes-report.json (59/59)
node qa/e2e/crud.mjs   # → crud-report.json (102/102)  — ~2min, includes one real 61s focus block
node qa/e2e/admin.mjs  # → admin-report.json (28/28)
node qa/e2e/aux.mjs    # → aux-report.json (17/17)
npm run verify         # typecheck + lint + tests + build
```

## Environment note

The QA harness assumes local workspace mode (no `VITE_SUPABASE_*`). Hosted/RLS/admin-schema
behaviour is covered by the 664-test unit suite and the `supabase/schema.sql`/Edge Function audit —
not by live credentials.