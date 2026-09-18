// The pinned insight engine picks which observations to make and phrases them
// in English; `insightText.js` re-renders them in the active language from the
// same inputs. Two independent computations of the same numbers is exactly
// where silent drift starts, so these tests assert the localized sentence
// carries the numbers the engine itself put in its English text.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { generateInsights, recommendNow } from "@/lib/insightsEngine";
import { localizeInsights, localizeRecommendation } from "@/lib/insightText";
import { setLang } from "@/lib/i18n";

const NOW = new Date("2026-09-16T12:00:00"); // Wednesday

// Dates are built relative to a frozen "now" so the week-boundary and
// day-count logic under test is deterministic.
const iso = (offsetDays) => {
  const d = new Date(NOW);
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  setLang("en");
});

afterEach(() => {
  vi.useRealTimers();
});

describe("localizeInsights", () => {
  it("reports the same task completion counts as the engine", () => {
    const tasks = [
      { id: "t1", status: "completed", completed_date: iso(-1), created_date: iso(-2) },
      { id: "t2", status: "completed", completed_date: iso(-1), created_date: iso(-2) },
      { id: "t3", status: "todo", created_date: iso(-2) },
    ];
    const inputs = { tasks };
    const [engine] = generateInsights(inputs);
    const [localized] = localizeInsights([engine], inputs);

    expect(engine.id).toBe("task-rate");
    expect(engine.text).toContain("2 of 3");
    expect(localized.text).toContain("2 of 3");
  });

  it("reports the same exam proximity as the engine", () => {
    const exams = [{ id: "e1", name: "Midterm", course_id: "c1", date: iso(4), status: "upcoming" }];
    const courses = [{ id: "c1", name: "Calculus" }];
    const inputs = { exams, courses };
    const [engine] = generateInsights(inputs);
    const [localized] = localizeInsights([engine], inputs);

    expect(engine.text).toContain("in 4 days");
    expect(localized.text).toContain("in 4 days");
    expect(localized.text).toContain("Calculus");
    expect(localized.text).toContain("Midterm");
  });

  it("reports the same deadline cluster size as the engine", () => {
    const tasks = [1, 2, 3, 4].map((n) => ({ id: `t${n}`, status: "todo", due_date: iso(n) }));
    const inputs = { tasks };
    const engine = generateInsights(inputs).find((i) => i.id === "deadline-cluster");
    const localized = localizeInsights([engine], inputs)[0];

    expect(engine.text).toContain("4 deadlines");
    expect(localized.text).toContain("4 deadlines");
  });

  it("reports the same grade trend endpoints as the engine", () => {
    const grades = [
      { id: "g1", grade: 6.0, date: iso(-20) },
      { id: "g2", grade: 6.4, date: iso(-18) },
      { id: "g3", grade: 8.0, date: iso(-4) },
      { id: "g4", grade: 8.6, date: iso(-2) },
    ];
    const inputs = { grades };
    const engine = generateInsights(inputs).find((i) => i.id === "grade-trend");
    const localized = localizeInsights([engine], inputs)[0];

    // The engine compares the mean of the older rows with the mean of the
    // newest three; the sentence must quote those same two numbers. The
    // numbers are read back out of the engine's own text rather than restated
    // here, so this cannot pass by both sides being wrong the same way.
    const engineNumbers = engine.text.match(/\d+\.\d/g) || [];
    expect(engineNumbers).toHaveLength(2);
    engineNumbers.forEach((n) => expect(localized.text).toContain(n));
  });

  it("reports the same focus trend direction and size as the engine", () => {
    const focusSessions = [
      { date: iso(-9), duration: 100 },
      { date: iso(-2), duration: 150 },
    ];
    const inputs = { focusSessions };
    const engine = generateInsights(inputs).find((i) => i.id === "focus-trend");
    const localized = localizeInsights([engine], inputs)[0];

    expect(engine.text).toContain("increased 50%");
    expect(localized.text).toContain("increased 50%");
  });

  it("reports the same habit count as the engine", () => {
    const habits = [{ id: "h1" }, { id: "h2" }];
    const habitLogs = [{ habit_id: "h1", date: iso(0), completed: true }];
    const inputs = { habits, habitLogs };
    const engine = generateInsights(inputs).find((i) => i.id === "habits");
    const localized = localizeInsights([engine], inputs)[0];

    expect(engine.text).toContain("1 of 2");
    expect(localized.text).toContain("1 of 2");
  });

  it("translates the sentence without changing the numbers", () => {
    const tasks = [
      { id: "t1", status: "completed", completed_date: iso(-1), created_date: iso(-2) },
      { id: "t2", status: "todo", created_date: iso(-2) },
    ];
    const inputs = { tasks };
    const [engine] = generateInsights(inputs);

    setLang("es");
    const [localized] = localizeInsights([engine], inputs);

    expect(localized.text).not.toBe(engine.text);
    expect(localized.text).toContain("1 de 2");
  });

  it("keeps the engine's text for an observation it does not know", () => {
    const unknown = { id: "brand-new", category: "Academic", text: "Something new.", value: 1 };
    const [localized] = localizeInsights([unknown], {});
    expect(localized.text).toBe("Something new.");
  });

  it("preserves every other field of the insight", () => {
    const tasks = [{ id: "t1", status: "todo", due_date: iso(1), created_date: iso(-1) }];
    const inputs = { tasks };
    const [engine] = generateInsights(inputs);
    const [localized] = localizeInsights([engine], inputs);
    expect(localized).toMatchObject({ id: engine.id, category: engine.category, value: engine.value });
  });
});

describe("localizeRecommendation", () => {
  it("explains an overdue task in the active language", () => {
    const tasks = [{ id: "t1", title: "Essay", status: "todo", due_date: iso(-2), priority: "high" }];
    const inputs = { tasks, exams: [], courses: [] };
    const rec = recommendNow(inputs);
    setLang("ca");
    const localized = localizeRecommendation(rec, inputs);

    expect(rec.reason).toBe("This task is overdue.");
    expect(localized.reason).not.toBe(rec.reason);
    expect(localized.reason).toContain("vençuda");
  });

  it("names the same weakest topic the engine chose", () => {
    const exams = [{
      id: "e1", name: "Midterm", course_id: "c1", date: iso(3), status: "upcoming",
      topics: [{ name: "Eigenvalues", mastery: 20 }, { name: "Bases", mastery: 70 }],
    }];
    const inputs = { tasks: [], exams, courses: [{ id: "c1", name: "Algebra" }] };
    const rec = recommendNow(inputs);
    const localized = localizeRecommendation(rec, inputs);

    expect(rec.title).toContain("Eigenvalues");
    expect(localized.reason).toContain("Eigenvalues");
    expect(localized.reason).toContain("in 3 days");
  });

  it("passes a null recommendation through untouched", () => {
    expect(localizeRecommendation(null, {})).toBeNull();
  });

  it("leaves a recommendation alone when the exam it names is gone", () => {
    const rec = { kind: "exam", examId: "missing", reason: "Exam in 2 days.", title: "X" };
    expect(localizeRecommendation(rec, { exams: [] }).reason).toBe("Exam in 2 days.");
  });
});
