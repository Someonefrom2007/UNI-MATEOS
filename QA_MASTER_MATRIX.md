# UNI·MATE — QA MASTER MATRIX

Full-system inventory of everything a user can see, click, create, edit, delete, navigate to,
search, persist, reload and interact with. Built from repository audit (Phase 1–2).
**Status legend**: 🔲 unverified · ✅ verified working · ❌ broken · ⚠️ gap/partial.

Mode note: this machine runs the app in **local workspace mode** (no `VITE_SUPABASE_*` env),
i.e. auth is a synthetic `local-workspace` identity, all data persists on-device under
`unimate:v1:` and admin is a DEV-ONLY auto-granted principal. Hosted/RLS behavior is verified
by code + schema audit and the unit suite, not by live credentials.

---

## 1. PUBLIC / AUTH

| # | Feature | Route | Status | Notes |
|---|---------|-------|--------|-------|
| P01 | Landing page | `/` | 🔲 | |
| P02 | Login page | `/login` | 🔲 | local mode shows local-workspace behavior |
| P03 | Register page | `/register` | 🔲 | |
| P04 | Forgot password | `/forgot-password` | 🔲 | local mode → honest "no account" screen |
| P05 | Reset password | `/reset-password` | 🔲 | |
| P06 | Privacy page | (footer links) | 🔲 | |
| P07 | Auth redirects (unauthed → /login) | all protected routes | 🔲 | |
| P08 | Return-to after auth | authReturnTo | 🔲 | |
| P09 | 404 page | any bogus path | 🔲 | |
| P10 | Error boundary | crash route | 🔲 | |
| P11 | Loading splash | every lazy route | ✅ | PageFallback / Splash present |

## 2. STUDENT APP — ROUTES & PAGES

| # | Page | Route | Status | Key interactive surfaces |
|---|------|-------|--------|--------------------------|
| S01 | Dashboard | `/dashboard` | ✅ | hero empty-state + PulseCard CTA (course-aware, bug fixed) verified in crud.mjs |
| S02 | Courses | `/courses` | ⚠️ | read/delete + detail verified |
| S03 | Course Detail | `/courses/:id` | ✅ | opens + renders, delete leaves linked tasks unlinked |
| S04 | Schedule | `/schedule` | ✅ | renders after event add; event create via QuickAdd ⚠️ |
| S05 | Attendance | `/attendance` | 🔲 | per-course status select |
| S06 | Timeline | `/timeline` | 🔲 | |
| S07 | Tasks | `/tasks` | ✅ | complete/uncomplete round-trip persists (bug fixed in harness) |
| S08 | Exams | `/exams` | ✅ | detail + add topic via prompt + reviewed→mastery=100 |
| S09 | Grades | `/grades` | 🔲 | add grade, target slider, ECTS average display |
| S10 | Notes | `/notes` | ✅ | create, open detail, autosave, pin, rename, delete |
| S11 | Note Detail | `/notes/:id` | ✅ | Quill autosave persists (normalized `&nbsp;`), title autosave, pin, delete |
| S12 | Sticky Wall | `/stickies` | ✅ | edit/pin/delete persist (key corrected `sticky_notes`) |
| S13 | Resources | `/resources` | ⚠️ | page navigates/renders |
| S14 | Topics | `/topics` | ✅ | mastery + reviewed via slider persists |
| S15 | Focus | `/focus` | ⚠️ | recent session visible after ≥60s block |
| S16 | Goals | `/goals` | ✅ | progress +1 persists |
| S17 | Habits | `/habits` | ✅ | toggle creates/removes habit_logs rows |
| S18 | Workload | `/workload` | 🔲 | |
| S19 | Insights | `/insights` | 🔲 | |
| S20 | AI Assistant | `/ai` | 🔲 | prompt, plan gate, feature flag, unconfigured state |
| S21 | Flashcards | `/flashcards` | 🔲 | deck/card CRUD, review session |
| S22 | Study Planner | `/study-plan` | 🔲 | generate plan, materialize to schedule |
| S23 | Rescue My Week | `/rescue` | 🔲 | plan + adopt-to-schedule |
| S24 | Analytics | `/analytics` | 🔲 | |
| S25 | Community | `/community` | ✅ | post create, like/unlike rows, delete (icon-only target workaround) |
| S26 | Profile | `/profile` | 🔲 | profile form (uni/degree/year/target gpa/focus/language) |
| S27 | Settings | `/settings` | 🔲 | language, theme, notifications, backups, data |
| S28 | Plans | `/plans` | 🔲 | tier cards, upgrade (simulated in local) |
| S29 | Integrations | `/integrations` | 🔲 | Google Calendar/Drive connectors, COMING SOON state |
| S30 | Onboarding | `/onboarding` | 🔲 | |
| S31 | Command Palette | ⌘K | ✅ | Ctrl+K opens, live search, click result navigates, Esc closes (aux.mjs) |
| S32 | Quick Add | floating + button | ✅ | open Task type, empty-submit guarded (native required), cancel no-op, real create persists (aux.mjs) |
| S33 | AppShell nav | all routes | ✅ | sidebar + drawer render; no permanent admin item (founder UK is subtle — Settings card + ⌘K) |

