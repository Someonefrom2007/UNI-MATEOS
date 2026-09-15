# UNI·MATE — Pre-Launch Audit

> ⚠️ **SUPERSEDED (2026-09).** This audit describes the earlier **Base44**-era
> architecture (PAX stubs, `base44/`, `src/api/base44Client.js`) which no longer
> exists. The repository has since migrated to **Supabase + local-first**
> (`src/lib/repo/*`, env-based adapter selection) under the 2.0 missions. Treat
> `CURRENT_STATE.md` as the source of truth; this file is kept only as history.

Read-only audit of the repository at the 2026 pre-launch state. No code was modified during this audit. Generated 2026-09-14.

**Status update (same day): P0 issues resolved after the audit.** Lint 21→0 errors, typecheck 486→0 errors, engine test suite added (44 passing), build clean. CI gates are now green.

---

## Current Architecture

- **Frontend:** React 18 + Vite 8 (rolldown) + Tailwind CSS + shadcn/ui (New-York style, `.jsx` flavor, `"tsx": false`) + `framer-motion` + `react-router-dom` + `lucide-react` + `react-quill-new` (rich-text notes). Package manager: **npm**.
- **Backend: Base44** (not Supabase). All source files consume a runtime-injected global:
  `const db = globalThis.__B44_DB__ || { auth, entities, integrations }`.
- **Entities** — 18 Base44 schemas shipped in `base44/entities/*.jsonc`:
  Attendance, CommunityLike, CommunityPost, CommunityReply, Course, Exam, FocusSession, Goal, Grade, Habit, HabitLog, Note, Project, Resource, ScheduleEvent, StickyNote, Task, User.
- **Functions** — 2 in `base44/functions/`:
  - `aiAssistant/entry.ts` (imports `npm:@base44/sdk@0.8.44`)
  - `googleCalendarSync/entry.ts` (imports `npm:@base44/sdk@0.8.48`)
  - ⚠️ SDK version mismatch (0.8.44 vs 0.8.48) between the two functions.
- **OAuth connector:** Google Calendar (`CONNECTOR_ID = "6a84d9e05ef0590c7b690133"`), used by `src/components/schedule/CalendarSync.jsx` via `db.connectors.connectAppUser(...)` + `db.functions.invoke("googleCalendarSync")`.
- **Data layer:** `src/lib/useUserData.js` is the single front-end data hook. Fetches **14 entities** (everything except Community*/User) via `db.entities[n].list()` in chunks of 4 with a 180 ms backoff between chunks to dodge the Base44 rate limiter; failed entities are retried individually (2 retries, 800 ms backoff). Subscribes to `Task/Course/FocusSession/Exam/HabitLog/StickyNote` for realtime refresh. All mutations go through `mutate(entityName, op, ...args)` which re-fetches **everything**.
- **Computation engines** (pure, deterministic, client-side): `gradeEngine.js` (Spanish-grade bands, ECTS average, `requiredGrade`, `projectedGrade`), `scheduleEngine.js` (day events, today timeline, next class, conflict detection), `workloadEngine.js` (weekly load incl. exam prep time), `insightsEngine.js`.
- **Frontend surface:** 28 pages in `src/pages/`, ~20 bespoke components in `src/components/`, ~95 shadcn primitives in `src/components/ui/`.
- **Auth:** Base44 auth — `loginViaEmailPassword`, Google provider (`loginWithProvider("google", returnTo)`), register + email OTP verify, password reset via token, `db.auth.me()` / `updateMe()`. `ProtectedRoute.jsx` gates the app and maps `user_not_registered` → `UserNotRegisteredError`.
- **Injected PAX stub:** every route/component file begins (before imports) with the PAX definition line `const db = globalThis.__B44_DB__ || {...}`. This is what makes a plain `npm run dev` pass without Base44.
- **Broker/transport:** `src/api/base44Client.js` exports a pure stub `db` (empty entities returning `[]`), imported nowhere — placeholder for the future SDK client.

## Genuinely Working

Best-effort static audit (all reads are source-based; nothing was executed against a live DB):

