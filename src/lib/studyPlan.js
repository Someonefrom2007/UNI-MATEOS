// Smart Study Planner — Pro engine. Turns a target exam plus the course's
// topic mastery into a concrete day-by-day prep schedule: weakest topics get
// introduced first and spaced-reviewed up to the exam. Pure, deterministic,
// timezone-safe (Europe/Madrid via toLocalISO).
import { toLocalISO } from "@/lib/format";

const DAY_MS = 86400000;

export const PLAN_DEFAULTS = Object.freeze({
  daysBefore: 14,
  budgetMin: 90,
});

const MINUTES = Object.freeze({
  weak_intro: 35,
  mid_intro: 30,
  strong_intro: 25,
  weak_review: 20,
  mid_review: 15,
  eve_review: 15,
  exam_pass: 30,
});

const RANK = Object.freeze({
  exam_pass: 0,
  eve_review: 1,
  weak_intro: 2,
  weak_review: 3,
  mid_intro: 4,
  strong_intro: 5,
  mid_review: 6,
});

const isoOf = (value) => String(value || "").slice(0, 10);

/** Day shift on a yyyy-mm-dd string, kept in local (Europe/Madrid) time. */
export const addDaysISO = (date, days) => {
  const d = new Date(`${isoOf(date)}T00:00:00`);
  d.setDate(d.getDate() + days);
  return toLocalISO(d);
};

/** Whole days from `fromISO` to `toISO` (both local dates). */
export const daysBetween = (fromISO, toISO) => {
  const a = new Date(`${isoOf(fromISO)}T00:00:00`).getTime();
  const b = new Date(`${isoOf(toISO)}T00:00:00`).getTime();
  return Math.round((b - a) / DAY_MS);
};

/**
 * Weak topics (< 50) need the earliest look-in and the most revisits.
 * @param {{ mastery?: number }} topic
 * @returns {"weak"|"mid"|"strong"}
 */
export const masteryBand = (topic) => {
  const m = Number(topic.mastery) || 0;
  if (m < 50) return "weak";
  if (m < 75) return "mid";
  return "strong";
};

const noteFor = (kind, topic) => {
  switch (kind) {
    case "weak_intro":
    case "mid_intro":
    case "strong_intro":
      return topic ? `First pass on ${topic.name} — weakest areas first.` : "First pass.";
    case "weak_review":
      return topic ? `Spaced review of ${topic.name} before it can slip.` : "Spaced review.";
    case "mid_review":
      return topic ? `Light reinforcement of ${topic.name}.` : "Reinforcement.";
    case "eve_review":
      return "Final-eve refresh of the weak-set.";
    case "exam_pass":
      return "Final countdown pass on exam day.";
    default:
      return "";
  }
};

const itemFor = (exam, topic, kind, startDate, dayIndex, now) => {
  const date = addDaysISO(startDate, dayIndex);
  return {
    id: "",
    plan_id: "",
    date,
    minutes: MINUTES[kind],
    kind,
    topic_id: topic ? topic.id : null,
    label: topic ? topic.name : kind === "exam_pass" ? "Exam-day pass" : "Course refresh",
    note: noteFor(kind, topic),
    completed: false,
    created_at: now(),
    updated_at: now(),
  };
};

const applyBudget = (items, budgetMin) => {
  const byDate = {};
  items.forEach((it) => {
    (byDate[it.date] = byDate[it.date] || []).push(it);
  });
  const out = [];
  Object.keys(byDate).forEach((date) => {
    const day = byDate[date].slice().sort((a, b) => RANK[a.kind] - RANK[b.kind]);
    let total = day.reduce((s, it) => s + it.minutes, 0);
    day.forEach((it) => {
      if (total <= budgetMin || day.length === 1 || it.kind === "exam_pass") {
        out.push(it);
        return;
      }
      total -= it.minutes;
    });
  });
  return out;
};

const byDateThenRank = (a, b) => {
  const d = a.date.localeCompare(b.date);
  return d !== 0 ? d : (RANK[a.kind] ?? 9) - (RANK[b.kind] ?? 9);
};

