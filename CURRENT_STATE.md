# UNI·MATE — CURRENT STATE

Evidence-based snapshot from repository inspection + green-gate baseline (2026-09-15, as of Mission 9 `HEAD`). Do not treat this file as a spec — it records what actually exists.

## Baseline verification (all green)

| Gate | Command | Result |
|---|---|---|
| Typecheck | `npm run typecheck` (tsc -p ./jsconfig.json, checkJs) | ✅ 0 errors |
| Tests | `npm test` (vitest run) | ✅ 19 files / 256 tests pass |
| Lint | `npm run lint` (eslint . --quiet) | ✅ 0 errors |
| Build | `npm run build` | ✅ PASS — PWA sw.js generated, 58 precache entries (1419.09 KiB) |

Runtime/browser verification is NOT available in this environment — evidence is compile + test + build.

## Stack (verified in package.json / configs)

- React 18 + Vite 8 (rolldown) + Tailwind CSS 3 + shadcn/ui (New-York `.jsx`, `tsx:false`)
- `react-router-dom` 6 (BrowserRouter, route-level `React.lazy` splitting in `src/App.jsx`)
- `@tanstack/react-query` (QueryClient, no queries used yet — infra only) + `framer-motion` (motion primitives + AppShell page transitions)
- `lucide-react`, `react-quill-new` (notes). App no longer ships `three`/`jspdf`/`html2canvas`/`moment`/`recharts`/Stripe — all unused deps + 35 unused ui primitives removed in Mission 9 (see ROADMAP).
- Package manager: npm. `package-lock.json` present.

## Architecture

### UI → Application logic → Persistence (current)
- **Persistence: Supabase** (`@supabase/supabase-js` 2.x). All app data in hosted tables; schema source of truth `supabase/schema.sql` (674 lines; every table `user_id uuid DEFAULT auth.uid()`, per-user RLS, `set_updated_at` triggers, soft-delete flags where noted).
- Every data surface is now adapter-aware (Mission 1): `useUserData`, `QuickAdd`, `NoteDetail` autosave, `Schedule` (feed refresh + `mutate` study blocks), `Onboarding`, `Community` (posts/replies/likes via local repo when local), `Settings` (export from local repo, account card hidden), `Profile` (on-device profile), `demoData` (seeds locally), `CalendarSync`/`ICSFeedDialog` (local-aware: ICS imports work; Google connector notes it needs an account), `AIAssistant` (honest notice in local mode).
- **Data layer:** `src/lib/useUserData.js` — single hook loading 14 entities; adapter chosen by environment (`src/lib/repo/select.js`):
  - **Supabase (env vars present):** `select("*")` on each table + realtime `postgres_changes` on 6 tables. Behavior identical to baseline. (See prior CURRENT_STATE entry for retry/realtime details.)
  - **Local workspace (env vars absent):** `src/lib/repo/localRepo.js` over an injectable KV backend (`src/lib/repo/storage.js`, browser `localStorage` with `unimate:v1:` prefix, falling back to an in-memory store for tests). Rows are snake_case arrays with `id` / `user_id` / `created_at` / `updated_at` injected on create. Local adapter skips realtime; UI never branches (`data.<Entity>`, `refresh`, `mutate` unchanged).
- **Entity→table map:** `src/lib/tables.js` (`TABLE`, `getTable`). Both adapters consume this.
- **Auth:** `src/lib/AuthContext.jsx`. Supabase mode unchanged. Local workspace auto-authenticates a synthetic `LOCAL_WORKSPACE_USER` identity (`is_local_workspace: true`), skips `onAuthStateChange`, and exposes `localWorkspace` on the context. Login/Register redirect to `/dashboard`; ForgotPassword/ResetPassword render an honest notice; AppShell shows an amber "Local workspace" indicator and hides logout. Local user profile is persisted separately (`src/lib/repo/select.js` → `localStorage`).
- **Computation engines (pinned, do not modify):** `gradeEngine.js`, `scheduleEngine.js`, `workloadEngine.js`, `insightsEngine.js`, `burnout.js`, `calendarSync.js` (+ existing `.test.js` files).
- **New tested pure modules (added for the test suite):** `triage.js`, `planner.js`, `paletteSearch.js`, `syllabusImporter.js`, `gradesim.js`.
- **Theme/i18n:** CSS-variable theme + accent presets (`theme.js`, `initTheme`, `um-` vars), `i18n.js` en|ca|es (CustomEvent store), `useDeskMode` (desk chaos/tidy), `useSoundscape`.