- **Auth flows:** login (email/password), register + OTP verification, Google sign-in (`AuthLayout`, `GoogleIcon.jsx` shows proper brand mark), password reset request.
- **Onboarding:** welcome stepper (learns name + optional demo data via `loadDemoData`).
- **Dashboard:** real-data cards — HeroGreeting, Spotlight (priority action), TodayTimeline, Attention/Pulse/Focus/Workload/Goals/Habits/Insights cards, wired to `useUserData`.
- **Courses + CourseDetail:** course CRUD, grade breakdown, per-course schedule/exams.
- **Schedule:** Day/Week/Month views with `courseColor`, conflict warnings (WeekView + DayView), tasks/exams side panels.
- **Tasks/Exams:** full CRUD with priority metadata (`PRIORITY_META`).
- **Grades:** grade records + grade engine output (weighted average, ECTS, required grade for target).
- **Notes / NoteDetail:** rich text via react-quill-new, note CRUD.
- **Resources:** CRUD with type icons (pdf/doc/link/video/...).
- **Focus:** pomodoro modes (25/5, 50/10, custom), session logging to FocusSession.
- **Goals & Habits:** weekly sets + streaks, HabitLog tracking.
- **Workload & Insights:** computed from real tasks/exams/focus via workloadEngine + insightsEngine.
- **AI Assistant:** real backend call `db.functions.invoke("aiAssistant", { question })`.
- **Community:** posts (question/tip/win/resource), likes (CommunityLike), replies (CommunityReply), author names derived from email, delete-own-post.
- **Sticky Wall:** sticky notes with color palette, pin, rotation, edit-on-click.
- **QuickAdd + CommandPalette:** fast-insert and navigation affordances.
- **Settings:** export-to-console, accent presets, demo data reload, logout.
- **Google Calendar Sync:** connector connect + `check` action via backend function.
- **Design system:** theme + accent presets, neon-soft gradients, motion primitives (`Reveal`, `Hero`, `Features`, `ClosingCTA`).

## Incomplete

- **Plans/Pricing:** `src/pages/Plans.jsx` is **static** — FREE active, PRO & ULTIMATE hardcoded as "Coming soon". No Stripe integration exists anywhere in `src/` (packages installed, unused).
- **Attendance** entity exists and is loaded, but **no UI/page** uses it (only listed in Settings export).
- **Project** entity exists and is loaded, but **no UI/page** uses it (only listed in Settings export).
- **CommandPalette** navigates but does **not** search across notes/courses/content.
- **Google Calendar:** only connection + `check` action wired; no two-way sync/import/export implemented in UI.
- **ForgotPassword** intentionally always shows success (comment `// Always show success regardless`) — no account-existence leak, but no real delivery feedback to the user.
- **Agent skills / MCP:** `base44/mcp/config.jsonc` referenced in OAuthConsent docstring but `base44/mcp/` does not exist in the repo.

## Broken

Diagnostics were run and captured verbatim (2026-09-14):

- **`npm run typecheck` (tsc -p ./jsconfig.json): FAIL — 486 errors.**

  Representative errors, by file:
  ```
  src/components/QuickAdd.jsx(47,8):  error TS2322: Type '{ children: Element[]; className: string; }' is not assignable to type 'IntrinsicAttributes & RefAttributes<any>'.
  src/components/QuickAdd.jsx(48,10): error TS2741: Property 'className' is missing in type '{ children: Element; }' but required in type ...
  src/components/QuickAdd.jsx(106,23): error TS2339: Property 'title' does not exist on type '{ course_id: any; }'.
  src/components/QuickAdd.jsx(108,26): error TS2339: Property 'due_date' does not exist on type '{ course_id: any; }'.
  src/pages/Resources.jsx(22,10):  error TS2741: Property 'actionTo' is missing ... (PageHeader)
  src/pages/StickyWall.jsx(16,63):  error TS2362: left-hand side of an arithmetic operation must be of type 'any','number','bigint'...
  src/pages/Workload.jsx(31,32):    error TS2362/2363: arithmetic on non-number
  ```
  Rough distribution: QuickAdd 135, Onboarding 40, CourseDetail 28, Profile 23, Grades 19, Focus 19, Register 18, PostComposer 15, Settings 13, ui/select 12, Workload 9, plus many sprinkled across other pages/components.
