import { describe, expect, it } from "vitest";
import {
  examPriority,
  masteryToScore,
  offsetDate,
  planRevisionSchedule,
  readinessBand,
  readinessBoard,
  readinessScore,
  recommendedMinutes,
  studyMinutesFor,
  topicMasteryScore,
} from "@/lib/examReadiness";

const TODAY = "2026-03-01";
const examOn = (date, extra = {}) => ({ id: "e1", name: "Analysis", date, weight: 20, ...extra });

describe("recommendedMinutes", () => {
  it("scales with weight but keeps a floor and a ceiling", () => {
    expect(recommendedMinutes(20)).toBe(900);
    expect(recommendedMinutes(0)).toBe(120);
    expect(recommendedMinutes(100)).toBe(900);
  });

  it("treats junk and negatives as no weight", () => {
    expect(recommendedMinutes(-5)).toBe(120);
    expect(recommendedMinutes(null)).toBe(120);
    expect(recommendedMinutes("nonsense")).toBe(120);
  });
});

describe("studyMinutesFor", () => {
  const sessions = [
    { exam_id: "e1", duration: 50, completed: true },
    { exam_id: "e1", duration: 30, completed: true },
    { exam_id: "other", duration: 999, completed: true },
  ];

  it("sums only completed sessions for that exam", () => {
    expect(studyMinutesFor(sessions, "e1")).toBe(80);
  });

  it("ignores abandoned sessions so timers cannot inflate readiness", () => {
    const abandoned = [{ exam_id: "e1", duration: 120, completed: false }];
    expect(studyMinutesFor(abandoned, "e1")).toBe(0);
  });

  it("survives an empty or missing list", () => {
    expect(studyMinutesFor([], "e1")).toBe(0);
    expect(studyMinutesFor(undefined, "e1")).toBe(0);
  });
});

describe("masteryToScore", () => {
  it("maps 1 to 0 and 5 to 100 so no-confidence is genuinely zero", () => {
    expect(masteryToScore([1])).toBe(0);
    expect(masteryToScore([5])).toBe(100);
  });

  it("averages the 1-5 scale and accepts topic objects", () => {
    expect(masteryToScore([1, 5])).toBe(50);
    expect(masteryToScore([{ mastery: 3 }, { mastery: 3 }])).toBe(50);
  });

  it("returns null when there is nothing to average", () => {
    expect(masteryToScore([])).toBeNull();
    expect(masteryToScore(undefined)).toBeNull();
  });

  it("discards out-of-range and non-numeric ratings instead of skewing the mean", () => {
    expect(masteryToScore([5, 9, -2, null, "x"])).toBe(100);
  });
});

describe("topicMasteryScore", () => {
  it("averages the 0-100 mastery the Exams UI already stores", () => {
    expect(topicMasteryScore([{ mastery: 100 }, { mastery: 0 }])).toBe(50);
    expect(topicMasteryScore([{ mastery: 80 }])).toBe(80);
  });

  it("clamps out-of-range values instead of skewing the mean", () => {
    expect(topicMasteryScore([{ mastery: 140 }, { mastery: -20 }])).toBe(50);
  });

  it("returns null when no topic is rated", () => {
    expect(topicMasteryScore([])).toBeNull();
    expect(topicMasteryScore([{ name: "Limits" }])).toBeNull();
  });
});

describe("readinessScore mastery sources", () => {
  it("uses a 0-100 masteryScore when given, rather than dropping it as out-of-range", () => {
    const r = readinessScore({
      exam: examOn("2026-03-08"),
      masteryScore: 60,
      masteryRatings: [],
      todayStr: TODAY,
    });
    expect(r.mastery).toBe(60);
  });

  it("prefers masteryScore over 1-5 ratings when both are supplied", () => {
    const r = readinessScore({ exam: examOn("2026-03-08"), masteryScore: 20, masteryRatings: [5], todayStr: TODAY });
    expect(r.mastery).toBe(20);
  });
});

