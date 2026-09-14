# UNI·MATE — CURRENT STATE

Evidence-based snapshot from repository inspection + green-gate baseline (2026-09-14, cd `25a7fb3`). Do not treat this file as a spec — it records what actually exists.

## Baseline verification (all green)

| Gate | Command | Result |
|---|---|---|
| Typecheck | `npm run typecheck` (tsc -p ./jsconfig.json, checkJs) | ✅ 0 errors |
| Tests | `npm test` (vitest run) | ✅ 14 files / 173 tests pass |
| Lint | `npm run lint` (eslint . --quiet) | ✅ 0 errors |
| Build | `npm run build` | ✅ PASS — PWA sw.js generated, 51 precache entries (1274.66 KiB). Pre-existing >500 kB chunk warning only |

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
- **Data layer:** `src/lib/useUserData.js` — single hook loading 14 entities (`Course, ScheduleEvent, Task, Exam, Grade, Note, Resource, FocusSession, Goal, Habit, HabitLog, Project, Attendance, StickyNote`); supabase `select("*")`; per-entity failure isolation + 1 retry pass; realtime via `postgres_changes` on 6 tables (whitelist: tasks, courses, focus_sessions, exams, habit_logs, sticky_notes) → full reload. API surface: `data.<Entity>`, `refresh`, `mutate(entity, op, ...args)`.
- **Entity→table map:** `src/lib/tables.js` (`TABLE`, `getTable`).
- **Auth:** `src/lib/AuthContext.jsx` (Supabase auth — email+password, Google, OTP, reset; `onAuthStateChange`; app-user shape flattens `user_metadata`). `ProtectedRoute`/`UserNotRegisteredError` for the not-registered case. `authReturnTo.js` (`authReturnTo`) guards post-login redirect (same-origin).
- **Computation engines (pinned, do not modify):** `gradeEngine.js`, `scheduleEngine.js`, `workloadEngine.js`, `insightsEngine.js`, `burnout.js`, `calendarSync.js` (+ existing `.test.js` files).
- **New tested pure modules (added for the test suite):** `triage.js`, `planner.js`, `paletteSearch.js`, `syllabusImporter.js`, `gradesim.js`.
- **Theme/i18n:** CSS-variable theme + accent presets (`theme.js`, `initTheme`, `um-` vars), `i18n.js` en|ca|es (CustomEvent store), `useDeskMode` (desk chaos/tidy), `useSoundscape`.

### Brand assets (current)
- `src/components/Logo.jsx` — three stacked translucent diamond layers (cyan→blue→indigo), inline SVG, `size`, `showText`, `subtext` props. Single component; no gradient symbol / white / black / compact variants yet.
- `public/icon.svg` — exists (referenced by index.html favicon, apple-touch-icon, and manifest.svg entries).
- `public/manifest.json` — static manifest (name/short_name, standalone, dark colors, SVG icons only — no PNG 192/512; installability may be limited on some platforms).
- No PNG app icons, no OG image, no splash/loading screen, no favicon.ico.

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

1. **Local-first (directive §6/§7): NOT met.** All persistence is hosted-Supabase. Without `VITE_SUPABASE_*`, `supabase.js` falls back to a placeholder client → queries fail → `useUserData` returns empty arrays → the app silently renders an empty UI. No data survives offline; no local storage layer. (Silent-stub trap, flagged in PRE_LAUNCH_AUDIT.)
2. **Repository/service interface (§6/§5): not present.** UI talks to `useUserData` → tables directly; no repository abstraction a future backend could slot under.
3. **Brand variants (§8): partial.** Only primary Logo + one icon.svg.
4. **Landing (§23): sparse** (3-section linear, mock numbers).
5. **Community (§22): basic single-feed**; no Discover/groups/events/announcements/moderation/saved; origins not multi-user-ready.
6. **Grades (§15):** bands stop at "Sobresaliente" (Outstanding) — no "Matrícula de Honor" / custom-distinction band; 10.0 max only.
7. **Empty/loading/error states (§27–29):** spotty across modules (only Dashboard skeleton + Community empty state verified).
8. **Cleanup (§31):** `export-report.json` (stale Base44 export diagnostic) and `coverage/` were gitignored in this checkpoint; `src/api/` no longer exists. Runtime verification screenshots of demo/verification data not possible here.
9. **Plans (§30):** static pricing, PRO/ULTRA "Join Waitlist" disabled buttons (honest, but dead end). Stripe packages installed but unused.

## Do NOT touch (verified working / pinned)

- `src/lib/*Engine.js` + their `.test.js` (AGENTS.md pin).
- `useUserData` fetch+retry+realtime mechanics (guards rate limits).
- `ProtectedRoute` / `UserNotRegisteredError` / `authReturnTo` flows.
- Auth pages + OTP + Google sign-in + reset-password token flow.
- Theme/accent system, `useDeskMode`, `useSoundscape`.
- shadcn/ui primitives consumption.
- Supabase schema / Edge Functions contracts (change only with matching stack changes).