## 3. QUICK ADD ENTITY TYPES

| # | Type | Status | Notes |
|---|------|--------|-------|
| QA01 | Task | 🔲 | status todo, priority medium |
| QA02 | Course | 🔲 | semester 1, year 2025/26, target 7, amber |
| QA03 | Exam | 🔲 | course required, type exam, topics [] |
| QA04 | Event | 🔲 | type personal, recurring false, date today |
| QA05 | Note | 🔲 | pinned false, archived false |
| QA06 | Goal | 🔲 | current 0, category academic |
| QA07 | Habit | 🔲 | daily, target 7/week |
| QA08 | Grade | 🔲 | silently defaults type "assignment", no type selector (⚠️) |
| QA09 | Resource | 🔲 | type "link" (selector offered) |
| QA10 | Topic | 🔲 | mastery 0, reviewed false |

## 4. CRUD ENTITIES

| Entity | Table (local key) | Create | Read | Update | Delete | Persist | Search | Relate |
|--------|-------------------|--------|------|--------|--------|---------|--------|--------|
| Course | courses | ⚠️ | ✅ | ⚠️ | ✅ | ✅ | 🔲 | tasks/exams/grades/notes/resources/topics |
| ScheduleEvent | schedule_events | ⚠️ | ✅ | 🔲 | 🔲 | ⚠️ | — | ICS, rescue adopt |
| Task | tasks | ⚠️ | ✅ | ✅status | 🔲missing? | ✅ | 🔲 | course, dashboard, panic |
| Exam | exams | ⚠️ | ✅ | ✅ | 🔲 | ✅ | 🔲 | course, workload, study plan |
| Grade | grades | ⚠️ | ✅ | 🔲 | 🔲 | 🔲 | — | course, grades calc, gpa |
| Note | notes | ✅ | ✅ | ✅(editor) | ✅ | ✅ | 🔲 | course/topic, palette |
| Resource | resources | ⚠️ | ✅ | 🔲 | 🔲 | ⚠️ | — | course |
| Topic | topics | ⚠️ | ✅ | ✅ | 🔲 | ⚠️ | — | course |
| FocusSession | focus_sessions | ⚠️ | ✅ | — | — | 🔲 | — | course/topic, analytics |
| Goal | goals | ⚠️ | ✅ | ✅ | 🔲 | ⚠️ | — | dashboard |
| Habit | habits | ⚠️ | ✅ | ✅ | 🔲 | ⚠️ | — | dashboard |
| HabitLog | habit_logs | ✅toggle | — | — | — | ✅ | — | habit streak |
| StickyNote | sticky_notes | ✅ | ✅ | ✅ | ✅ | ✅ | — | dashboard tile |
| Project | projects | 🔲 | 🔲 | — | — | 🔲 | — | — |
| Attendance | attendance | 🔲 | 🔲 | 🔲 | — | 🔲 | — | course |
| CommunityPost | community_posts | ⚠️ | ✅ | ⚠️ | ✅ | ✅ | 🔲 | community feed |
| CommunityReply | community_replies | 🔲 | 🔲 | — | — | 🔲 | — | post thread |
| CommunityLike | community_likes | ✅ | — | — | — | 🔲 | — | post |
| CommunitySave | community_saves | 🔲 | — | — | — | 🔲 | — | post |
| CommunityReport | community_reports | 🔲 | — | — | — | 🔲 | — | moderation |
| Community | communities | 🔲 | 🔲 | — | — | 🔲 | — | members |
| StudyGroup | study_groups | 🔲 | 🔲 | — | — | 🔲 | — | members |
| CommunityMember | community_members | 🔲 | — | — | — | 🔲 | — | joins |
| FlashcardDeck | flashcard_decks | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 | — | flashcards |
| Flashcard | flashcards | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 | — | deck/study sessions |
| StudyPlan/Item | study_plans/items | 🔲 | 🔲 | — | — | 🔲 | — | schedule |
| Subscription | subscriptions | — | 🔲 | 🔲 | — | 🔲 | — | entitlement |
| WebhookEvent | webhook_events | — | 🔲 | 🔲(replay) | — | 🔲 | — | billing |
| User | user_profiles | — | 🔲 | 🔲(status) | 🔲(phrase) | 🔲 | 🔲 | admin |
| Waitlist | waitlist | 🔲 | 🔲 | — | — | 🔲 | — | public |