describe("readinessBand", () => {
  it("thresholds 80 / 55 / 30", () => {
    expect(readinessBand(100)).toBe("ready");
    expect(readinessBand(80)).toBe("ready");
    expect(readinessBand(79)).toBe("getting-there");
    expect(readinessBand(55)).toBe("getting-there");
    expect(readinessBand(30)).toBe("behind");
    expect(readinessBand(29)).toBe("at-risk");
  });
});

describe("readinessScore", () => {
  it("is 100% ready with full mastery and study finished well ahead", () => {
    const r = readinessScore({
      exam: examOn("2026-03-08"), // 7 days out
      focusSessions: [{ exam_id: "e1", duration: 900, completed: true }],
      masteryRatings: [5],
      todayStr: TODAY,
    });
    expect(r.score).toBe(100);
    expect(r.band).toBe("ready");
    expect(r.daysLeft).toBe(7);
    expect(r.components).toEqual({ mastery: 100, coverage: 100, pace: 100 });
  });

  it("is 0 with no mastery, no study, and the exam on the day", () => {
    const r = readinessScore({ exam: examOn(TODAY), todayStr: TODAY });
    expect(r.score).toBe(0);
    expect(r.band).toBe("at-risk");
    expect(r.pace).toBe(0);
  });

  it("counts 100% completed study blocks as full coverage", () => {
    const r = readinessScore({
      exam: examOn("2026-03-08", { weight: 10 }), // needs 450
      focusSessions: [{ exam_id: "e1", duration: 450, completed: true }],
      todayStr: TODAY,
    });
    expect(r.minutesNeeded).toBe(450);
    expect(r.minutesDone).toBe(450);
    expect(r.coverage).toBe(100);
  });

  it("scores a past exam as done rather than as unprepared", () => {
    const r = readinessScore({ exam: examOn("2026-02-01"), masteryRatings: [1], todayStr: TODAY });
    expect(r.past).toBe(true);
    expect(r.done).toBe(true);
    expect(r.score).toBe(100);
    expect(r.band).toBe("done");
  });

  it("treats a completed exam as history even when its date is ahead", () => {
    const r = readinessScore({ exam: examOn("2026-03-20", { status: "completed" }), masteryRatings: [1], todayStr: TODAY });
    expect(r.done).toBe(true);
    expect(r.score).toBe(100);
  });

  it("re-weights across the components that exist when mastery is unrated", () => {
    const r = readinessScore({
      exam: examOn("2026-03-08"),
      focusSessions: [{ exam_id: "e1", duration: 450, completed: true }], // 50% coverage
      masteryRatings: [],
      todayStr: TODAY,
    });
    expect(r.mastery).toBeNull();
    // (50*35 + 100*20) / 55
    expect(r.score).toBe(68);
  });

  it("reports zero rather than dividing by zero with no signal at all", () => {
    const r = readinessScore({ exam: examOn("2026-03-08"), todayStr: TODAY });
    expect(r.score).toBe(0);
    expect(r.pace).toBe(0);
  });

  it("penalises having less time left for the same work, not just fewer totals", () => {
    // Identical 25% of the target done either way; only the window differs.
    const done = [{ exam_id: "e1", duration: 225, completed: true }];
    const exam = examOn("2026-03-08", { weight: 20 }); // needs 900
    const moreTime = readinessScore({ exam, focusSessions: done, masteryRatings: [5], todayStr: TODAY });
    const lessTime = readinessScore({ exam, focusSessions: done, masteryRatings: [5], todayStr: "2026-03-06" });

    // 1/8 of the window burnt at 25% done is comfortably ahead; 1/3 burnt is behind.
    expect(moreTime.pace).toBe(100);
    expect(lessTime.pace).toBe(75);
    expect(lessTime.pace).toBeLessThan(moreTime.pace);
  });

  it("awards full pace when the window is over and the work is done", () => {
    const r = readinessScore({
      exam: examOn(TODAY, { weight: 10 }),
      focusSessions: [{ exam_id: "e1", duration: 450, completed: true }],
      todayStr: TODAY,
    });
    expect(r.pace).toBe(100);
  });

  it("leaves daysLeft null for an undated exam instead of guessing", () => {
    const r = readinessScore({ exam: { id: "e1", name: "TBA", weight: 10 }, todayStr: TODAY });
    expect(r.daysLeft).toBeNull();
    expect(r.pace).toBeNull();
    expect(Number.isFinite(r.score)).toBe(true);
  });

  it("is pure — identical input gives an identical score", () => {
    const args = { exam: examOn("2026-03-08"), masteryRatings: [3, 4], todayStr: TODAY };
    expect(readinessScore(args)).toEqual(readinessScore(args));
  });
});