/**
 * Generate a study plan toward a target exam.
 *
 * Shape:
 *   { id, name, date: "yyyy-mm-dd", course_id, weight?, status? }
 * Topics are the course's topics with 0-100 masteries. Options:
 *   today (iso date), daysBefore (lookahead window), budgetMin (max study
 *   minutes per day), now (timestamp factory).
 *
 * @param {object} exam
 * @param {Array<{ id: string, course_id?: string, name: string, mastery?: number }>} [topics]
 * @param {object} [options]
 * @returns {Array<object>} plan items sorted by date, then importance
 */
export const generateStudyPlan = (exam = {}, topics = [], options = {}) => {
  const examDate = isoOf(exam.date);
  const today = isoOf(options.today ?? new Date().toISOString());
  const daysBefore = options.daysBefore ?? PLAN_DEFAULTS.daysBefore;
  const budgetMin = options.budgetMin ?? PLAN_DEFAULTS.budgetMin;
  const now = options.now ?? (() => new Date().toISOString());

  if (!examDate) return [];
  const horizon = daysBetween(today, examDate);
  if (horizon < 0) return [];
  if (horizon === 0) return [itemFor(exam, null, "exam_pass", examDate, 0, now)];

  const window = Math.min(horizon, daysBefore);
  const startDate = addDaysISO(examDate, -window);
  const available = Math.max(1, window - 1);

  const courseTopics = topics.filter(
    (t) => exam.course_id && t.course_id && String(t.course_id) === String(exam.course_id)
  );

  const items = [];

  if (courseTopics.length === 0) {
    const reviewDays = Math.min(3, available);
    for (let k = reviewDays; k >= 1; k -= 1) {
      items.push(
        itemFor(exam, null, "mid_review", startDate, available - k, now)
      );
    }
  } else {
    const sorted = courseTopics
      .slice()
      .sort((a, b) => (Number(a.mastery) || 0) - (Number(b.mastery) || 0));
    const perDay = Math.max(1, Math.ceil(sorted.length / available));

    sorted.forEach((topic, i) => {
      const band = masteryBand(topic);
      const introDay = Math.min(available - 1, Math.floor(i / perDay));
      items.push(itemFor(exam, topic, `${band}_intro`, startDate, introDay, now));

      if (band === "weak") {
        if (available >= 5) {
          const reviewDay = Math.min(
            available - 2,
            introDay + Math.max(2, Math.round(available * 0.4))
          );
          items.push(itemFor(exam, topic, "weak_review", startDate, reviewDay, now));
        }
        if (available >= 3) {
          items.push(itemFor(exam, topic, "eve_review", startDate, available, now));
        }
      } else if (band === "mid" && available >= 5) {
        const reviewDay = Math.min(
          available - 1,
          introDay + Math.max(2, Math.round(available * 0.5))
        );
        items.push(itemFor(exam, topic, "mid_review", startDate, reviewDay, now));
      }
    });
  }

  items.push(itemFor(exam, null, "exam_pass", startDate, window, now));

  return applyBudget(items, budgetMin).sort(byDateThenRank);
};

/**
 * Punch the generated items up to full repo rows (user_id stamped) or just
 * summarize a plan if you only need counts. Items get plan_id attached here.
 * @param {object[]} items
 * @param {string} planId
 * @param {string} userId
 * @returns {object[]}
 */
export const materializeItems = (items, planId, userId) =>
  items.map((it) => ({ ...it, plan_id: planId, user_id: userId }));

/**
 * @param {object[]} items
 * @returns {{ sessions: number, minutes: number, days: number, topics: number, reviews: number }}
 */
export const summarizePlan = (items = []) => {
  const reviews = ["weak_review", "mid_review", "eve_review"];
  return {
    sessions: items.length,
    minutes: items.reduce((s, it) => s + (Number(it.minutes) || 0), 0),
    days: new Set(items.map((it) => it.date)).size,
    topics: new Set(items.filter((it) => it.topic_id).map((it) => it.topic_id)).size,
    reviews: items.filter((it) => reviews.includes(it.kind)).length,
  };
};