### Brand assets (current)
- `src/components/Brand/` — centralized brand system (Mission 3):
  - `brand.js` — single source of truth: `BRAND_NAME = "UNI·MATE"`, tagline, three-layer symbol geometry (`SYMBOL_LAYERS`), `BRAND_VARIANTS`.
  - `BrandLogo.jsx` — one component, six conceptual variants: `primary` (classic), `compact`, `symbol`, `gradient`, `white`, `black`. Same approved three-layer diamond geometry in every variant; white/black/gradient are color treatments only — no redesign.
  - `Splash.jsx` — branded loading/splash screen (gradient symbol + wordmark + tagline), reduces motion for `prefers-reduced-motion`, used by App route fallback + auth loading in `src/App.jsx`.
- `src/components/Logo.jsx` — thin backward-compatible wrapper over `BrandLogo`; all existing usages (`size`/`showText`/`subtext`/`className`) unchanged.
- `public/icon.svg` — favicon/PWA mark rebuilt to the three-layer diamond on the dark brand tile (previously a graduation-cap glyph — inconsistent symbol, fixed).
- `public/icons/pwa-192x192.png`, `pwa-512x512.png` (+ maskable entry), `apple-touch-icon.png` (180), `og-image.png` (1200×630) — rasterized via macOS `sips`, pixel-verified (three layer colors + rendered text).
- `public/manifest.json` — PNG icons added (192/512 any + 512 maskable + SVG fallback) for installability.
- `index.html` — favicon, apple-touch-icon.png, `og:image` + `twitter:image` (1200×630), tagline description; title/theme unchanged.
- `vite.config.js` — PWA precaches the brand icons; `og-image.png` glob-ignored so social-only art does not inflate the offline bundle (58 precache entries / 1411.86 KiB vs 52 / 1281.62 KiB baseline).

### Community (current)
- Discover-centric module (Mission 5, 2026-09): feeds **Discover / My posts / Saved**, six content types (question, tip, win, resource, event, announcement) with chips+filter, course filter, free-text search, Newest/Top sort, and like/reply/save/report actions — all driven by a pure, tested engine in `src/lib/communityData.js`. Identity is deterministic gradient initials, never photos.
- Moderation model: posts carry `status` (active/pending/hidden/removed) with a tested transition machine; own non-active posts render a status badge. Reports land in `community_reports` (closed-set reasons). Multi-user-ready schema: `community_saves` + `community_reports` tables added; discovery read policies for active content are in `schema.sql` as an additive migration **pending one-time apply to the hosted project**.
- "Never auto-expose personal academic data" is enforced in the decorating layer (`decoratePosts` only copies the course **name**; grade/ects/gpa never reach community rows) and covered by tests.
- Runs in both modes: local repo (all community tables persist on device) and hosted (direct Supabase queries; stays safe pre-migration by omitting new columns in hosted inserts).

### Landing (current)
- `Landing.jsx` = sticky header (nav from `navSections()`) + full 11-beat narrative: Hero (UNI·MATE display synth tagline) → Problem → Manifesto → Product → Intelligence → Planning → Focus → Community → Privacy → Future → CTA. Built from pure data in `src/components/landing/sections.js` (tested).
- Every decorative product mock (hero command center, product surfaces, focus ring, community thread) is labeled "Illustrative preview" — no invented live numbers (§6/§30). Community mock uses initials-only avatars, never photos (§8).
- Motion via existing `Reveal`/framer-motion primitives honoring `prefers-reduced-motion`; shared `SectionFrame`/`SectionHeading`/`PreviewChip` in `src/components/landing/Section.jsx`.

## What actually works (best-effort, static evidence)

- **All core academic modules** render CRUD against `useUserData`/Supabase: Courses(+CourseDetail), Schedule (Day/Week/Month + course colors + conflict warnings + ICS feed dialog + Google Calendar connector `check`), Tasks (deadline/priority/course/duration/subtasks ui), Exams, Grades (0–10 bands incl. Matrícula de Honor 10.0 + ECTS weighted average + required/projected grade), Notes (quill rich text), Resources, Focus (pomodoro modes + persisted sessions), Goals/Habits (+ logs/streaks), Workload, Insights, Sticky Wall.
- **Dashboard** — real-data bento (Spotlight, TodayTimeline, Attention, Pulse, Focus, Workload, Velocity, Habits/Goals/Insights cards, sticky tile). No invented numbers.
- **AI Assistant** — real backend Edge Function `ai-assistant` (deterministic fallback without OPENAI_API_KEY; no fake AI).
- **PWA** — `vite-plugin-pwa` `generateSW`, offline fallback + denylist (auth/api/.ics), runtime NetworkFirst cache for `*.supabase.co`.
- **Design language** already leans "student's mind, visualized" (cyber-grid scanlines, bento desk, reveal motion, atmospheric blur, Hud mono labels, dark-first).