Entity rows derived from `qa/e2e/crud.mjs` (102 checks, all green — includes a survive-reload sweep and
course-delete leaves-linked-task-unlinked relationship check). ⚠️ = surfaced but not fully round-trip
verified; 🔲 = not yet exercised in-browser.

## 5. ADMIN CONSOLE (/admin)

### Entry & authorization
| # | Check | Status | Notes |
|---|-------|--------|-------|
| A01 | Admin entry point in student app | ✅ | **Fixed** (founder model + subtle UK): `AdminProvider` wraps the student shell; **Founder** role seeded server-side; entry is now Settings → "Founder Console" card and ⌘K/Ctrl+K → "Founder Console" — no permanent nav item, no email gating, no second login. admin.mjs: Settings card → `/admin`, ⌘K → `/admin`, zero `/admin` links in student nav, no email leak. |
| A02 | `/admin` direct route | ✅ | renders Mission overview, no console errors |
| A03 | Local mode grants admin | ✅ | `localDevPrincipal()` → **founder**, marked DEV-ONLY/unenforced |
| A04 | Hosted non-admin blocked | ✅ (by code) | server-side RPC + admin_accounts (founder/admin/super_admin whitelist); DeniedScreen |
| A05 | Hosted unauthenticated blocked | ✅ (by code) | `getUser()` empty → denied |
| A06 | Unauthorized cannot act | 🔲 | verify per-permission page |
| A07 | Admin nav filtered by permission | ✅ (by code) | permittedSections |

### Admin sections (15)
| # | Section | Route | Permission | Status |
|---|---------|-------|------------|--------|
| A08 | Overview | `/admin/` | system.read | ✅ |
| A09 | Users | `/admin/users` | users.read | ✅ |
| A10 | Billing | `/admin/billing` | billing.read | ✅ |
| A11 | Community moderation | `/admin/community` | community.moderate | ✅ |
| A12 | Analytics | `/admin/analytics` | analytics.read | ✅ |
| A13 | AI | `/admin/ai` | ai.manage | ✅ |
| A14 | Integrations | `/admin/integrations` | system.read | ✅ |
| A15 | Feature flags | `/admin/flags` | feature_flags.manage | ✅ |
| A16 | Announcements | `/admin/announcements` | settings.manage | ✅ |
| A17 | System | `/admin/system` | system.read | ✅ |
| A18 | Errors | `/admin/errors` | system.read | ✅ |
| A19 | Security | `/admin/security` | system.read | ✅ |
| A20 | Dev | `/admin/dev` | system.manage (super only) | ✅ |
| A21 | Settings | `/admin/settings` | settings.manage | ✅ |
| A22 | Audit | `/admin/audit` | system.read | ✅ |

Section sweep: all 15 render inside the console shell (h1 + shell chrome, zero console/page/network errors) — verified by admin.mjs Phase A.