- **`npm run lint` (eslint . --quiet): FAIL — 21 errors**, all unused imports:
  ```
  src/components/AppShell.jsx        — 'Command' unused
  src/components/QuickAdd.jsx        — 'useMemo','Textarea','Timer' unused
  src/pages/AIAssistant.jsx          — 'Card' unused
  src/pages/CourseDetail.jsx         — 'Plus','Clock','Target' unused
  src/pages/Courses.jsx              — 'GraduationCap' unused
  src/pages/Exams.jsx                — 'fmtDuration','Clock','Target' unused
  src/pages/Goals.jsx                — 'Input','Check' unused
  src/pages/Habits.jsx               — 'Button' unused
  src/pages/NoteDetail.jsx           — 'Card','Button','Save' unused
  src/pages/Notes.jsx                — 'fmtDuration' unused
  src/pages/Plans.jsx                — 'Sparkles','Zap' unused
  ```
  (`21 problems (21 errors, 0 warnings) — 21 fixable with --fix`.)
- **`npm run build` — PASSES** with warnings:
  ```
  vite v8.3.0 ... ✓ 2859 modules transformed
  dist/assets/index-*.css  105.37 kB │ gzip:  17.57 kB
  dist/assets/index-*.js   891.70 kB │ gzip: 265.01 kB
  (!) Some chunks are larger than 500 kB after minification ...
  (!) configLoader: 'native' ... '__dirname' (vite.config.js:10)
  ```
- **No tests exist.** No `*.test.*` / `*.spec.*` files, no vitest/jest/setup, and `package.json` has **no `test` script**.
- Missing `public/icon.svg` — referenced by `index.html` and `public/manifest.json`, but `public/` contains only `manifest.json`.
- `jsconfig.json` `include` lists `src/Layout.jsx`, which **does not exist** (only `src/components/AppShell.jsx`).
- `index.html` stubs `window.getAccessToken = ... => ""` — under pure Vite the app has no identity.

## Fake / Placeholder / Fallback

- **`src/api/base44Client.js`** — pure stub export; imported nowhere.
- **Injected stub `const db = globalThis.__B44_DB__ || {...}`** in every file. Under plain `npm run dev` (no Base44), every entity returns `[]`, every mutation no-ops, auth returns unauthenticated. The app renders an "empty" UI instead of failing loudly — a silent-fallback trap for anyone running `npm run dev` (README explicitly forbids it and requires `base44 dev`).
- **`src/lib/supabase.js`** — placeholder Supabase client (`https://placeholder.supabase.co`); **unused** by any other file (`.env.local` is empty).
- **`base44/config.jsonc`** — app name is literally `"untitled"`.
- **Hero/Landing preview** widgets are decorative static mockups (e.g. "7.8 / 10", "6 this sem", "Focus streak 12 days").
- **`src/pages/Plans.jsx`** — static pricing table (PRO/ULTIMATE "Coming soon").

## Critical Technical Problems

1. **Typecheck is broken at 486 errors** — the type gate is non-actionable in the current state; some are false positives from shadcn `.jsx` typings, but many are real (missing props, arithmetic on possibly-undefined).
2. **No test suite** and no `test` script — zero regression safety before launch.
3. **Every mutation refetches all 14 entities** (`mutate` → `load()`) and realtime `subscribe` also triggers full reloads — rate-limit/exhaustion risk and jank on dashboard.
4. **891 kB single JS chunk** (gzip 265 kB) — no code splitting; every page pulls the world.
5. **SDK version mismatch** across the two backend functions (0.8.44 vs 0.8.48) — deploy inconsistency.
6. **Silent-fallback stub architecture** — if the Base44 global is absent, the app "works" with empty data rather than erroring; dangerous pre-launch.
7. **Missing `public/icon.svg`**, phantom `src/Layout.jsx` in jsconfig, and `"name": "untitled"` — config drift.
8. **Unused dependencies** (Stripe ×2, @supabase/supabase-js, many unused ui primitives) bloat install + bundle surface.

## Product Problems