## Gaps vs the 2.0 directive (evidence-based)

1. **Local-first (directive §6/§7): MET (Mission 1, 2026-09).** App runs with zero backend and data survives refresh/restart: repository interface + local adapter (`src/lib/repo/`), env-based adapter selection, local workspace mode (auto-auth, no accounts), 16 new tests (189 total green). Remaining: Supabase adapter under the same interface (Mission 2), local→cloud push UX.
2. **Repository/service interface (§6/§5): present for persistence.** UI → `useUserData` stable surface → `src/lib/repo/*`. Direct `supabase` calls outside the data hook remain in some components (guarded per-mode); consolidating them under the interface is Mission 2 scope.
3. **Brand variants (§8): DONE (Mission 3).** Centralized `src/components/Brand/*`; six symbol/wordmark variants; favicon, PNG app icons, apple-touch, OG image, PWA icons, branded splash all wired (see Brand assets). Brand consistency test suite added (6 tests).
4. **Landing (§23): DONE (Mission 4).** Full cinematic narrative in the required order; product interface as the hero; honest "Illustrative preview" markers on all decorative mocks; initials-only community mock; narrative + copy under test.
5. **Community (§22): PARTIALLY MET (Mission 5).** Discover-centric feeds, six content types, save/report, moderation states, initials-only identity, and academic-data isolation are done and tested (256 total green). Remaining: university/course *communities* and *study groups* as first-class entities (subsequent increment), and applying the additive `community_*` schema migration to the hosted project to activate discovery reads there.
6. **Grades (§15): MET (Mission 6).** Matrícula de Honor 10.0 is its own band (amber "Honors" label on the GPA card + per-course `MH` chip), layered in `src/lib/gradesim.js` on top of the pinned engine (which still owns 9.x–"Outstanding" and below); 0–10 clamping and ECTS weighted average verified by tests (236 total green).
7. **Empty/loading/error states (§27–29): MET (Mission 7, 2026-09).** New `ErrorState` (what happened / what's preserved / what to do + Retry → `refresh()`), `PageSkeleton`, and `ErrorBoundary` primitives; boundary wired at app root and inside AppShell around the route outlet (keyed by pathname so a caught render error clears on navigation). All 17 `useUserData` pages now render an error gate with retry after their hooks and before their loading/empty branches; per-module explainer empty states + skeletons were previously in place.
8. **Accessibility (§24) / responsive (§25): MET-pass for audit items (Mission 8, 2026-09).** Icon-only buttons across the app now carry `aria-label`s (NoteDetail, Goals, Habits, Schedule nav, Courses import, Tasks/Exams/CourseDetail toggles, PostCard like, ICSFeedDialog close, AIAssistant send, AppShell mobile controls + FAB); nav has `aria-current="page"`; StickyNoteCard edit is keyboard-operable (`tabIndex` + Enter/Space); unbound labels wired in Focus, Grades sim selects, Settings Language, Profile, Onboarding, QuickAdd (`Field` injects accessible names onto inputs and Radix `SelectTrigger`s), Notes/Community search, StickyWall, CommandPalette, NoteDetail, Courses import/sort, Exams mastery; `aria-live="polite"` on AI "Thinking…", CommandPalette no-results, Courses import warnings, WeekView/DayView conflict banners; reduced motion honored app-wide via `<MotionConfig reducedMotion="user">` + a `prefers-reduced-motion` CSS guard. Layout is already responsive (bottom nav, stacked grids, drawer) with no horizontal overflow observed at the source level. Full keyboard/focus-visual pass remains a manual browser step.
9. **Cleanup (§31):** `export-report.json` (stale Base44 export diagnostic) and `coverage/` were gitignored in this checkpoint; `src/api/` no longer exists. Runtime verification screenshots of demo/verification data not possible here.
10. **Plans (§30):** static pricing, PRO/ULTRA "Join Waitlist" disabled buttons (honest, but dead end). Stripe packages were unused and removed in Mission 9.

## Do NOT touch (verified working / pinned)

- `src/lib/*Engine.js` + their `.test.js` (AGENTS.md pin).
- `useUserData` public surface (`data./refresh/mutate`); the Supabase-mode fetch+retry+realtime behavior is preserved exactly (guards rate limits). Local branch added by adapter.
- `ProtectedRoute` / `UserNotRegisteredError` / `authReturnTo` flows.
- Auth pages + OTP + Google sign-in + reset-password token flow.
- Theme/accent system, `useDeskMode`, `useSoundscape`.
- shadcn/ui primitives consumption.
- Supabase schema / Edge Functions contracts (change only with matching stack changes).