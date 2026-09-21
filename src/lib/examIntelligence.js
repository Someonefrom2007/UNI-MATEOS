// Exam Intelligence — Pro engine. Predicts how an exam will land from real
// data (recorded result, your expectation, or course grade history) and turns
// topic mastery gaps into concrete preparation steps. Pure + deterministic.
export const ASSESSMENT_SCALE = 10;
export const PASS_THRESHOLD = 5;

const avg = (nums) => (nums.length ? nums.reduce((s, n) => s + n, 0) / nums.length : null);

const asNumber = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Normalize a grade value onto the 0-10 assessment scale. */
export const toScale = (value) => {
  const n = asNumber(value);
  if (n === null) return null;
  return Math.max(0, Math.min(ASSESSMENT_SCALE, n));
};

/**
 * Projected score for an exam. Source priority: recorded result (exact),
 * your own expected grade, then a course-weighted mean of graded history.
 * @param {object} exam
 * @param {Array<{ course_id?: string, grade?: number, weight?: number }>} [grades]
 * @returns {null | { value: number, confidence: "exact"|"good"|"medium"|"draft", source: string }}
 */
export const predictedScore = (exam = {}, grades = []) => {
  const recorded = toScale(exam.grade);
  if (exam.status === "completed" && recorded !== null) {
    return { value: recorded, confidence: "exact", source: "Recorded result" };
  }
  const expected = toScale(exam.expected_grade ?? exam.expectedGrade);
  if (expected !== null) {
    return { value: expected, confidence: "medium", source: "Your expectation" };
  }
  const course = grades.filter(
    (g) => exam.course_id && g.course_id && String(g.course_id) === String(exam.course_id)
  );
  const weighted = course
    .map((g) => {
      const grade = toScale(g.grade);
      const weight = Math.max(0, Number(g.weight) || 1);
      return grade === null ? null : { grade, weight };
    })
    .filter(Boolean);
  if (!weighted.length) return null;
  const value = weighted.reduce((s, g) => s + g.grade * g.weight, 0) / weighted.reduce((s, g) => s + g.weight, 0);
  return {
    value: +value.toFixed(2),
    confidence: weighted.length >= 3 ? "good" : "draft",
    source: `Course history (${weighted.length} scored)`,
  };
};

const bandOf = (margin) =>
  margin >= 1 ? "high" : margin >= 0 ? "pass" : "risk";

/**
 * Categorize a predicted score against the pass line.
 * @param {number|null} value
 * @returns {null | { key: "high"|"pass"|"risk", margin: number, label: string, cls: string }}
 */
export const scoreBand = (value) => {
  if (value === null || value === undefined) return null;
  const v = toScale(value);
  const margin = +(v - PASS_THRESHOLD).toFixed(2);
  const key = bandOf(margin);
  return {
    key,
    margin,
    label: key === "high" ? "Comfortable" : key === "pass" ? "Pass zone" : "At risk",
    cls:
      key === "high"
        ? "bg-hud-emerald/10 text-hud-emerald border-hud-emerald/30"
        : key === "pass"
          ? "bg-hud-amber/10 text-hud-amber border-hud-amber/30"
          : "bg-hud-rose/10 text-hud-rose border-hud-rose/30",
  };
};

/**
 * Average mastery (0-100) of the topics an exam covers, plus the weakest ones.
 * @param {Array<{ name?: string, mastery?: number }>} [topics]
 * @returns {null | { readiness: number, weakest: object[] }}
 */
export const readinessOf = (topics = []) => {
  if (!topics.length) return null;
  const values = topics
    .map((t) => ({ ...t, mastery: Math.max(0, Math.min(100, Number(t.mastery) || 0)) }))
    .slice()
    .sort((a, b) => a.mastery - b.mastery);
  return {
    readiness: Math.round(values.reduce((s, t) => s + t.mastery, 0) / values.length),
    weakest: values,
  };
};

/**
 * What it would take to clear the pass line, expressed as concrete steps.
 * @param {number|null} predicted  - projected score (0-10)
 * @param {Array<{ name?: string, mastery?: number }>} [topics]
 * @returns {null | { gap: number, steps: object[] }}
 */
export const stepsToPass = (predicted, topics = []) => {
  const v = toScale(predicted);
  if (v === null) return null;
  const gap = +(PASS_THRESHOLD - v).toFixed(2);
  if (gap <= 0) {
    return { gap: 0, steps: [{ kind: "maintain", text: "Already above the pass line — keep reviewing at a steady cadence." }] };
  }
  const ranked = readinessOf(topics);
  const steps = [];
  if (ranked) {
    ranked.weakest.slice(0, 2).forEach((t) => {
      const headroom = 100 - t.mastery;
      const delta = Math.min(headroom, Math.ceil(gap * 8));
      steps.push({
        kind: "mastery",
        topic: t.name || "topic",
        text: `Raise ${t.name || "the weakest topic"} from ${t.mastery}% to ${Math.min(100, t.mastery + delta)}% — your fastest way to close the gap.`,
      });
    });
  }
  const needDays = Math.max(3, Math.ceil(gap * 2));
  steps.push({
    kind: "schedule",
    text: `At the current pace, plan ~${needDays} focused days before the exam using the Study Planner.`,
  });
  return { gap, steps };
};