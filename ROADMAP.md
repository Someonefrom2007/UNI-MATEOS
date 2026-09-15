# UNI·MATE — ROADMAP (atomic missions)

Status legend: `[ ]` backlog · `[~]` in progress · `[x]` done. One mission = one controlled change with its own verification. Order is dependency-driven: data layer first, brand/Landing next, then surface polish. Each mission records evidence at the bottom of its entry.

## Mission 0 — Baseline & checkpoint
- [x] Repository inspection, baseline gates (typecheck 0 / tests 173 / lint 0 / build OK), CURRENT_STATE/TECH_DECISIONS/ROADMAP created, git initialized, baseline commit `25a7fb3`.

---

## Phase A — Foundations

### Mission 1 — Local-first data layer (repository + local adapter) — DONE
- **Objective (§5/§6/§7):** App runs with zero backend (no Supabase env) and survives refresh/restart. Repository interface + local persistence adapter with a Supabase-shaped contract; UI (`useUserData` surface) unchanged.
- **Scope:** new `src/lib/repo/` (interface, local adapter over injectable storage, id/timestamp/ownership helpers); `useUserData` surface stays; `supabase.js` keeps working when env present (adapter selection by env availability).
- **Files:** `src/lib/repo/{storage,localRepo,select}.js`, `src/lib/useUserData.js` (assembly only), `AuthContext.jsx` (local workspace), local-mode guards on auth pages/AppShell/Profile/Settings/QuickAdd/NoteDetail/Schedule/Onboarding/Community/AIAssistant/CalendarSync/ICSFeedDialog, `demoData.js`, tests `src/__tests__/localRepo.test.js`, README/CURRENT_STATE/TECH_DECISIONS updated.
- **Evidence:** typecheck 0 · lint 0 · tests 15 files / 189 pass (16 new: storage namespacing/round-trip, localRepo CRUD contract, uuid/timestamp/ownership injection, adapter selection via env stubs, on-device profile round-trip, demoData local seeding with FK integrity) · build ✅ (52 precache entries, 1281.62 KiB). Acceptance for browser: `npm run dev` with NO env renders + CRUDs locally and survives reload (asserted by tests; live-browser check still pending in this environment).
- **Decision noted:** adapter chosen by env at startup — Supabase env present → hosted path (today's behavior, hosted data preserved); env absent → local workspace.

### Mission 1.5 — Compressed on-device storage — DONE
- **Objective:** keep local persistence small and compatible. Transparent compressed storage adapter; unmarked values (legacy data) pass through verbatim; a stored value is never larger than the input.
- **Files:** `src/lib/dataCompressor.js` (LZ string layer, gzip wrappers with fallback, schema minify/expand), `src/lib/repo/storage.js` (default adapter now wraps compression), `src/__tests__/dataCompressor.test.js`. Handoff fixes: `String()` coercion for the decompressor dictionary lookup (checkJs `string|number`), test aligned to `localRepo.delete`.
- **Evidence:** typecheck 0 · lint 0 · tests 16 files / 215 pass · build ✅ (cd `61b52cb`). Pre-existing (inherited): repo typecheck/test were red on arrival; documented and fixed in this mission.

### Mission 2 — Supabase-ready repository adapter (not wired, tested interface) — DONE
- **Objective (§6):** Prove a future backend can sit under the same interface without UI rewrites.
- **Scope:** `createSupabaseRepo()` implementing the interface against current tables when env present; feature/branch toggle, NOT default yet; adapter contract tests with mocked supabase client.
- **Files:** `src/lib/repo/supabaseRepo.js` (new adapter — same surface as `localRepo`: `list/create/update/delete/deleteWhere`; async against a Supabase client, snake_cases incoming keys and injects id/user_id/created_at/updated_at identically to LocalRepo; `update` returns null on a missing row; `clear()` throws to prevent accidental full-table deletes), `src/__tests__/repoContract.test.js` (new shared contract suite with a chainable in-memory mock of supabase-js v2; the SAME assertions run against both the storage-backed local repo and the supabase adapter), `src/lib/repo/localRepo.js` (exported `toSnakeCase` for parity).
- **Evidence:** typecheck 0 · lint 0 · build ✅ 61 precache entries (1421.51 KiB) · tests 20 files / 273 pass (17 new contract tests: list/create/update/delete/deleteWhere identical behavior on both backends, update-missing → null, delete boolean, batch counts, supabase store persistence via the mock client, clear() refusal, deleteWhere no-op). Contract notes: `deleteWhere` translates the predicate to an `id IN (...)` delete after a fetch, so it assumes unique row ids (the local repo filters in place); `clear()` is intentionally unsupported on hosted — scoped removals via `deleteWhere`. No UI changes, adapter not the default.

---

## Phase B — Brand & surfaces

### Mission 3 — Brand asset system (§8) — DONE
- **Objective:** Centralize UNI·MATE symbol variants (primary/compact/symbol/gradient/white/black), favicon, PNG app icons, apple-touch, PWA icons, OG image, branded splash. Keep the three-layer diamond symbol.
- **Files:** `src/components/Brand/{brand.js,BrandLogo.jsx,Splash.jsx}` (new), `src/components/Logo.jsx` (delegates to BrandLogo, API unchanged), `public/icon.svg` (rebuilt to the diamond mark), `public/icons/{pwa-192x192,pwa-512x512,apple-touch-icon,og-image}.png` (sips-rasterized, pixel-verified), `public/manifest.json`, `index.html`, `vite.config.js` (PWA precache icons; og-image glob-excluded), `src/App.jsx` (Splash for route fallback + auth loading), `src/__tests__/brand.test.js`.
- **Evidence:** typecheck 0 · lint 0 · tests 17 files / 221 pass (6 new brand tests) · build ✅ 58 precache entries / 1411.86 KiB · preview-server smoke: all meta assets 200, manifest icons correct. Pixels verified programmatically (three layer colors present; OG text rendered).

### Mission 4 — Landing rebuild (§23) — DONE
- **Objective:** Cinematic sequence: Hero → Problem → UNI·MATE → Product → Academic intelligence → Study planning → Focus → Community → Privacy → Future → CTA; product interface as the hero; no invented numbers presented as real (every decorative mock is labeled "Illustrative preview").
- **Files:** `src/pages/Landing.jsx` (assembly + nav header/footer), `src/components/landing/{sections.js,Hero,Problem,Manifesto,Product,Intelligence,Planning,FocusLanding,CommunityLanding,Privacy,Future,ClosingCTA,Section}.jsx`, `src/__tests__/landingSections.test.js`. OG/twitter meta already wired in Mission 3.
- **Evidence:** typecheck 0 · lint 0 · tests 18 files / 228 pass (7 new: narrative order, unique anchors, tagline, non-empty/no-placeholder copy, illustrative marker, MH band, initials-not-photos) · build ✅ 59 precache / 1431.34 KiB · preview smoke: root 200, bundle contains all 11 section ids + marker + tagline.

---

## Phase C — Community first-class

### Mission 5 — Community module (§22) — DONE
- **Objective:** Discover-centric community: content types, university/course communities, study groups, questions, shared resources, events, announcements, comment/reaction, save, report, moderation states; multi-user-ready data model; no profile photos (initials/geometric identity); never auto-expose personal academic data.
- **Files:** `src/lib/communityData.js` (CONTENT_TYPES 6-type registry, moderation state machine, save/report helpers, decoratePosts, authorIdentity deterministic gradient, feedFilter/applyFilters/sortPosts, timeAgo — all pure), `src/__tests__/communityData.test.js` (20 tests), `src/lib/tables.js` (+CommunitySave/CommunityReport), `supabase/schema.sql` (additive Mission 5 block: community_posts.status/author_name columns + community_saves/community_reports tables + discover read policies — idempotent, pending apply to hosted), `src/pages/Community.jsx` (Discover/My/Saved feeds, 6-type chips, course filter, search, sort Newest/Top, save/report actions — LOCAL & hosted branches), `src/components/community/PostCard.jsx` (6 types via CONTENT_TYPES, deterministic gradient initials avatars, bookmark/report UI with reason chips, moderation status badge), `src/components/community/PostComposer.jsx` (6 types), `src/components/community/ReplyThread.jsx` (deduped to communityData helpers).
- **Evidence:** typecheck 0 · lint 0 · tests 19 files / 256 pass (20 new: content-type registry + fallback, moderation transitions + metadata, save toggling, report defaults, feed filters discover/mine/saved + ownership visibility, type/course/query filtering, sort by date/engagement, decoration counts/mine/liked/saved/initials, academic-data-not-leaked, legacy like row compat, timeAgo buckets) · build ✅ 1440.07 KiB.
- **Schema note:** migration is additive/idempotent; author_name + status + saves/reports + discover read policies need one-time apply to the hosted Supabase project to go live; hosted insert/update remain safe pre-migration (the UI omits status/author_name in hosted mode until the columns exist).

---

## Phase D — Product quality sweeps

### Mission 6 — Grades Matrícula de Honor (§15) — DONE
- Add the 10.0/custom-distinction band + label rendering (engine + UI + tests). Verify 0–10 clamping and ECTS weighted average with tests.
- **Files:** `src/lib/gradesim.js` (new `MATRICULA_DE_HONOR` band + `gradeBandExtended` delegating <10 to the pinned `gradeBand`; pinned `gradeEngine.js` untouched), `src/pages/Grades.jsx` (GPA card band label via extended lookup; amber 10.0 + `MH` chip on course "Current" cells), `src/__tests__/gpaSimulator.test.js` (8 new tests).
- **Evidence:** typecheck 0 · lint 0 · tests 18 files / 236 pass (8 new: 10.0→Matrícula de Honor, 9.x stays Outstanding, engine band delegation 0–9.999, null/NaN null, clamped 11.7→MH, full 0–10 five-band coverage, ECTS weighted average = Σ(g·e)/Σ(e), clamped average within 0–10) · build pending final commit.

### Mission 7 — Empty / loading / error states (§27–29) — DONE
- Every module: explainer empty state + CTA; polished skeletons; user-facing error copy (what happened / what preserved / what to do). Audit each page.
- **Files:** `src/components/{ErrorBoundary,ErrorState,PageSkeleton}.jsx` (new primitives), `src/App.jsx` (root-level `ErrorBoundary` around `AuthenticatedApp`), `src/components/AppShell.jsx` (outlet-level `ErrorBoundary` keyed by pathname so a caught render error clears on navigation), and the 17 `useUserData` pages — `AIAssistant`, `CourseDetail`, `Courses`, `Dashboard`, `Exams`, `Focus`, `Goals`, `Grades`, `Habits`, `Insights`, `NoteDetail`, `Notes`, `Resources`, `Schedule`, `StickyWall`, `Tasks`, `Workload` — each gained `if (error) return <ErrorState onRetry={refresh} />` placed after all hooks and before their loading/empty branches. Existing per-module explainer empties + loading skeletons were already present and kept.
- **Evidence:** typecheck 0 · lint 0 · tests 19 files / 256 pass · build ✅ 58 precache entries / 1442.97 KiB. Error copy follows the directive shape (what happened / what's preserved / what to do) with a working Retry wired to `refresh()`; unexpected render errors are caught at root + outlet level so one broken screen can't take down the app.

### Mission 8 — Accessibility & responsive (§24–§25) — DONE
- Semantic + keyboard + visible focus + labels + contrast + reduced-motion + touch targets; tablet/mobile recomposition; no horizontal overflow. Hand-audit + targeted tests.
- **Files:** audited every page/component; `src/App.jsx` wraps the tree in `<MotionConfig reducedMotion="user">` (JS-driven framer-motion) + `src/index.css` media query kills CSS animations/transitions under `prefers-reduced-motion: reduce`. AppShell: `aria-current="page"` on desktop/mobile nav, aria-labels on mobile search/quick-add/menu/FAB/close, drawer backdrop `aria-hidden`. StickyNoteCard: click-to-edit now a keyboard-operable `tabIndex={0}` button (`role="button"` + Enter/Space). Accessible names (aria-label / htmlFor+id) on icon-only buttons across NoteDetail, Goals, Habits, Schedule, Courses, Tasks, Exams, CourseDetail, PostCard, ICSFeedDialog, AIAssistant, Focus, Grades (sim selects), Settings/Profile/Onboarding (unbound labels), CommandPalette, Notes, Community, StickyWall, NoteDetail, Courses import + sort; `QuickAdd.jsx` `Field` now injects accessible names onto inputs and Radix `SelectTrigger`s for every form control. Live regions (`aria-live="polite"`) on AI "Thinking…", CommandPalette no-results, Courses import warnings, WeekView/DayView conflict banners.
- **Evidence:** typecheck 0 · lint 0 · tests 19 files / 256 pass · build ✅ 58 precache entries / 1445.85 KiB. Full-page keyboard pass is still a manual browser step (focus-visible ring + nav order) — no regressions in gates; components with `useReducedMotion` (Hero, Splash, ClosingCTA, Reveal, AppShell) keep working, and the global MotionConfig now lowers the rest.

### Mission 9 — Cleanup pass (§31 / §30) — DONE
- Remove verification/demo artifacts, dead buttons, unused deps flagged by audit (Stripe ×2 unless monetization lands, unused ui primitives), console noise, broken links, `export-report.json` (gitignored) removal, `CLAUDE.md` staleness check.
- **Files:** removed unused deps (29 packages: `@stripe/react-stripe-js`, `@stripe/stripe-js`, `three`, `react-leaflet`, `html2canvas`, `jspdf`, `moment`, `@hello-pangea/dnd`, `canvas-confetti`, `cmdk`, `embla-carousel-react`, `input-otp`, `lodash`, `next-themes`, `react-day-picker`, `react-hook-form`, `react-hot-toast`, `react-markdown`, `react-resizable-panels`, `recharts`, `sonner`, `vaul`, `@hookform/resolvers`, `zod`, `date-fns`, `@radix-ui/react-{accordion,alert-dialog,aspect-ratio,avatar,checkbox,collapsible,context-menu,dropdown-menu,hover-card,menubar,navigation-menu,popover,progress,radio-group,scroll-area,switch,toggle-group}`, `nitro`, `baseline-browser-mapping`) — each verified unreferenced in source before removal; deleted 35 unused `src/components/ui/*` primitives (accordion, alert, alert-dialog, aspect-ratio, avatar, badge, breadcrumb, calendar, carousel, chart, checkbox, collapsible, command, context-menu, drawer, dropdown-menu, form, hover-card, image, input-otp, menubar, navigation-menu, pagination, popover, progress, radio-group, resizable, responsive-image, scroll-area, sidebar, sonner, switch, table, toggle-group, use-responsive-image) — each verified to have zero external imports and no kept-primitive dependency; removed a leftover `console.debug` in Dashboard's demo-loader (`src/pages/Dashboard.jsx`). `CLAUDE.md` is a thin pointer to `AGENTS.md` (not stale); `export-report.json` and `coverage/` remain gitignored.
- **Evidence:** typecheck 0 · lint 0 · tests 19 files / 256 pass · build ✅ 58 precache entries / 1419.09 KiB (down from 1445.85 KiB at M8). Stale `recharts`-fed charts were not in use (no source imports), so no UI regressions; the >500 kB main chunk warning persists for Mission 10.

### Mission 10 — Performance pass (§26 / §11) — DONE
- Chunk-split audit (route lazy already present), re-render/memo audit on Dashboard/Schedule/Community, offscreen modernize to remove the >500 kB warning or justify, NetworkFirst cache hardening.
- **Files:** `vite.config.js` — Rolldown `manualChunks` function splits stable vendors into cached groups: `vendor-react` (react, react-dom, react-router), `vendor-data` (@supabase/supabase-js + @tanstack/react-query), `vendor-anim` (framer-motion). Route-level `React.lazy` was already in place; PWA already used NetworkFirst for `*.supabase.co` with a 5 s network timeout + 64-entry/24 h cache.
- **Effect (build-measured):** main entry chunk **584.10 kB → 182.19 kB**; the rolldown >500 kB warning is gone. Largest remaining file is `NoteDetail` at 209.71 kB (react-quill editor — lazy-loaded only when a note is opened) and `vendor-data` 247.89 kB (cacheable, shared). Vendor splits keep app-only chunks stable across dependency bumps (offline-friendly cache invalidation).
- **Memo audit note:** Dashboard/Schedule/Community already derive their lists via pure helpers + `useMemo` (spot-checked: `WeekView`/`DayView` conflicts, Dashboard card assembly, Community feed filtering). A per-component `React.memo` sweep without a browser profiler risks stale-render regressions and can't be measured in this environment — documented leftover for the manual browser pass rather than applied blind.
- **Evidence:** typecheck 0 · lint 0 · tests 19 files / 256 pass · build ✅ 61 precache entries / 1421.51 KiB, no >500 kB chunk warning.

---

## Cross-cutting reminders
- Every mission: TYPECHECK → TEST → LINT → BUILD, then record evidence here.
- Never modify pinned engines or their tests. Never commit `.env.local` or new secrets. Keep changes recoverable (git checkpoint per mission).
- Runtime verification is not available in this environment; use the documented gates + targeted test additions as evidence, and call out where browser verification is still needed.