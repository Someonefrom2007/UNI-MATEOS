// Flashcard engine — deck/card row factories, a lightweight SM-2 scheduling
// kernel, and session utilities. Pure and injectable (now/date/rng), so the
// study flow is fully testable without a browser or database.
import { toLocalISO } from "@/lib/format";

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const num = (v, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};
const hasReviews = (card) => num(card.reviews) > 0;

export const GRADE_OPTIONS = Object.freeze(["again", "hard", "good", "easy"]);

export const createDeck = ({
  id = "",
  title = "",
  courseId = "",
  description = "",
  now = () => new Date().toISOString(),
} = {}) => ({
  id,
  user_id: "",
  course_id: courseId || null,
  title,
  description,
  created_at: now(),
  updated_at: now(),
});

export const createCard = ({
  id = "",
  deckId = "",
  front = "",
  back = "",
  ease = 2.5,
  interval = 0,
  due = "",
  reviews = 0,
  streak = 0,
  now = () => new Date().toISOString(),
} = {}) => ({
  id,
  user_id: "",
  deck_id: deckId,
  front,
  back,
  ease,
  interval,
  due_date: due || String(now()).slice(0, 10),
  reviews,
  streak,
  last_result: null,
  created_at: now(),
  updated_at: now(),
});

// Compact n-gram scoring instead of a regex bomb: strip to alphanumerics
// (digits + letters, including accented Latin) and collapse whitespace.
export const normalizeAnswer = (text = "") =>
  String(text)
    .toLowerCase()
    .replace(/'/g, "")
    .replace(/[^a-z0-9ñáéíóúüçàèìòù]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// Self-grading hint: exact match, or a one-sided containment when the given
// answer is at least 3 tokens long (prevents "the" matching everything).
export const answerMatches = (back, userAnswer, { fuzzy = true } = {}) => {
  const target = normalizeAnswer(back);
  const given = normalizeAnswer(userAnswer);
  if (!target || !given) return false;
  if (target === given) return true;
  if (!fuzzy) return false;
  if (given.split(" ").length < 3) return false;
  return target.includes(given) || given.includes(target);
};

// Lazy Fisher–Yates with an injectable rng for deterministic tests.
export const shuffle = (list = [], rng = Math.random) => {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

export const addDaysISO = (dateStr, days) => {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  return toLocalISO(d);
};

const easeDelta = { again: -0.2, hard: -0.15, good: 0, easy: 0.15 };
const newInterval = { hard: 1, good: 3, easy: 7 };
const stepInterval = (grade, current, ease) => {
  if (grade === "again") return 0;
  if (current <= 0) return newInterval[grade];
  if (grade === "hard") return Math.max(1, Math.round(current * 1.2));
  if (grade === "good") return Math.round(current * ease);
  return Math.round(current * ease * 1.3);
};

/**
 * Apply a grading to a card and return the updated row (immutable). "again"
 * resets the gap to today and clears the streak; successful grades grow the gap
 * by ease (intro steps of 1/3/7 days for new cards). Date math is anchor-string
 * based so tests stay timezone-proof.
 * @param {object} card
 * @param {"again"|"hard"|"good"|"easy"} grade
 * @param {object} [options]
 * @returns {object}
 */
export const gradeCard = (card = {}, grade, { now = () => new Date().toISOString() } = {}) => {
  if (!GRADE_OPTIONS.includes(grade)) return card;
  const ease = clamp(num(card.ease, 2.5) + easeDelta[grade], 1.3, 3);
  const current = num(card.interval);
  const interval = stepInterval(grade, current, ease);
  const today = String(now()).slice(0, 10);
  return {
    ...card,
    ease,
    interval,
    due_date: addDaysISO(today, interval),
    reviews: num(card.reviews) + 1,
    streak: grade === "again" ? 0 : num(card.streak) + 1,
    last_result: grade,
  };
};

// Cards that still need a review today: never-reviewed cards plus anything
// whose gap has elapsed.
export const dueCards = (cards = [], today) =>
  cards.filter((c) => !hasReviews(c) || (c.due_date && String(c.due_date).slice(0, 10) <= String(today).slice(0, 10)));

/**
 * Ordered study queue: overdue first, then fresh cards, capped at the limit.
 * @param {Array<object>} cards
 * @param {string} today
 * @param {object} [options]
 * @returns {Array<object>}
 */
export const sessionQueue = (cards = [], today, { limit = 20 } = {}) => {
  const pool = dueCards(cards, today);
  const ordered = [...pool].sort((a, b) => {
    const ad = String(a.due_date || "").slice(0, 10);
    const bd = String(b.due_date || "").slice(0, 10);
    if (ad !== bd) return ad.localeCompare(bd);
    return String(a.created_at || "").localeCompare(String(b.created_at || ""));
  });
  return limit == null ? ordered : ordered.slice(0, limit);
};

// A card is "mastered" once its gap comfortably exceeds the week window.
export const isMastered = (card) => num(card.interval) >= 21;

/**
 * Deck-level progress snapshot. avgEase is null until the first review.
 * @param {Array<object>} cards
 * @param {string} today
 * @returns {{total: number, due: number, fresh: number, mastered: number, avgEase: number|null}}
 */
export const sessionStats = (cards = [], today) => {
  const reviewed = cards.filter(hasReviews);
  const avgEase = reviewed.length
    ? reviewed.reduce((s, c) => s + num(c.ease, 2.5), 0) / reviewed.length
    : null;
  return {
    total: cards.length,
    due: dueCards(cards, today).length,
    fresh: cards.filter((c) => !hasReviews(c)).length,
    mastered: cards.filter(isMastered).length,
    avgEase: avgEase ? Math.round(avgEase * 100) / 100 : null,
  };
};