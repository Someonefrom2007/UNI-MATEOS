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

### Mission 2 — Supabase-ready repository adapter (not wired, tested interface)
- **Objective (§6):** Prove a future backend can sit under the same interface without UI rewrites.
- **Scope:** `createSupabaseRepo()` implementing the interface against current tables when env present; feature/branch toggle, NOT default yet; adapter contract tests with mocked supabase client.
- **Acceptance:** both adapters pass the same contract suite; no UI changes.

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

### Mission 5 — Community module (§22)
- **Objective:** Discover-centric community: content types, university/course communities, study groups, questions, shared resources, events, announcements, comment/reaction, save, report, moderation states; multi-user-ready data model; no profile photos (initials/geometric identity); never auto-expose personal academic data.
- **Files:** schema additions (`community_*`), `src/pages/Community.jsx`, `src/components/community/*`, repo adapter methods, tests at engine/component level.

---

## Phase D — Product quality sweeps

### Mission 6 — Grades Matrícula de Honor (§15)
- Add the 10.0/custom-distinction band + label rendering (engine + UI + tests). Verify 0–10 clamping and ECTS weighted average with tests.

### Mission 7 — Empty / loading / error states (§27–29)
- Every module: explainer empty state + CTA; polished skeletons; user-facing error copy (what happened / what preserved / what to do). Audit each page.

### Mission 8 — Accessibility & responsive (§24–§25)
- Semantic + keyboard + visible focus + labels + contrast + reduced-motion + touch targets; tablet/mobile recomposition; no horizontal overflow. Hand-audit + targeted tests.

### Mission 9 — Cleanup pass (§31 / §30)
- Remove verification/demo artifacts, dead buttons, unused deps flagged by audit (Stripe ×2 unless monetization lands, unused ui primitives), console noise, broken links, `export-report.json` (gitignored) removal, `CLAUDE.md` staleness check.

### Mission 10 — Performance pass (§26 / §11)
- Chunk-split audit (route lazy already present), re-render/memo audit on Dashboard/Schedule/Community, offscreen modernize to remove the >500 kB warning or justify, NetworkFirst cache hardening.

---

## Cross-cutting reminders
- Every mission: TYPECHECK → TEST → LINT → BUILD, then record evidence here.
- Never modify pinned engines or their tests. Never commit `.env.local` or new secrets. Keep changes recoverable (git checkpoint per mission).
- Runtime verification is not available in this environment; use the documented gates + targeted test additions as evidence, and call out where browser verification is still needed.