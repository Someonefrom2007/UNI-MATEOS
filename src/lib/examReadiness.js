// Exam readiness + spaced-revision planning. Pure and date-string deterministic
// (local-day whole maths, no clock-time reads) so a readiness number is stable
// across timezones and safe to unit-test.
//
// This complements examIntelligence.js, which answers "what will I score?"
// (predictedScore / scoreBand / readinessOf over topic mastery). It answers the
// different question "am I ready in time?" — which needs the exam date, the
// study already logged, and the days left, none of which readinessOf sees.

import { daysBetween } from "@/lib/nextUrgent";
import { PASS_THRESHOLD, toScale } from "@/lib/examIntelligence";

const clamp = (n, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));

/**
 * @typedef {object} ReadinessExam
 * @property {string} [id]
 * @property {string} [course_id]
 * @property {string} [date] YYYY-MM-DD
 * @property {number} [weight]
 * @property {string} [status]
 * @property {number} [expected_grade]
 *
 * @typedef {object} ReadinessCourse
 * @property {number} [target_grade]
 *
 * @typedef {{ exam_id?: string, duration?: number, completed?: boolean }} StudySession
 *
 * @typedef {object} ReadinessInput
 * @property {ReadinessExam} [exam]
 * @property {ReadinessCourse} [course]
 * @property {StudySession[]} [focusSessions]
 * @property {Array<number | { mastery?: number }>} [masteryRatings] 1-5 self-ratings.
 * @property {number} [masteryScore] Pre-aggregated 0-100 mastery; wins over masteryRatings.
 * @property {string} [todayStr] YYYY-MM-DD.
 *
 * @typedef {object} Readiness
 * @property {number} score
 * @property {string} band
 * @property {number | null} daysLeft
 * @property {boolean} past
 * @property {boolean} done
 * @property {number | null} mastery
 * @property {number | null} coverage
 * @property {number | null} pace
 * @property {number} minutesDone
 * @property {number} minutesNeeded
 * @property {{ mastery: number|null, coverage: number|null, pace: number|null }} components
 *
 * @typedef {object} PriorityInput
 * @property {ReadinessExam} [exam]
 * @property {ReadinessCourse} [course]
 * @property {{ score?: number } | null} [readiness]
 * @property {number | null} [predicted]
 * @property {string} [todayStr]
 *
 * @typedef {object} BoardInput
 * @property {Array<ReadinessExam & { topics?: Array<{ mastery?: number }> }>} [exams]
 * @property {Array<{ id?: string, name?: string, target_grade?: number }>} [courses]
 * @property {StudySession[]} [focusSessions]
 * @property {Record<string, Array<number>>} [masteryByExam]
 * @property {string} [todayStr]
 * @property {number} [withinDays]
 */
const round1 = (n) => Math.round(n * 10) / 10;

/**
 * Study minutes an exam implies from its course weight. Heavier papers get more
 * revision; the floor/ceiling keep a 0% or 100% weight from producing a useless
 * target (no plan) or an impossible one.
 */
export const recommendedMinutes = (weight) => {
  const w = Math.max(0, Number(weight) || 0);
  return Math.round(Math.max(120, Math.min(900, w * 45)));
};

/**
 * Completed study minutes logged against one exam. Only `completed` sessions
 * count — an interrupted pomodoro is not revision, and counting it would let a
 * user inflate readiness by starting timers and abandoning them.
 */
export const studyMinutesFor = (focusSessions = [], examId) =>
  (focusSessions || [])
    .filter((s) => s && s.exam_id === examId && s.completed !== false)
    .reduce((sum, s) => sum + Math.max(0, Number(s.duration) || 0), 0);

/**
 * Mastery self-ratings (1-5) collapsed to 0-100.
 * A 1 maps to 0 and a 5 maps to 100, so "no confidence" is genuinely zero
 * rather than a flattering 20.
 */
export const masteryToScore = (ratings = []) => {
  const clean = (ratings || [])
    .map((r) => (typeof r === "object" && r !== null ? r.mastery : r))
    .map((r) => Number(r))
    .filter((r) => Number.isFinite(r) && r >= 1 && r <= 5);
  if (!clean.length) return null;
  return Math.round(clean.reduce((s, r) => s + (r - 1) / 4, 0) * 100 / clean.length);
};

/**
 * Mean of a topic list's 0-100 mastery, or null when there is nothing rated.
 *
 * The Exams UI already stores topic mastery on a 0-100 scale, whereas the
 * 1-5 self-rating above is a separate input. Keeping both explicit stops a
 * 0-100 value being fed to the 1-5 mapper (where it would be silently dropped
 * as out-of-range and readiness would quietly lose its biggest component).
 *
 * @param {Array<{ mastery?: number }>} topics
 * @returns {number | null}
 */
