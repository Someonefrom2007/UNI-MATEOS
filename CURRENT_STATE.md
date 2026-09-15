# UNI·MATE — CURRENT STATE

Evidence-based snapshot from repository inspection + green-gate baseline (2026-09-15, cd `61b52cb`). Do not treat this file as a spec — it records what actually exists.

## Baseline verification (all green)

| Gate | Command | Result |
|---|---|---|
| Typecheck | `npm run typecheck` (tsc -p ./jsconfig.json, checkJs) | ✅ 0 errors |
| Tests | `npm test` (vitest run) | ✅ 17 files / 221 tests pass |
| Lint | `npm run lint` (eslint . --quiet) | ✅ 0 errors |
| Build | `npm run build` | ✅ PASS — PWA sw.js generated, 58 precache entries (1411.86 KiB) |

Runtime/browser verification is NOT available in this environment — evidence is compile + test + build.

## Stack (verified in package.json / configs)

- React 18 + Vite 8 (rolldown) + Tailwind CSS 3 + shadcn/ui (New-York `.jsx`, `tsx:false`)
- `react-router-dom` 6 (BrowserRouter, route-level `React.lazy` splitting in `src/App.jsx`)
- `@tanstack/react-query` (QueryClient, no queries used yet — infra only) + `framer-motion` (motion primitives + AppShell page transitions)
- `lucide-react`, `cmdk`, `vaul`, `canvas-confetti`, `react-quill-new` (notes), `recharts`, `@hello-pangea/dnd`, `three`, `jspdf`/`html2canvas` (installed)
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
- Single-page module (`src/pages/Community.jsx`): composer + post feed (question/tip/win/resource), replies, likes, delete-own-post. No profile photos — single-letter initials on gradient circles.
- Direct Supabase queries on `community_posts`, `community_replies`, `community_likes` (+ `courses`). `mapRow` derives `created_by` from the current user's email — origins/ownership display is render-time only.
- No Discover/tabs, no university/course communities, no study groups, no events/announcements, no saved content, no reporting/moderation states. NOT multi-user ready in schema (verify RLS scope of `community_*` in schema.sql).

### Landing (current)
- `Landing.jsx` = sticky header + `Hero` + `Features` + `ClosingCTA` (linear, one feature section). Below the 2.0 narrative (Hero→Problem→UNI·MATE→Product→Academic intelligence→Study planning→Focus→Community→Privacy→Future→CTA).
- Landing preview/mock widgets in Hero/Features are decorative static numbers (real-data claims not backed).

## What actually works (best-effort, static evidence)

- **All core academic modules** render CRUD against `useUserData`/Supabase: Courses(+CourseDetail), Schedule (Day/Week/Month + course colors + conflict warnings + ICS feed dialog + Google Calendar connector `check`), Tasks (deadline/priority/course/duration/subtasks ui), Exams, Grades (0–10 bands + ECTS weighted average + required/projected grade), Notes (quill rich text), Resources, Focus (pomodoro modes + persisted sessions), Goals/Habits (+ logs/streaks), Workload, Insights, Sticky Wall.
- **Dashboard** — real-data bento (Spotlight, TodayTimeline, Attention, Pulse, Focus, Workload, Velocity, Habits/Goals/Insights cards, sticky tile). No invented numbers.
- **AI Assistant** — real backend Edge Function `ai-assistant` (deterministic fallback without OPENAI_API_KEY; no fake AI).
- **PWA** — `vite-plugin-pwa` `generateSW`, offline fallback + denylist (auth/api/.ics), runtime NetworkFirst cache for `*.supabase.co`.
- **Design language** already leans "student's mind, visualized" (cyber-grid scanlines, bento desk, reveal motion, atmospheric blur, Hud mono labels, dark-first).

## Gaps vs the 2.0 directive (evidence-based)

1. **Local-first (directive §6/§7): MET (Mission 1, 2026-09).** App runs with zero backend and data survives refresh/restart: repository interface + local adapter (`src/lib/repo/`), env-based adapter selection, local workspace mode (auto-auth, no accounts), 16 new tests (189 total green). Remaining: Supabase adapter under the same interface (Mission 2), local→cloud push UX.
2. **Repository/service interface (§6/§5): present for persistence.** UI → `useUserData` stable surface → `src/lib/repo/*`. Direct `supabase` calls outside the data hook remain in some components (guarded per-mode); consolidating them under the interface is Mission 2 scope.
3. **Brand variants (§8): DONE (Mission 3).** Centralized `src/components/Brand/*`; six symbol/wordmark variants; favicon, PNG app icons, apple-touch, OG image, PWA icons, branded splash all wired (see Brand assets). Brand consistency test suite added (6 tests).
4. **Landing (§23): sparse** (3-section linear, mock numbers).
5. **Community (§22): basic single-feed**; no Discover/groups/events/announcements/moderation/saved; origins not multi-user-ready.
6. **Grades (§15):** bands stop at "Sobresaliente" (Outstanding) — no "Matrícula de Honor" / custom-distinction band; 10.0 max only.
7. **Empty/loading/error states (§27–29):** spotty across modules (only Dashboard skeleton + Community empty state verified).
8. **Cleanup (§31):** `export-report.json` (stale Base44 export diagnostic) and `coverage/` were gitignored in this checkpoint; `src/api/` no longer exists. Runtime verification screenshots of demo/verification data not possible here.
9. **Plans (§30):** static pricing, PRO/ULTRA "Join Waitlist" disabled buttons (honest, but dead end). Stripe packages installed but unused.

## Do NOT touch (verified working / pinned)

- `src/lib/*Engine.js` + their `.test.js` (AGENTS.md pin).
- `useUserData` public surface (`data./refresh/mutate`); the Supabase-mode fetch+retry+realtime behavior is preserved exactly (guards rate limits). Local branch added by adapter.
- `ProtectedRoute` / `UserNotRegisteredError` / `authReturnTo` flows.
- Auth pages + OTP + Google sign-in + reset-password token flow.
- Theme/accent system, `useDeskMode`, `useSoundscape`.
- shadcn/ui primitives consumption.
- Supabase schema / Edge Functions contracts (change only with matching stack changes).