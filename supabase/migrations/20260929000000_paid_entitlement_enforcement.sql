-- 20260929000000_paid_entitlement_enforcement.sql
--
-- Closes the direct-REST hole for the paid-only datasets and moves the paid
-- analytics onto a server-authorized derived read.
--
-- Context: the application layer was already correct — UI gates, the
-- ai-assistant edge function and the lemon-squeezy status endpoint all read
-- subscriptions.tier rather than the caller-writable user_metadata.plan mirror.
-- But every RLS policy on the paid tables was ownership-only
-- (`auth.uid() = user_id`), so any authenticated user holding their own JWT and
-- the public anon key could read their own flashcards/study_plans directly
-- through PostgREST, bypassing the paywall entirely. This migration makes the
-- DATABASE the enforcement point.
--
-- Entitlement is read exclusively from public.subscriptions, which has RLS with
-- SELECT-own, no client INSERT/UPDATE policy, and is written only by the
-- lemon-squeezy webhook using the service role. user_metadata is never consulted.
--
-- Deliberately NOT gated: focus_sessions, tasks, grades, courses. Those are
-- free-tier data. The free Analytics surface (src/lib/burnout.js, rendered by
-- the dashboard's VelocityCard/PulseCard) depends on them, so locking them would
-- break Grades, Focus, Tasks and Courses for every free user. The paid analytics
-- therefore ships as a derived read (public.advanced_analytics) that computes
-- server-side behind its own entitlement check.
--
-- Idempotency: every statement is safe to re-run. Policies are dropped and
-- recreated rather than created-only-when-missing, because the ownership-only
-- policies already exist on the hosted project and a create-if-missing guard
-- would silently leave the hole open. Each replacement is strictly NARROWER than
-- the policy it replaces (it adds an AND, never removes a restriction), so a
-- re-run can never loosen access. No table, column or row is dropped.
--
-- No service-role credential appears in this file; it runs as the schema owner.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. The single definition of "is this caller entitled to paid features?"
-- ─────────────────────────────────────────────────────────────────────────────
-- Mirrors effectiveTier() in both edge functions:
--   tier in (pro, ultimate)
--   AND status keeps entitlement (on_trial/active/paused/cancelled/unpaid)
--   AND a cancelled row is entitled only until renews_at
-- 'ultra' is intentionally absent: the subscriptions.tier CHECK constraint only
-- admits free/pro/ultimate, so the legacy spelling can never reach this column.
--
-- SECURITY DEFINER is required. Without it this function's own read of
-- subscriptions would be evaluated under that table's RLS, and the call would be
-- subject to the very policy chain it participates in. SECURITY DEFINER also
-- matches the existing is_admin()/current_admin_role() convention in this schema.
-- SET search_path pins resolution so no caller-controlled schema can shadow it.
--
-- is_admin() is OR-ed in deliberately: the founder/admin model is preserved
-- verbatim (staff are not paywalled) and the existing admin_read policies keep
-- working unchanged.
CREATE OR REPLACE FUNCTION public.has_paid_entitlement()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.is_admin() OR EXISTS (
    SELECT 1
    FROM public.subscriptions s
    WHERE s.user_id = auth.uid()
      AND s.tier IN ('pro','ultimate')
      AND COALESCE(s.status,'') IN ('on_trial','active','paused','cancelled','unpaid')
      AND (s.status IS DISTINCT FROM 'cancelled'
           OR s.renews_at IS NULL
           OR s.renews_at > now())
  );
$$;

-- Default privileges would otherwise hand EXECUTE to PUBLIC, letting anon call
-- this directly. It is only meaningful inside a policy (evaluated as the
-- querying role), so authenticated needs EXECUTE and nobody else does.
REVOKE ALL ON FUNCTION public.has_paid_entitlement() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_paid_entitlement() FROM anon;
GRANT EXECUTE ON FUNCTION public.has_paid_entitlement() TO authenticated;

COMMENT ON FUNCTION public.has_paid_entitlement() IS
  'Authoritative paid entitlement for auth.uid(). Reads subscriptions only; never user_metadata. Admins are always entitled.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Paid-only datasets: ownership AND entitlement
-- ─────────────────────────────────────────────────────────────────────────────
-- flashcards / flashcard_decks / study_plans / study_plan_items are Pro features
-- (PLAN_FEATURES in src/lib/plans.js) and are read by no free surface, so all
-- four commands are gated. Gating reads alone would be incoherent: a free user
-- could still insert rows they can never see back.

DROP POLICY IF EXISTS "flashcards_select_own"        ON public.flashcards;
DROP POLICY IF EXISTS "flashcards_insert_own"        ON public.flashcards;
DROP POLICY IF EXISTS "flashcards_update_own"        ON public.flashcards;
DROP POLICY IF EXISTS "flashcards_delete_own"        ON public.flashcards;
CREATE POLICY "flashcards_select_own" ON public.flashcards
  FOR SELECT USING (auth.uid() = user_id AND public.has_paid_entitlement());
CREATE POLICY "flashcards_insert_own" ON public.flashcards
  FOR INSERT WITH CHECK (auth.uid() = user_id AND public.has_paid_entitlement());
CREATE POLICY "flashcards_update_own" ON public.flashcards
  FOR UPDATE USING (auth.uid() = user_id AND public.has_paid_entitlement())
  WITH CHECK (auth.uid() = user_id AND public.has_paid_entitlement());
CREATE POLICY "flashcards_delete_own" ON public.flashcards
  FOR DELETE USING (auth.uid() = user_id AND public.has_paid_entitlement());

DROP POLICY IF EXISTS "flashcard_decks_select_own"   ON public.flashcard_decks;
DROP POLICY IF EXISTS "flashcard_decks_insert_own"   ON public.flashcard_decks;
DROP POLICY IF EXISTS "flashcard_decks_update_own"   ON public.flashcard_decks;
DROP POLICY IF EXISTS "flashcard_decks_delete_own"   ON public.flashcard_decks;
CREATE POLICY "flashcard_decks_select_own" ON public.flashcard_decks
  FOR SELECT USING (auth.uid() = user_id AND public.has_paid_entitlement());
CREATE POLICY "flashcard_decks_insert_own" ON public.flashcard_decks
  FOR INSERT WITH CHECK (auth.uid() = user_id AND public.has_paid_entitlement());
CREATE POLICY "flashcard_decks_update_own" ON public.flashcard_decks
  FOR UPDATE USING (auth.uid() = user_id AND public.has_paid_entitlement())
  WITH CHECK (auth.uid() = user_id AND public.has_paid_entitlement());
CREATE POLICY "flashcard_decks_delete_own" ON public.flashcard_decks
  FOR DELETE USING (auth.uid() = user_id AND public.has_paid_entitlement());

DROP POLICY IF EXISTS "study_plans_select_own"      ON public.study_plans;
DROP POLICY IF EXISTS "study_plans_insert_own"      ON public.study_plans;
DROP POLICY IF EXISTS "study_plans_update_own"      ON public.study_plans;
DROP POLICY IF EXISTS "study_plans_delete_own"      ON public.study_plans;
CREATE POLICY "study_plans_select_own" ON public.study_plans
  FOR SELECT USING (auth.uid() = user_id AND public.has_paid_entitlement());
CREATE POLICY "study_plans_insert_own" ON public.study_plans
  FOR INSERT WITH CHECK (auth.uid() = user_id AND public.has_paid_entitlement());
CREATE POLICY "study_plans_update_own" ON public.study_plans
  FOR UPDATE USING (auth.uid() = user_id AND public.has_paid_entitlement())
  WITH CHECK (auth.uid() = user_id AND public.has_paid_entitlement());
CREATE POLICY "study_plans_delete_own" ON public.study_plans
  FOR DELETE USING (auth.uid() = user_id AND public.has_paid_entitlement());

DROP POLICY IF EXISTS "study_plan_items_select_own" ON public.study_plan_items;
DROP POLICY IF EXISTS "study_plan_items_insert_own" ON public.study_plan_items;
DROP POLICY IF EXISTS "study_plan_items_update_own" ON public.study_plan_items;
DROP POLICY IF EXISTS "study_plan_items_delete_own" ON public.study_plan_items;
CREATE POLICY "study_plan_items_select_own" ON public.study_plan_items
  FOR SELECT USING (auth.uid() = user_id AND public.has_paid_entitlement());
CREATE POLICY "study_plan_items_insert_own" ON public.study_plan_items
  FOR INSERT WITH CHECK (auth.uid() = user_id AND public.has_paid_entitlement());
CREATE POLICY "study_plan_items_update_own" ON public.study_plan_items
  FOR UPDATE USING (auth.uid() = user_id AND public.has_paid_entitlement())
  WITH CHECK (auth.uid() = user_id AND public.has_paid_entitlement());
CREATE POLICY "study_plan_items_delete_own" ON public.study_plan_items
  FOR DELETE USING (auth.uid() = user_id AND public.has_paid_entitlement());

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Advanced analytics — derived, entitlement-checked read
-- ─────────────────────────────────────────────────────────────────────────────
-- Monday-start of the week containing p_d. Postgres extract(dow) is 0=Sunday,
-- so (dow + 6) % 7 maps Sunday->6, Monday->0, matching weekStartOf() in
-- src/lib/analytics.js.
CREATE OR REPLACE FUNCTION public.week_start(p_d date)
RETURNS date
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_d - (((extract(dow FROM p_d)::int) + 6) % 7);
$$;

REVOKE ALL ON FUNCTION public.week_start(date) FROM PUBLIC;
-- The paid analytics (src/lib/analytics.js) was computed in the browser from
-- focus_sessions/tasks/grades/courses. Those tables must stay readable by free
-- users, so there was no server-side object to protect — a "gate" that only
-- checked a flag while the client kept the raw rows would be frontend hiding.
--
-- This function moves the paid derivation server-side. It reads only the
-- caller's own rows (user_id = auth.uid()), so it cannot leak another user's
-- data, and it refuses non-entitled callers outright with 42501 — the same
-- error code RLS raises, so the client sees one consistent denial shape.
--
-- All the day columns involved (focus_sessions.date, tasks.completed_date,
-- grades.date) are `date`, not timestamptz, so week bucketing is pure date math
-- and needs no timezone handling. p_today defaults to the caller's local day in
-- Europe/Madrid, matching toLocalISO() in src/lib/format.
--
-- Scope note, stated plainly rather than hidden: this protects the product
-- surface, not confidentiality. A user always owns their own focus_sessions and
-- tasks, so anyone determined can recompute a streak by hand. That is inherent
-- to storing the inputs in a table they can read, and is the reason the free
-- tables are left open.
CREATE OR REPLACE FUNCTION public.advanced_analytics(p_today date DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_today date;
  v_active date[] := ARRAY[]::date[];
  v_days  integer := 1200;   -- matches the JS lookback window
  v_weeks integer := 8;      -- matches weeklyFocus's default
  v_i     integer;
  v_key   date;
  v_run   integer := 0;
  v_best  integer := 0;
  v_cur   integer := 0;
  v_sum   numeric := 0;
  v_wsum  numeric := 0;
  v_pts   jsonb := '[]'::jsonb;
  v_weeks_out jsonb := '[]'::jsonb;
  v_best_course jsonb := NULL;
  v_worst_course jsonb := NULL;
  v_done integer; v_inprog integer; v_open integer; v_total integer; v_overdue integer;
  v_wmin numeric; v_lmin numeric; v_wcnt integer; v_lcnt integer; v_avgdur numeric;
  v_graded integer; v_cum numeric := 0; v_cumn integer := 0;
  r record;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;
  IF NOT public.has_paid_entitlement() THEN
    RAISE EXCEPTION 'advanced analytics requires a paid plan' USING ERRCODE = '42501';
  END IF;

  v_today := COALESCE(p_today, (now() AT TIME ZONE 'Europe/Madrid')::date);

  -- ── study streaks ──────────────────────────────────────────────────────────
  -- A day is "active" with at least one completed task carrying a completed_date,
  -- or at least one focus session. Mirrors activeOn() in src/lib/analytics.js.
  SELECT array_agg(DISTINCT d) INTO v_active
  FROM (
    SELECT t.completed_date AS d FROM public.tasks t
     WHERE t.user_id = v_uid AND t.status = 'completed' AND t.completed_date IS NOT NULL
    UNION
    SELECT f.date FROM public.focus_sessions f WHERE f.user_id = v_uid
  ) x
  WHERE d IS NOT NULL;

  FOR v_i IN 0..(v_days - 1) LOOP
    IF (v_today - v_i) = ANY (v_active) THEN
      v_run := v_run + 1;
      IF v_run > v_best THEN v_best := v_run; END IF;
    ELSE
      v_run := 0;
    END IF;
  END LOOP;

  -- current streak: 0 unless today itself is active, then count back to the gap
  IF v_today = ANY (v_active) THEN
    v_cur := 0;
    FOR v_i IN 0..(v_days - 1) LOOP
      EXIT WHEN (v_today - v_i) <> ALL (v_active);
      v_cur := v_cur + 1;
    END LOOP;
  END IF;

  -- ── weekly focus (last v_weeks Monday-start buckets) ───────────────────────
  -- Oldest bucket first, matching weeklyFocus()'s output order.
  FOR v_i IN 0..(v_weeks - 1) LOOP
    v_key := week_start(v_today) - ((v_weeks - 1 - v_i) * 7);
    SELECT COALESCE(SUM(f.duration), 0) INTO v_wmin
      FROM public.focus_sessions f
     WHERE f.user_id = v_uid AND week_start(f.date) = v_key;
    v_weeks_out := v_weeks_out || jsonb_build_object('week', v_key, 'minutes', v_wmin);
  END LOOP;

  -- ── focus velocity: this week vs last ─────────────────────────────────────
  SELECT COALESCE(SUM(f.duration), 0), COUNT(*) INTO v_wmin, v_wcnt
    FROM public.focus_sessions f
   WHERE f.user_id = v_uid AND week_start(f.date) = week_start(v_today);
  SELECT COALESCE(SUM(f.duration), 0), COUNT(*) INTO v_lmin, v_lcnt
    FROM public.focus_sessions f
   WHERE f.user_id = v_uid AND week_start(f.date) = week_start(v_today) - 7;
  SELECT AVG(f.duration) INTO v_avgdur
    FROM public.focus_sessions f
   WHERE f.user_id = v_uid AND f.duration > 0;

  -- ── completion stats ──────────────────────────────────────────────────────
  SELECT
    COUNT(*) FILTER (WHERE t.status = 'completed'),
    COUNT(*) FILTER (WHERE t.status = 'in_progress'),
    COUNT(*) FILTER (WHERE t.status IS NOT NULL AND t.status <> 'completed'),
    COUNT(*),
    COUNT(*) FILTER (WHERE t.status <> 'completed' AND t.due_date IS NOT NULL AND t.due_date < v_today)
  INTO v_done, v_inprog, v_open, v_total, v_overdue
  FROM public.tasks t WHERE t.user_id = v_uid;

  -- ── grade trajectory ──────────────────────────────────────────────────────
  -- grades.grade is NOT NULL, so "graded" is every row; ordering falls back to
  -- created_at when date is null, matching isoDay(g.date || g.created_at).
  FOR r IN
    SELECT g.grade::numeric AS value, COALESCE(g.date, g.created_at::date) AS d
      FROM public.grades g
     WHERE g.user_id = v_uid
     ORDER BY COALESCE(g.date, g.created_at::date) ASC
  LOOP
    -- The running sum must stay exact: rounding it on every iteration would
    -- drift the cumulative average. Only the emitted average is rounded.
    v_cum := v_cum + r.value;
    v_cumn := v_cumn + 1;
    v_pts := v_pts || jsonb_build_object('date', r.d, 'avg', round(v_cum / v_cumn, 2));
    v_sum := v_sum + r.value;
    v_wsum := v_wsum + 1;
  END LOOP;
  v_graded := v_cumn;

  -- per-course best/worst. courses.name is resolved inside the server, so the
  -- client no longer needs to join it and cannot be trusted to.
  FOR r IN
    SELECT g.course_id, c.name,
           round(AVG(g.grade::numeric), 2) AS mean
      FROM public.grades g
      JOIN public.courses c ON c.id = g.course_id
     WHERE g.user_id = v_uid AND g.user_id = c.user_id
     GROUP BY g.course_id, c.name
  LOOP
    IF v_best_course IS NULL OR r.mean > (v_best_course->>'avg')::numeric THEN
      v_best_course := jsonb_build_object('courseId', r.course_id, 'name', r.name, 'avg', r.mean);
    END IF;
    IF v_worst_course IS NULL OR r.mean < (v_worst_course->>'avg')::numeric THEN
      v_worst_course := jsonb_build_object('courseId', r.course_id, 'name', r.name, 'avg', r.mean);
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'streaks', jsonb_build_object('current', v_cur, 'best', v_best),
    'velocity', jsonb_build_object(
        'weekMinutes', v_wmin,
        'lastWeekMinutes', v_lmin,
        'sessionsThisWeek', v_wcnt,
        'sessionsLastWeek', v_lcnt,
        'changePct', CASE WHEN v_lmin > 0
                          THEN round(((v_wmin - v_lmin) / v_lmin) * 100)
                          ELSE v_wmin END,
        'avgSession', v_avgdur),
    'weeks', v_weeks_out,
    'completion', jsonb_build_object(
        'done', v_done, 'inProgress', v_inprog, 'open', v_open, 'total', v_total,
        'pct', CASE WHEN v_total > 0 THEN round((v_done::numeric / v_total) * 100) ELSE 0 END,
        'overdue', v_overdue),
    'trajectory', jsonb_build_object(
        'points', v_pts,
        'current', CASE WHEN v_wsum > 0 THEN round(v_sum / v_wsum, 2) END,
        'count', v_graded,
        'best', v_best_course,
        'worst', v_worst_course)
  );
END;
$$;

-- The derived read is only ever called by the authenticated student app.
REVOKE ALL ON FUNCTION public.advanced_analytics(date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.advanced_analytics(date) FROM anon;
GRANT EXECUTE ON FUNCTION public.advanced_analytics(date) TO authenticated;

COMMENT ON FUNCTION public.advanced_analytics(date) IS
  'Paid analytics derived server-side over free-tier tables. Own rows only; 42501 for non-entitled callers.';
