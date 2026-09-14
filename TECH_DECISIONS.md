# UNI·MATE — TECH DECISIONS

Decisions that govern all 2.0 work. Order = hierarchy. Revisit only with evidence.

## 1. Stability chain
`STABILITY > CORRECTNESS > PRODUCT QUALITY > SCOPE > SPEED`
Focused change over rewrite. Never claim done without verification (typecheck/test/lint/build + affected-flow reasoning).

## 2. Pinned engines
`src/lib/*Engine.js` (grade, schedule, workload, insights, burnout, calendarSync) and their `.test.js` are immutable. New behavior never edits them; it is layered on top (existing pattern: `gradesim.js` importing + extending, `planner.js` wrapping scheduleEngine read-only).

## 3. Data architecture (local-first, backend-ready)
- **Local-first now (§6/§7 of directive).** The free product must run without any hosted backend. All data survives refresh/restart/navigation.
- Layering: `UI → useUserData (stable public surface) → repository/adapters → persistence`.
- A repository interface abstracts the store: one adapter today (local), a future Supabase adapter behind the same interface. UI must never be rewritten when the backend arrives.
- Records carry the fields Supabase migration needs: stable UUID `id`, `created_at`, `updated_at`, `user_id` (ownership), `deleted_at`/archived flags (soft delete) — even in local mode.
- IDs: `crypto.randomUUID()` with fallback (deterministic injection for tests). No auto-increment leaks, no doc IDs usable across backends.
- Real/fake boundary: a local row is always local; a synced row is only ever called synced when a real adapter confirms it. Never fabricate sync states.
- Migration path: local → (optional) push existing rows to Supabase via an adapter; RLS per user; never service-role creds in client code.
- **Adapter selection (Mission 1, realized 2026-09):** environment-based at startup — `hasSupabaseEnv()` true → hosted backend unchanged; false → local workspace. No runtime flip-flop (`isLocalWorkspace()` is module-constant). Local storage: browser `localStorage` under `unimate:v1:` prefix via an injectable KV (`src/lib/repo/storage.js`); memory fallback keeps the contract testable in node (vitest). `getDefaultStorage()` is a memoized singleton so all repo consumers share one backend even if localStorage is blocked. Local profile persisted under the same namespace (`src/lib/repo/select.js`).

## 4. Grading rules (§15)
Grades are 0.00–10.00 floats. Bands: <5.0 Fail (Suspenso), 5.0–6.9 Pass (Aprobado), 7.0–8.9 Notable, 9.0–9.9 Outstanding (Sobresaliente), 10.0/custom distinction = Matrícula de Honor. Aggregate = `sum(grade × ects)/sum(ects)` (ECTS weighted). All calculations stay in `gradeEngine.js`/`gradesim.js` and are test-verified; UI bands render constants from the engine.

## 5. Brand (§8)
Official: **UNI·MATE**, tagline "Your university, organized around you." Approved symbol = the three stacked translucent diamond layers in `Logo.jsx`. Centralize all variants (primary/compact/symbol/gradient symbol/white/black/favicon/app icon/PWA/OG/splash) in one branded module + exported assets. No alternate symbols, no redesign, no profile photos anywhere (initials / geometric identity / UNI·MATE avatar only — for humans and community both).

## 6. No fake functionality (§30)
Every rendered value is either real data or clearly marked demo/mock/future. Dead buttons are disabled with an honest "coming" affordance or removed. Decorative landing numbers must be visually identified as illustrative, or removed.

## 7. Dependency & tooling freeze (§34)
npm is the package manager. No major framework version bumps (React 18, Vite 8, Tailwind 3 stay). Add a dependency only if existing code can't solve it — then document why + bundle impact. `npm run typecheck | lint | test | build` are the gates. Test env stays `node` (vitest) unless a mission specifically requires jsdom.

## 8. Secrets & config (§35)
`.env.local` is real and used locally; it is gitignored and must never be committed. `.env.example` keeps the same key names, placeholder values. Edge Function secrets (`OPENAI_API_KEY`) live server-side only.

## 9. Community multi-user readiness (§22)
Community data model must be designed (schema + repository interface) for future multi-user Supabase operation: university membership, course membership, moderation states, reporting, saved content — but **never expose personal academic data automatically**. Rendering shows initials/geometric identity, never photos.

## 10. Performance budget (§26)
Keep route-level splitting; avoid bundle regression beyond baseline (current gate: build completes; watch the single large JS chunk). No excessive blur/animation; respect `prefers-reduced-motion` (existing `useReducedMotion` pattern). WOW must not cost performance.

## 11. Error communication (§29)
Never surface raw technical errors. Messages state: what happened, what was preserved, what to do. Errors applied to a toast/inline UI, not console dumps in user-visible paths.

## 12. Atomic missions (§32–33)
Work ships as one mission at a time: OBJECTIVE / SCOPE / FILES / IMPLEMENTATION / TESTS / ACCEPTANCE. Each ends with typecheck+test+lint+build. Error budget: 1 failure → investigate; 2 related → reduce scope; 3+ cascading → STOP and report.