describe("examPriority", () => {
  it("is normal when nothing is wrong", () => {
    const p = examPriority({
      exam: examOn("2026-03-08", { expected_grade: 8 }),
      course: { target_grade: 7 },
      readiness: { score: 90 },
      todayStr: TODAY,
    });
    expect(p.level).toBe("normal");
    expect(p.reasons).toEqual([]);
  });

  it("flags a projection under the 5/10 pass threshold", () => {
    const p = examPriority({ exam: examOn("2026-03-08", { expected_grade: 3 }), todayStr: TODAY });
    expect(p.level).toBe("high");
    expect(p.reasons[0].key).toBe("below-pass");
  });

  it("flags falling short of the course target grade", () => {
    const p = examPriority({
      exam: examOn("2026-03-08", { expected_grade: 6 }),
      course: { target_grade: 8 },
      todayStr: TODAY,
    });
    expect(p.reasons.map((r) => r.key)).toContain("below-target");
  });

  it("flags low readiness only when the exam is within a week", () => {
    const soon = examPriority({ exam: examOn("2026-03-05"), readiness: { score: 20 }, todayStr: TODAY });
    const later = examPriority({ exam: examOn("2026-04-20"), readiness: { score: 20 }, todayStr: TODAY });
    expect(soon.reasons.map((r) => r.key)).toContain("unprepared-soon");
    expect(later.reasons.map((r) => r.key)).not.toContain("unprepared-soon");
  });

  it("escalates to critical on two or more signals", () => {
    const p = examPriority({
      exam: examOn("2026-03-03", { expected_grade: 2 }),
      course: { target_grade: 8 },
      readiness: { score: 10 },
      todayStr: TODAY,
    });
    expect(p.level).toBe("critical");
    expect(p.reasons.length).toBe(3);
  });
});

describe("planRevisionSchedule", () => {
  it("spaces blocks with growing gaps and never lands on or after the exam", () => {
    const plan = planRevisionSchedule({ exam: examOn("2026-03-10"), todayStr: TODAY });
    expect(plan.map((b) => b.daysOut)).toEqual([0, 1, 3, 7]);
    for (const b of plan) {
      expect(b.date < "2026-03-10").toBe(true);
      expect(b.minutes).toBeGreaterThan(0);
    }
  });

  it("gaps widen monotonically (spaced repetition, not evenly spaced)", () => {
    const plan = planRevisionSchedule({ exam: examOn("2026-03-10"), todayStr: TODAY });
    const gaps = plan.slice(1).map((b, i) => b.daysOut - plan[i].daysOut);
    expect(gaps).toEqual([1, 2, 4]);
  });

  it("emits one final cram block when the exam is today", () => {
    const plan = planRevisionSchedule({ exam: examOn(TODAY), todayStr: TODAY });
    expect(plan).toHaveLength(1);
    expect(plan[0]).toMatchObject({ date: TODAY, daysOut: 0, focus: "Final review" });
  });

  it("returns nothing for a past exam", () => {
    expect(planRevisionSchedule({ exam: examOn("2026-01-01"), todayStr: TODAY })).toEqual([]);
  });

  it("returns nothing for an undated exam", () => {
    expect(planRevisionSchedule({ exam: { weight: 20 }, todayStr: TODAY })).toEqual([]);
  });

  it("shrinks to the available window for a tomorrow exam", () => {
    const plan = planRevisionSchedule({ exam: examOn("2026-03-02"), todayStr: TODAY });
    expect(plan).toHaveLength(1);
    expect(plan[0].date).toBe(TODAY);
  });

  it("respects the sessions cap and gives longer blocks when asked for fewer", () => {
    const many = planRevisionSchedule({ exam: examOn("2026-03-10"), todayStr: TODAY });
    const few = planRevisionSchedule({ exam: examOn("2026-03-10"), todayStr: TODAY, sessions: 2 });
    expect(few).toHaveLength(2);
    const sum = (p) => p.reduce((s, b) => s + b.minutes, 0);
    expect(sum(few)).toBeGreaterThan(sum(many) / 2);
  });

  it("labels the early passes as recall and later ones as consolidation", () => {
    const plan = planRevisionSchedule({ exam: examOn("2026-03-10"), todayStr: TODAY });
    expect(plan[0].focus).toBe("Recall drill");
    expect(plan[plan.length - 1].focus).toBe("Full review");
  });

  it("keeps every block inside a sane per-session range", () => {
    const plan = planRevisionSchedule({ exam: examOn("2026-03-10", { weight: 100 }), todayStr: TODAY });
    for (const b of plan) {
      expect(b.minutes).toBeGreaterThanOrEqual(15);
      expect(b.minutes).toBeLessThanOrEqual(180);
      expect(b.minutes % 5).toBe(0);
    }
  });
});