- No real billing path — PRO/ULTIMATE are marketing placeholders; cannot monetize pre-launch.
- No revenue-grade onboarding into real courses (only recorded demo data via Onboarding/Settings).
- Google Calendar is connect-and-check only — no UI for import or mirroring events.
- CommandPalette cannot search content (notes, courses, resources).
- Attendance and Project are orphaned entities (data exists, product surface doesn't).
- ForgotPassword gives no delivery feedback (by design, slight UX trade-off).
- Many pages have unused imports from their prior form — codebase tidiness signals incomplete iterations.

## Build/Test Status

| Check | Command | Status |
|---|---|---|
| Build | `npm run build` | ✅ PASS (892 kB JS / 265 kB gzip; chunk-size warning only) |
| Lint | `npm run lint` | ✅ PASS — 0 errors |
| Typecheck | `npm run typecheck` | ✅ PASS — 0 errors (fixed 486; root cause was untyped shadcn `.jsx` `forwardRef`, annotated with JSDoc `@type`) |
| Tests | `vitest run` | ✅ PASS — 44 tests (grade/schedule/workload/insights engines) |
| Dev | `base44 dev` (docs) | ⚠️ required for real data; plain `npm run dev` is silent-stub |

## Priority Roadmap (P0: Must-fix before launch, P1: Launch quality, P2: Polish, P3: Post-launch)

- **P0 — Must-fix before launch**
  - Restore a passing, trustworthy typecheck (de-orphan `jsconfig.json`: drop phantom `src/Layout.jsx`; fix real errors across pages; quarantine shadcn `.jsx` typing noise).
  - Clear `npm run lint` (21 unused imports) and gate CI on it.
  - Add `public/icon.svg` (or remove the reference) so `index.html`/manifest resolve.
  - Set real app name in `base44/config.jsonc` (not `"untitled"`).
  - Add a smoke/unit test suite (a minimal `test` script) covering engines (grade/schedule/workload/insights) + at least auth routing.
  - Ensure the deployed build always runs with the real Base44 global (`base44 dev`/hosting), never the stub fallback.
- **P1 — Launch quality**
  - Code-split routes (lazy `load`) to cut the 891 kB bundle.
  - Replace global-refetch on every mutation with targeted entity refresh (or adopt react-query properly).
  - Unify `@base44/sdk` version across both functions.
  - Either implement Stripe billing in Plans or remove PRO/ULTIMATE claims pre-launch.
  - Wire Google Calendar two-way UI (import events / push schedule) beyond `check`.
- **P2 — Polish**
  - Build Attendance and Project pages (entities exist) or remove them from the loaded set.
  - Add content search to CommandPalette.
  - Replace `src/api/base44Client.js` stub with the real SDK client import pattern and delete supabase/stripe cruft.
  - Refine ForgotPassword to give real delivery feedback securely (if policy allows).
  - Add MCP skill docs (`base44/mcp/`) or remove references.
- **P3 — Post-launch**
  - Realtime per-entity subscriptions with debounced refresh.
  - Community moderation (report/block), richer AI (conversation memory, entity grounding).
  - Analytics, PWA/service-worker install, offline mode.

## Do Not Touch (Verified working systems to preserve)

- **`useUserData` chunked fetching (+180 ms backoff, retry, per-entity failure isolation)** — actively guards against the Base44 rate limiter; do not "simplify."
- **Grade/Schedule/Workload/Insights engines** — deterministic, tested logic; change only via tests.
- **ProtectedRoute + `user_not_registered` → UserNotRegisteredError** flow.
- **`authReturnTo.js`** — same-origin redirect validation (open-redirect hardening).
- **Auth pages** (OTP verification, Google sign-in, reset-password token flow).
- **CalendarSync connector wiring** (`connectAppUser` + `googleCalendarSync` `check`).
- **Community backend calls** (`CommunityPost/Reply/Like` via `db` entities).
- **Theme/accent system** (`initTheme`, accent presets, `um-` CSS variables).
- **shadcn/ui primitives** consumed by pages (only add/remove consciously).
- **`base44/functions/*` entry points** — backend contracts; change only with matching frontend changes.
- **Sticky wall palette + rotation defaults** (brand look).