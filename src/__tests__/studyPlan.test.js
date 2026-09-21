import { describe, expect, it } from "vitest";
import {
  PLAN_DEFAULTS,
  addDaysISO,
  daysBetween,
  generateStudyPlan,
  masteryBand,
  materializeItems,
  summarizePlan,
} from "@/lib/studyPlan";

const EXAM = {
  id: "exam-1",
  name: "Microeconomics midterm",
  course_id: "course-eco",
  date: "2026-05-15",
  weight: 40,
  status: "upcoming",
};

const topics = (masteries = {}) => [
  { id: "t-supply", course_id: "course-eco", name: "Supply & demand", mastery: masteries["t-supply"] ?? 30 },
  { id: "t-cost", course_id: "course-eco", name: "Cost curves", mastery: masteries["t-cost"] ?? 60 },
  { id: "t-game", course_id: "course-eco", name: "Game theory", mastery: masteries["t-game"] ?? 85 },
];

describe("daysBetween / addDaysISO (Europe/Madrid safe)", () => {
  it("counts whole days across the DST shift", () => {
    expect(daysBetween("2026-03-28", "2026-03-30")).toBe(2);
    expect(daysBetween("2026-10-30", "2026-11-01")).toBe(2);
    expect(daysBetween("2026-03-28", "2026-03-28")).toBe(0);
  });

  it("shifts dates without drifting back into UTC", () => {
    expect(addDaysISO("2026-03-27", 2)).toBe("2026-03-29");
    expect(addDaysISO("2026-05-15", -1)).toBe("2026-05-14");
  });
});

describe("masteryBand", () => {
  it("maps 0-100 into weak/mid/strong", () => {
    expect(masteryBand({ mastery: 0 })).toBe("weak");
    expect(masteryBand({ mastery: 49 })).toBe("weak");
    expect(masteryBand({ mastery: 50 })).toBe("mid");
    expect(masteryBand({ mastery: 74 })).toBe("mid");
    expect(masteryBand({ mastery: 75 })).toBe("strong");
    expect(masteryBand({ mastery: undefined })).toBe("weak");
  });
});