export const topicMasteryScore = (topics = []) => {
  const clean = (topics || [])
    .map((t) => Number(t?.mastery))
    .filter((n) => Number.isFinite(n));
  if (!clean.length) return null;
  return Math.round(clean.reduce((s, n) => s + clamp(n), 0) / clean.length);
};

/**
 * Readiness for one exam, 0-100.
 *
 * Three weighted components, deliberately exposed in the result so the UI can
 * explain the number instead of showing a bare bar:
 *   mastery  45% — self-rated confidence (1-5) on the covered topics
 *   coverage 35% — logged study minutes vs the weight-implied target
 *   pace     20% — is study keeping up with the shrinking window?
 *
 * A missing mastery self-rating does not drag the score to zero; mastery is
 * re-weighted across the components that exist, and `components` reports nulls
 * so callers can say "rate yourself to sharpen this".
 *
 * @param {ReadinessInput} [p]
 * @returns {Readiness}
 */
export const readinessScore = ({ exam = {}, course = {}, focusSessions = [], masteryRatings = [], masteryScore = null, todayStr } = {}) => {
  const daysLeft = daysBetween(exam?.date, todayStr);
  const past = daysLeft !== null && daysLeft < 0;
  const minutesNeeded = recommendedMinutes(exam?.weight);
  const minutesDone = studyMinutesFor(focusSessions, exam?.id);

  const mastery = masteryScore !== null && masteryScore !== undefined
    ? Math.round(clamp(Number(masteryScore) || 0))
    : masteryToScore(masteryRatings);
  const coverage = Math.round(clamp((minutesDone / minutesNeeded) * 100));

  // Pace: how much of the required work is done versus how much of the window
  // has burnt. On schedule -> 100; half the window gone with a quarter of the
  // work done -> ~50. Capped so being early reads as 100, not a bonus.
  let pace = null;
  if (daysLeft !== null) {
    const span = Math.max(1, daysLeft + 1); // inclusive of today
    const elapsedFraction = 1 / span;
    const doneFraction = Math.min(1, minutesDone / minutesNeeded);
    if (daysLeft <= 0) {
      // Window is over: on-time only if the work is actually finished.
      pace = minutesDone >= minutesNeeded ? 100 : Math.round(clamp(doneFraction * 100));
    } else {
      pace = Math.round(clamp((doneFraction / elapsedFraction) * 100));
    }
  }

  // A completed exam is history, not a readiness question. Report the mastery
  // and coverage we know but score it 100 — there is nothing left to prepare.
  if (exam?.status === "completed" || past) {
    return {
      score: 100, band: "done", daysLeft, past: true, done: true,
      mastery, coverage, pace, minutesDone, minutesNeeded,
      components: { mastery, coverage, pace },
    };
  }

  const parts = [
    { key: "mastery", weight: 45, value: mastery },
    { key: "coverage", weight: 35, value: coverage },
    { key: "pace", weight: 20, value: pace },
  ].filter((p) => p.value !== null && p.value !== undefined);

  const totalWeight = parts.reduce((s, p) => s + p.weight, 0);
  const score = totalWeight
    ? Math.round(parts.reduce((s, p) => s + p.value * p.weight, 0) / totalWeight)
    : 0;

  return {
    score,
    band: readinessBand(score),
    daysLeft, past, done: false,
    mastery, coverage, pace,
    minutesDone, minutesNeeded,
    components: { mastery, coverage, pace },
  };
};

export const readinessBand = (score) => {
  const s = Number(score) || 0;
  if (s >= 80) return "ready";
  if (s >= 55) return "getting-there";
  if (s >= 30) return "behind";
  return "at-risk";
};

/**
 * Priority tagging for under-prepared assessments. Returns the reasons rather
 * than a bare label so the Exams table can explain *why* something is red.
 *
 * Signals, in the order a student would care about them:
 *   - below the 5/10 pass threshold on the predicted score
 *   - short of the course target grade
 *   - readiness under 40 with the exam inside a week
 *
 * @param {PriorityInput} [p]
 * @returns {{ level: "critical"|"high"|"normal", reasons: Array<{ key: string, label: string }> }}
 */