describe("offsetDate", () => {
  it("adds days without rolling the clock", () => {
    expect(offsetDate("2026-03-01", 0)).toBe("2026-03-01");
    expect(offsetDate("2026-03-01", 7)).toBe("2026-03-08");
  });

  it("crosses month and year boundaries", () => {
    expect(offsetDate("2026-01-30", 3)).toBe("2026-02-02");
    expect(offsetDate("2026-12-30", 3)).toBe("2027-01-02");
  });
});

describe("readinessBoard", () => {
  const courses = [{ id: "c1", name: "Maths", target_grade: 7 }];
  const exams = [
    { id: "e1", name: "Quiz", course_id: "c1", date: "2026-03-03", weight: 5 },
    { id: "e2", name: "Final", course_id: "c1", date: "2026-03-06", weight: 40, expected_grade: 3 },
    { id: "e3", name: "Later", course_id: "c1", date: "2026-04-20", weight: 10 },
    { id: "e4", name: "Done", course_id: "c1", date: "2026-03-02", status: "completed" },
  ];

  it("keeps only upcoming exams inside the window, soonest first", () => {
    const board = readinessBoard({ exams, courses, todayStr: TODAY, withinDays: 7 });
    expect(board.map((r) => r.exam.id)).toEqual(["e1", "e2"]);
  });

  it("sets a countdown badge inside the window and null outside it", () => {
    const board = readinessBoard({ exams, courses, todayStr: TODAY, withinDays: 7 });
    expect(board[0].countdown).toBe(2);
    expect(board[1].countdown).toBe(5);
    expect(readinessBoard({ exams, courses, todayStr: TODAY, withinDays: 2 })
      .map((r) => r.exam.id)).toEqual(["e1"]);
  });

  it("drops past exams even when they are within the window width", () => {
    const board = readinessBoard({
      exams: [...exams, { id: "e5", name: "Missed", course_id: "c1", date: "2026-02-20" }],
      courses, todayStr: TODAY,
    });
    expect(board.map((r) => r.exam.id)).not.toContain("e5");
  });

  it("attaches readiness, priority, and the joined course to each row", () => {
    const board = readinessBoard({ exams, courses, todayStr: TODAY });
    const final = board.find((r) => r.exam.id === "e2");
    expect(final.course.name).toBe("Maths");
    expect(typeof final.readiness.score).toBe("number");
    expect(final.priority.level).toBe("critical");
    expect(final.priority.reasons.map((r) => r.key)).toEqual(["below-pass", "below-target", "unprepared-soon"]);
  });

  it("returns an empty board rather than throwing on no data", () => {
    expect(readinessBoard({ todayStr: TODAY })).toEqual([]);
  });
});