describe("generateStudyPlan", () => {
  const FROM_TODAY = { today: "2026-05-01" };

  it("returns nothing for a missing exam date or a past exam", () => {
    expect(generateStudyPlan({ ...EXAM, date: "" }, topics(), FROM_TODAY)).toEqual([]);
    expect(generateStudyPlan({ ...EXAM, date: "2026-04-01" }, topics(), FROM_TODAY)).toEqual([]);
  });

  it("renders a single exam-day pass when the exam is today", () => {
    const items = generateStudyPlan({ ...EXAM, date: "2026-05-01" }, topics(), FROM_TODAY);
    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe("exam_pass");
    expect(items[0].date).toBe("2026-05-01");
  });

  it("introduces every topic of the exam course and honors the 14-day default horizon", () => {
    const items = generateStudyPlan(EXAM, topics(), FROM_TODAY);
    const labels = items.filter((i) => i.topic_id).map((i) => i.label);
    expect(labels).toContain("Supply & demand");
    expect(labels).toContain("Cost curves");
    expect(labels).toContain("Game theory");
    expect(Math.max(...items.map((i) => daysBetween(FROM_TODAY.today, i.date)))).toBe(
      PLAN_DEFAULTS.daysBefore
    );
  });

  it("plans weakest topics first and adds spaced + eve reviews for them", () => {
    const items = generateStudyPlan(EXAM, topics(), FROM_TODAY);
    const byTopic = (id, kind) => items.filter((i) => i.topic_id === id && i.kind === kind);
    const introSupply = byTopic("t-supply", "weak_intro")[0];
    const introGame = byTopic("t-game", "strong_intro")[0];
    expect(introSupply.date.localeCompare(introGame.date)).toBeLessThan(0);
    expect(byTopic("t-supply", "weak_review")).toHaveLength(1);
    expect(byTopic("t-supply", "eve_review")).toHaveLength(1);
    expect(byTopic("t-game", "weak_review")).toHaveLength(0);
    expect(byTopic("t-game", "eve_review")).toHaveLength(0);
  });

  it("leaves the exam-day pass on the exam date as the final item", () => {
    const items = generateStudyPlan(EXAM, topics(), FROM_TODAY);
    const pass = items.filter((i) => i.kind === "exam_pass");
    expect(pass).toHaveLength(1);
    expect(pass[0].date).toBe(EXAM.date);
    expect(items[items.length - 1]).toEqual(pass[0]);
  });

  it("culls lower-priority sessions when the daily budget is tight", () => {
    const items = generateStudyPlan(EXAM, topics(), { ...FROM_TODAY, budgetMin: 30 });
    const totalByDay = {};
    items.forEach((i) => {
      totalByDay[i.date] = (totalByDay[i.date] || 0) + i.minutes;
    });
    Object.entries(totalByDay).forEach(([date, minutes]) => {
      const dayItems = items.filter((i) => i.date === date);
      if (minutes > 30) {
        expect(dayItems).toHaveLength(1);
      }
    });
    expect(items.some((i) => i.kind === "exam_pass")).toBe(true);
  });

  it("never drops the only item of a day", () => {
    const items = generateStudyPlan(EXAM, topics(), { ...FROM_TODAY, budgetMin: 1 });
    expect(items.filter((i) => i.kind === "exam_pass")).toHaveLength(1);
  });

  it("produces a deterministic output for identical inputs", () => {
    const a = generateStudyPlan(EXAM, topics(), FROM_TODAY);
    const b = generateStudyPlan(EXAM, topics(), FROM_TODAY);
    expect(a).toEqual(b);
  });

  it("falls back to a generic taper when the exam has no topics", () => {
    const items = generateStudyPlan(EXAM, [], FROM_TODAY);
    expect(items.some((i) => i.kind === "exam_pass")).toBe(true);
    expect(items.some((i) => i.label === "Exam-day pass")).toBe(true);
    expect(items.every((i) => i.topic_id === null)).toBe(true);
  });

  it("ignores topics from other courses", () => {
    const mixed = [
      ...topics(),
      { id: "t-other", course_id: "course-law", name: "Torts", mastery: 10 },
    ];
    const items = generateStudyPlan(EXAM, mixed, FROM_TODAY);
    expect(items.every((i) => i.topic_id !== "t-other")).toBe(true);
  });

  it("compresses when the exam is closer than the lookahead window", () => {
    const items = generateStudyPlan(EXAM, topics(), { today: "2026-05-12" });
    const latest = Math.max(...items.map((i) => daysBetween("2026-05-12", i.date)));
    expect(latest).toBe(3);
  });
});

describe("materializeItems + summarizePlan", () => {
  it("stamps plan_id and user_id onto generated items", () => {
    const items = generateStudyPlan(EXAM, topics(), { today: "2026-05-01" });
    const rows = materializeItems(items, "plan-abc", "me");
    expect(rows).toHaveLength(items.length);
    rows.forEach((r) => {
      expect(r.plan_id).toBe("plan-abc");
      expect(r.user_id).toBe("me");
    });
  });

  it("summarizes sessions, minutes, days, topics and reviews", () => {
    const items = generateStudyPlan(EXAM, topics(), { today: "2026-05-01" });
    const summary = summarizePlan(items);
    expect(summary.sessions).toBe(items.length);
    expect(summary.minutes).toBe(items.reduce((s, i) => s + i.minutes, 0));
    expect(summary.topics).toBe(3);
    expect(summary.reviews).toBeGreaterThan(0);
    expect(summary.days).toBeGreaterThan(1);
  });

  it("summarizes an empty plan to zeros", () => {
    expect(summarizePlan([])).toEqual({ sessions: 0, minutes: 0, days: 0, topics: 0, reviews: 0 });
  });
});