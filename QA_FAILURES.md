# UNI·MATE — QA FAILURES & FINDINGS

Every defect found during the full-system browser audit, its root cause, and disposition.
Cross-referenced from `QA_MASTER_MATRIX.md`. All fixes verified in-browser afterward.

## Fixed

### F1 · Admin area had no entry point in the student app (the reported "admin doesn't appear")
- **Symptom**: `/admin` works when typed directly, but nothing in the student app links to it.
- **Root cause**: A01 — `AdminProvider` was mounted only inside `AdminLayout` (route level); the
  student shell had no way to know the user's admin status and no authorization-aware link.
- **Fix**: `AdminProvider` now wraps the protected student shell (`src/App.jsx`). Administrators are
  recognized by the server-verified `founder`/`admin`/`super_admin` role (no email gating) and reach
  the console through **subtle entries**: Settings → "Founder Console" card and ⌘K/Ctrl+K →
  "Founder Console". The student app's primary nav has no permanent admin item.
- **Verified**: `admin.mjs` — Settings card → `/admin`, ⌘K → `/admin`, zero `/admin` links in the
  student nav, no email exposure, console shows the "Founder" identity.

### F2 · Admin mobile drawer never opened (admin shell hamburger did nothing)
- **Symptom**: clicking "Open menu" at 390/640/768 px produced zero visible effect, headed + headless,
  dev server and production build alike.
- **Root cause**: A33 — `src/components/admin/AdminShell.jsx`:
  `onClick={closeMobile ? setMobileNav(false) : undefined}` **calls** `setMobileNav(false)` during
  render the moment the drawer's nav renders (it should pass a handler). The drawer mounted then
  immediately unmounted in the same frame; React state re-rendered back to `false`, so the real DOM
  never showed it and no update ever landed on the visible fiber.
- **Fix**: arrow-wrapped to `onClick={closeMobile ? () => setMobileNav(false) : undefined}`.
- **Verified**: open / stays open / close-button / re-open / back-to-student navigation at 390 px in
  dev and in the production build; also reduced a React "cannot update during render" hazard.

### F3 · PulseCard showed "Add your first course" when courses already existed
- **Symptom**: Dashboard PulseCard CTA was wrong whenever `!hasGrades` — even with courses present.
- **Root cause**: `PulseCard` decided the CTA purely on grades; Dashboard did not tell it whether
  courses existed (`src/components/dashboard/PulseCard.jsx`, `src/pages/Dashboard.jsx`).
- **Fix**: Dashboard passes `hasCourses={d.courses.length > 0}`; PulseCard now offers **"Log a grade"**
  → `/grades` when courses exist, else **"Add your first course"** → `/courses`.
- **Verified**: crud.mjs dashboard checks (empty-state hero + PulseCard CTA) — 102/102 green.

### F4 · E2E harness FATAL: `ProtocolError: Runtime.callFunctionOn timed out` (test-infra, not product)
- **Root cause**: "Delete note" opens a native `confirm()` that blocks the JS thread; `allowDialogs`
  (confirm overrides) is wiped by every full page load, so later CDP calls hung.
- **Fix**: `nav()` wrapper re-applies `allowDialogs` after every goto; all navigations go through it.

## Known / accepted (documented, not product defects)

- **Community post delete control (a11y)**: the delete button is icon-only with an **empty accessible
  name** until a second click arms the `"Delete?"` confirmation (`PostCard`). Recommend a persistent
  `aria-label` (e.g. "Delete post"). Behavior is correct; the label is missing for AT users.
- **Admin edit/delete icon-only two-step interactions** mirror the above pattern (label appears after
  the icon is clicked once) — audited through the two-step flow in `admin.mjs`.

## Harness/data-layer corrections (no product change)

- Sticky wall local key was read as `stickies` — corrected to `sticky_notes` everywhere.
- Task "completed" view tab is matched against `textContent` (`completed`), not CSS-uppercased
  `innerText` (`Completed`).
- Quill note bodies are normalized (`&nbsp;` → space) before asserting content.
- `countsByDay` unit test used hardcoded dates that drift — now computed relative to run day.
- Responsive overflow fixes for the Schedule heading row and shared `PageHeader` action slot
  (`flex-wrap`, tighter width) — pre-existing edits, verified by the 390–1920 overflow sweep.