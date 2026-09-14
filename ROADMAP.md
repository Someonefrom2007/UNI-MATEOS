# UNI·MATE — ROADMAP (atomic missions)

Status legend: `[ ]` backlog · `[~]` in progress · `[x]` done. One mission = one controlled change with its own verification. Order is dependency-driven: data layer first, brand/Landing next, then surface polish. Each mission records evidence at the bottom of its entry.

## Mission 0 — Baseline & checkpoint
- [x] Repository inspection, baseline gates (typecheck 0 / tests 173 / lint 0 / build OK), CURRENT_STATE/TECH_DECISIONS/ROADMAP created, git initialized, baseline commit `25a7fb3`.

---

## Phase A — Foundations

### Mission 1 — Local-first data layer (repository + local adapter)
- **Objective (§5/§6/§7):** App runs with zero backend (no Supabase env) and survives refresh/restart. Introduce repository interface + local persistence adapter with a Supabase-shaped contract; UI (`useUserData` surface) unchanged.
- **Scope:** new `src/lib/repo/` (interface, local adapter over injectable storage, id/timestamp/ownership helpers, migrations/versioning); `useUserData.surface` stays; `supabase.js` keeps working when env present (adapter selection by env availability).
- **Files:** `src/lib/repo/*`, `src/lib/useUserData.js` (assembly only), tests `src/__tests__/repo*.test.js`, `README`/`.env.example` notes.
- **Acceptance:** `npm run dev` with NO env renders + CRUDs fully locally; data survives reload (tests assert storage round-trip + deterministic ids + timestamps); existing 173 tests still green; UI identical.

### Mission 2 — Supabase-ready repository adapter (not wired, tested interface)
- **Objective (§6):** Prove a future backend can sit under the same interface without UI rewrites.
- **Scope:** `createSupabaseRepo()` implementing the interface against current tables when env present; feature/branch toggle, NOT default yet; adapter contract tests with mocked supabase client.
- **Acceptance:** both adapters pass the same contract suite; no UI changes.

---

## Phase B — Brand & surfaces

### Mission 3 — Brand asset system (§8)
- **Objective:** Centralize UNI·MATE symbol variants: primary, compact, symbol-only, gradient symbol, white, black; export favicon/app-icon/OG/splash assets; keep three-layer diamond symbol.
- **Files:** `src/components/Brand/*`, `public/*` icons/og.png/splash, `index.html` heads, `manifest.json`, tests for exported constants/alt text.

### Mission 4 — Landing rebuild (§23)
- **Objective:** Cinematic sequence: Hero → Problem → UNI·MATE → Product → Academic intelligence → Study planning → Focus → Community → Privacy → Future → CTA; real dashboards/product visuals as the hero; no invented numbers (illustrative mockups clearly marked or removed).
- **Files:** `src/pages/Landing.jsx`, `src/components/landing/*`, `index.html` OG/meta.

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