export const examPriority = ({ exam = {}, course = {}, readiness = null, predicted = null, todayStr } = {}) => {
  const reasons = [];
  const daysLeft = daysBetween(exam?.date, todayStr);
  const predictedScore = predicted ?? exam?.expected_grade ?? null;
  const onScale = predictedScore === null || predictedScore === undefined ? null : toScale(predictedScore);

  if (onScale !== null && onScale < PASS_THRESHOLD) {
    reasons.push({ key: "below-pass", label: "Projected below the pass mark" });
  }

  const target = Number(course?.target_grade);
  if (onScale !== null && Number.isFinite(target) && onScale < target) {
    reasons.push({ key: "below-target", label: `Projected under your target of ${target}` });
  }

  if (readiness && readiness.score < 40 && daysLeft !== null && daysLeft >= 0 && daysLeft <= 7) {
    reasons.push({ key: "unprepared-soon", label: "Under-prepared with the exam this week" });
  }

  const level = reasons.length >= 2 ? "critical" : reasons.length === 1 ? "high" : "normal";
  return { level, reasons };
};

// Expanding gaps (in days from today) for spaced repetition: front-load two
// close passes, then let the gaps stretch so the material is revisited just as
// it starts to fade rather than crammed into one night.
const SPACING = [0, 1, 3, 7, 14, 21];

/**
 * Distribute revision blocks across the days before an exam.
 *
 * Blocks land on SPACING offsets from today and never on or after the exam
 * date — a session scheduled for exam morning is worthless. Durations grow with
 * the gap (early passes are short recall drills, later ones are longer
 * consolidation) and are scaled down when there is little time left, so a
 * three-day window yields a few small blocks rather than one impossible one.
 *
 * @param {{ exam?: ReadinessExam, todayStr?: string, sessions?: number }} [p]
 * @returns {Array<{ date: string, daysOut: number, minutes: number, focus: string }>}
 */
export const planRevisionSchedule = ({ exam = {}, todayStr, sessions = SPACING.length } = {}) => {
  const daysLeft = daysBetween(exam?.date, todayStr);
  // Past exams get no plan; an exam today gets one final cram block.
  if (daysLeft === null || daysLeft < 0) return [];
  if (daysLeft === 0) {
    return [{ date: todayStr, daysOut: 0, minutes: 60, focus: "Final review" }];
  }

  const need = recommendedMinutes(exam?.weight);
  const slots = SPACING.filter((offset) => offset < daysLeft).slice(0, Math.max(0, sessions));
  if (!slots.length) return [];

  // Split the weight-implied total across the slots, tilted toward the later
  // (consolidation) passes. Minutes are allocated proportionally rather than
  // fixed so the plan totals the same for any number of slots.
  const tilt = slots.map((o) => 1 + o / 2);
  const tiltTotal = tilt.reduce((s, r) => s + r, 0);

  return slots.map((offset, i) => ({
    date: offsetDate(todayStr, offset),
    daysOut: offset,
    minutes: Math.max(15, Math.min(180, Math.round((need * tilt[i] / tiltTotal) / 5) * 5)),
    focus: offset === 0 ? "Recall drill" : offset <= 3 ? "Practice problems" : "Full review",
  }));
};

/** Add whole days to a YYYY-MM-DD string without touching the clock. */
export const offsetDate = (dateStr, days) => {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/**
 * Exams within `withinDays`, with readiness and priority attached, soonest
 * first. This is what the dashboard widget and the countdown badges render.
 *
 * @param {BoardInput} [p]
 * @returns {Array<{ exam: object, course: object | undefined, readiness: Readiness,
 *                   priority: object, daysLeft: number | null, countdown: number | null }>}
 */
export const readinessBoard = ({ exams = [], courses = [], focusSessions = [], masteryByExam = {}, todayStr, withinDays = 7 } = {}) => {
  const courseOf = (id) => (courses || []).find((c) => c.id === id);
  return (exams || [])
    .filter((e) => e && e.status !== "completed")
    .map((e) => {
      const course = courseOf(e.course_id);
      const readiness = readinessScore({
        exam: e, course, focusSessions,
        masteryScore: topicMasteryScore(e.topics),
        masteryRatings: masteryByExam[e.id] || [],
        todayStr,
      });
      const priority = examPriority({ exam: e, course, readiness, todayStr });
      const daysLeft = readiness.daysLeft;
      return {
        exam: e, course, readiness, priority,
        daysLeft,
        // A countdown badge is only meaningful for something still ahead.
        countdown: daysLeft !== null && daysLeft >= 0 && daysLeft <= withinDays ? daysLeft : null,
      };
    })
    .filter((r) => r.countdown !== null)
    .sort((a, b) => a.daysLeft - b.daysLeft);
};
