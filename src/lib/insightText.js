// Display lens for the pinned insight engine.
//
// `insightsEngine.js` decides *which* observations are worth making, their
// thresholds and their ordering, and it is pinned. It renders English
// sentences. This module takes the engine's output — the ids it actually
// emitted — plus the same inputs, and produces the sentence in the active
// language. Selection logic stays in the engine; only wording lives here.
//
// The few extra numbers a sentence needs beyond the engine's `value` (how many
// tasks were completed out of how many, the two averages behind a trend) are
// derived here with the engine's own rules. `insightText.test.js` asserts the
// localized sentence carries the same numbers as the engine's, so the two
// cannot drift apart silently.

import { translate } from "@/lib/i18n";
import { daysUntil } from "@/lib/format";

const mean = (rows) => rows.reduce((s, r) => s + r.grade, 0) / rows.length;

// Mirrors the engine's week boundary exactly, including its use of UTC date
// strings, so the counts agree rather than differing by a day near midnight.
const weekStartStr = () => {
  const now = new Date();
  const ws = new Date(now);
  ws.setDate(now.getDate() - now.getDay());
  ws.setHours(0, 0, 0, 0);
  return ws.toISOString().slice(0, 10);
};

const upcomingExams = (exams) =>
  exams
    .filter((e) => e.status !== "completed" && e.date)
    .map((e) => ({ e, n: daysUntil(e.date) }))
    .filter((x) => x.n !== null && x.n >= 0 && x.n <= 14)
    .sort((a, b) => a.e.date.localeCompare(b.e.date));

const weakestTopic = (exam) =>
  (exam.topics || [])
    .filter((tp) => !tp.reviewed || (tp.mastery || 0) < 80)
    .sort((a, b) => (a.mastery || 0) - (b.mastery || 0))[0];

// One engine insight -> one localized sentence. Unknown ids keep the engine's
// text rather than rendering a key, so a new observation in the engine shows
// up untranslated instead of blank.
export const localizeInsight = (insight, inputs = {}) => {
  const { tasks = [], exams = [], courses = [], grades = [], habits = [] } = inputs;
  const value = insight?.value;

  switch (insight?.id) {
    case "task-rate": {
      const wsStr = weekStartStr();
      const done = tasks.filter((t) => t.completed_date && t.completed_date >= wsStr).length;
      const total = tasks.filter((t) => t.created_date && t.created_date.slice(0, 10) >= wsStr).length;
      return translate("dash.insight.taskRate", { done, total, rate: value });
    }
    case "focus-trend":
      return translate(value > 0 ? "dash.insight.focusUp" : "dash.insight.focusDown", {
        pct: Math.abs(value),
      });
    case "exam-pressure": {
      const nearest = upcomingExams(exams)[0];
      if (!nearest) return insight.text;
      const course = courses.find((c) => c.id === nearest.e.course_id);
      const params = {
        course: course ? `${course.name} — ` : "",
        name: nearest.e.name,
        n: nearest.n,
      };
      const key =
        nearest.n === 0
          ? "dash.insight.examPressureToday"
          : nearest.n === 1
            ? "dash.insight.examPressureTomorrow"
            : "dash.insight.examPressureIn";
      return translate(key, params);
    }
    case "deadline-cluster":
      return translate("dash.insight.deadlineCluster", { n: value });
    case "grade-trend": {
      const graded = grades.filter((g) => g.grade !== null && g.grade !== undefined);
      const sorted = [...graded].sort((a, b) => (a.date || "").localeCompare(b.date || ""));
      const recent = sorted.slice(-3);
      const older = sorted.slice(0, -3);
      if (!older.length) return insight.text;
      return translate(value > 0 ? "dash.insight.gradeUp" : "dash.insight.gradeDown", {
        from: mean(older).toFixed(1),
        to: mean(recent).toFixed(1),
      });
    }
    case "habits":
      return translate("dash.insight.habits", { done: value, total: habits.length });
    default:
      return insight.text;
  }
};

export const localizeInsights = (insights = [], inputs = {}) =>
  insights.map((ins) => ({ ...ins, text: localizeInsight(ins, inputs) }));

// The engine's "what should I do now" also carries an English reason. The
// decision (which task, which exam, which topic) stays in the engine; only the
// explaining sentence is re-rendered.
export const localizeRecommendation = (rec, inputs = {}) => {
  if (!rec) return rec;
  const { exams = [] } = inputs;

  if (rec.kind === "exam" && rec.examId) {
    const exam = exams.find((e) => e.id === rec.examId);
    const n = exam ? daysUntil(exam.date) : null;
    if (n === null) return rec;
    const topic = exam ? weakestTopic(exam) : null;
    const topics = topic ? translate("dash.rec.topicNeedsReview", { topic: topic.name }) : "";
    const key = n === 0 ? "dash.rec.examToday" : n === 1 ? "dash.rec.examTomorrow" : "dash.rec.examIn";
    return { ...rec, reason: translate(key, { n, topics }) };
  }

  if (rec.kind === "task") {
    const overdue = rec.reason === "This task is overdue.";
    return { ...rec, reason: translate(overdue ? "dash.rec.overdue" : "dash.rec.nextDeadline") };
  }

  return rec;
};