### Admin CRUD
| # | Feature | Status | Notes |
|---|---------|--------|-------|
| A23 | Announcements CRUD + live-count | ✅ | create/edit/delete persisted + audit trail (announcement.create/update/delete) — admin.mjs Phase B |
| A24 | Feature flags CRUD + toggle + env pills | ✅ | create `qa_weekend_flag` (rollout 50, disabled) + Enable/Disable round-trip — admin.mjs Phase C |
| A25 | Users search/filter/status/suspend/disable/delete (phrase) | ⚠️ | search input verified; suspend/disable/delete transitions verified via unit suite + code (admin/users) |
| A26 | Billing reconcile (read-only) + stat cards | 🔲 | |
| A27 | Webhook replay (2-step) | 🔲 | |
| A28 | Moderation (review/dismiss/hide/restore/remove) | 🔲 | remove = super_admin |
| A29 | Audit log, filter, tabs | ⚠️ | trail rows recorded + readable (Phase B); filter/tabs by code |
| A30 | Dev safe action (dev_playground flag) | 🔲 | |
| A31 | Console prefs (display name, landing) | 🔲 | localStorage unimate:admin-prefs |
| A32 | ⌘K console palette + recents | ✅ | palette opens + navigates to section (Phase F); recents by unit tests |
| A33 | Mobile drawer nav | ✅ | **Fixed**: drawer never opened (setMobileNav(false) was called during render via `onClick={closeMobile ? setMobileNav(false) : undefined}`). Now arrow-wrapped; opens/closes + back-to-student verified at 390px |

## 6. CROSS-SYSTEM

| # | Concern | Status | Notes |
|---|---------|--------|-------|
| X01 | Persistence reload (every entity) | 🔲 | |
| X02 | Rapid writes / refresh-during-save | 🔲 | |
| X03 | Empty states on every screen | 🔲 | |
| X04 | Error states + retry | 🔲 | ErrorState components exist |
| X05 | Loading states (no infinite spinner) | 🔲 | |
| X06 | Search (palette) across entities | ✅ | courses searched via palette; navigation + close verified (aux.mjs) |
| X07 | Command palette ⌘K / Ctrl+K / Esc / Enter / arrows | ✅ | Ctrl+K toggle + Esc close verified; Enter/arrows via AppShell hook + unit tests |
| X08 | i18n en/ca/es switch + no raw keys | ✅ | switch en→es→en persisted across reload; UI translated (Dashboard→Panel); no raw keys (aux.mjs) |
| X09 | Theme light/dark toggle | ✅ | Light applies `.light` + stores `um-theme=light`, survives reload (aux.mjs) |
| X10 | Responsive 390–1920px, no overflow | ✅ | 7 widths × 6 pages, zero horizontal overflow (aux.mjs) |
| X11 | Keyboard nav / focus / dialog trap | 🔲 | |
| X12 | Back/forward/history | 🔲 | |
| X13 | Google Calendar integration | 🔲 | COMING SOON (unconfigured) |
| X14 | Google Drive integration | 🔲 | COMING SOON (unconfigured) |
| X15 | Lemon Squeezy billing | 🔲 | simulated in local |
| X16 | AI assistant | 🔲 | unconfigured fallback |
| X17 | Notifications | 🔲 | |
| X18 | Supabase readiness / no client secrets | ✅ | audit: secrets server-side only |
| X19 | `.env.local` not committed | ✅ | gitignored, absent |
| X20 | No hardcoded credentials | ✅ | scan clean |

## 7. ENGINES (PINNED — DO NOT MODIFY, verify only)

gradeEngine, scheduleEngine, workloadEngine, insightsEngine, burnout, calendarSync,
attendance, focusStats, habitStats, goalStats, topicStats, nextUrgent, workloadDays.
All have unit tests. Verify results against independently computed values in the E2E pass.

## 8. TEST SUITE COVERAGE (existing unit tests — 51 files)

adminCore/Journeys/Principal/Sections · analytics · billing · brand · burnoutVelocity ·
calendarICS · commandPalette · communityData/Groups/Members · dashboardRadar · dataCompressor ·
dataImport · examIntelligence · flashcards · gpaSimulator · i18n · landingSections · localRepo ·
mutateArgs · notificationCenter · notifications · notifyPrefs · panicMode · plans · pwa ·
repoContract · repoSelect · rescuePlan · smartScheduler · stickies · studyPlan · syllabusImporter ·
useFeatureFlags · waitlist + co-located engine tests (13).

## 9. BROWSER QA INFRASTRUCTURE

Hand-rolled puppeteer-core harness in `qa/` (helpers.mjs monitors console/page/network errors),
drives the live dev server at `localhost:5130`. This matrix's E2E audit scripts live under
`qa/e2e/`. No Playwright config present; puppeteer-core is an undeclared dep.

---
_Generated from repository audit. Every row with 🔲 must be executed in a real browser before
this matrix is considered complete._