import { describe, expect, it } from "vitest";
import {
  AI_STATUS,
  buildFlashcards,
  classifyInvokeResult,
  detectIntent,
  heuristicReply,
  isHeuristic,
  keypoints,
  offlineResponse,
  studyPlanPrompt,
  summarizeNote,
  triageAssignments,
} from "@/lib/aiAssistant";

const TODAY = "2026-03-01";
const ctx = () => ({
  tasks: [],
  courses: [],
  exams: [],
  notes: [],
  stickies: [],
  focusSessions: [],
  todayStr: TODAY,
});

describe("AI_STATUS", () => {
  it("labels the heuristic mode exactly as the UI advertises it", () => {
    expect(AI_STATUS.OFFLINE_HEURISTIC).toBe("OFFLINE MODE (HEURISTIC)");
  });

  it("treats only a real model reply as non-heuristic", () => {
    expect(isHeuristic(AI_STATUS.ONLINE)).toBe(false);
    expect(isHeuristic(AI_STATUS.DEGRADED)).toBe(true);
    expect(isHeuristic(AI_STATUS.UNAVAILABLE)).toBe(true);
    expect(isHeuristic(AI_STATUS.OFFLINE_HEURISTIC)).toBe(true);
  });
});

describe("classifyInvokeResult", () => {
  it("reports ONLINE for a real reply", () => {
    expect(classifyInvokeResult({ data: { reply: "hi" } })).toEqual({ status: AI_STATUS.ONLINE, reply: "hi", reason: null });
  });

  it("treats a blank reply as degraded, not as a success", () => {
    expect(classifyInvokeResult({ data: { reply: "   " } }).status).toBe(AI_STATUS.DEGRADED);
  });

  it("does NOT throw-path on a server 500 — flags it degraded with the server's reason", () => {
    // The bug this guards: invoke() resolves with {data,error} on non-2xx, so a
    // 500 used to surface as "couldn't answer, try rephrasing".
    const r = classifyInvokeResult({ data: { error: "model timeout" } });
    expect(r.status).toBe(AI_STATUS.DEGRADED);
    expect(r.reason).toBe("model timeout");
  });

  it("flags a transport error or missing response as unavailable", () => {
    expect(classifyInvokeResult({ error: { message: "fetch failed" } })).toEqual({
      status: AI_STATUS.UNAVAILABLE, reply: null, reason: "fetch failed",
    });
    expect(classifyInvokeResult(undefined).status).toBe(AI_STATUS.UNAVAILABLE);
  });

  it("distinguishes a plan lock from a generic failure", () => {
    const r = classifyInvokeResult({ data: { locked: true, error: "AI Assistant is a Pro feature" } });
    expect(r.status).toBe(AI_STATUS.DEGRADED);
    expect(r.reason).toBe("AI Assistant is a Pro feature");
  });

  it("flags an empty 200 as degraded rather than pretending it worked", () => {
    expect(classifyInvokeResult({ data: {} }).status).toBe(AI_STATUS.DEGRADED);
    expect(classifyInvokeResult({ data: {} }).reason).toBe("empty-response");
  });
});

describe("triageAssignments", () => {
  const task = (title, due, priority = "medium", extra = {}) => ({
    id: title, title, due_date: due, priority, status: "todo", ...extra,
  });

  it("ignores completed work", () => {
    const r = triageAssignments([task("Done", "2026-01-01", "urgent", { status: "completed" })], { todayStr: TODAY });
    expect(r).toEqual([]);
  });

  it("puts an overdue task above an urgent one due in three weeks", () => {
    const r = triageAssignments(
      [task("Soon", "2026-03-20", "urgent"), task("Missed", "2026-02-25", "low")],
      { todayStr: TODAY },
    );
    expect(r[0].task.title).toBe("Missed");
    expect(r[0].reason).toMatch(/^overdue by/);
  });

  it("orders by nearest due date within the same priority", () => {
    const r = triageAssignments(
      [task("Later", "2026-03-10"), task("Sooner", "2026-03-02")],
      { todayStr: TODAY },
    );
    expect(r.map((x) => x.task.title)).toEqual(["Sooner", "Later"]);
  });

  it("explains the reason in plain words", () => {
    const reasons = (tasks) => triageAssignments(tasks, { todayStr: TODAY }).map((r) => r.reason);
    expect(reasons([task("a", "2026-03-01")])).toEqual(["due today"]);
    expect(reasons([task("a", "2026-03-02")])).toEqual(["due tomorrow"]);
    expect(reasons([task("a", "2026-03-05")])).toEqual(["due in 4 days"]);
    expect(reasons([task("a", null)])).toEqual(["no due date"]);
    expect(reasons([task("a", "2026-02-27")])).toEqual(["overdue by 2 days"]);
  });

  it("singularises a one-day overdue message", () => {
    const r = triageAssignments([task("a", "2026-02-28")], { todayStr: TODAY });
    expect(r[0].reason).toBe("overdue by 1 day");
  });

  it("breaks score ties by title so the order is stable", () => {
    const r = triageAssignments([task("Zebra", "2026-03-03"), task("Apple", "2026-03-03")], { todayStr: TODAY });
    expect(r.map((x) => x.task.title)).toEqual(["Apple", "Zebra"]);
  });

  it("honours the limit and treats unknown priority as medium", () => {
    const tasks = [1, 2, 3, 4].map((i) => task(`t${i}`, "2026-03-05", "bogus"));
    expect(triageAssignments(tasks, { todayStr: TODAY, limit: 2 })).toHaveLength(2);
    const [a, b] = triageAssignments(tasks, { todayStr: TODAY, limit: 2 });
    expect(a.score).toBe(b.score);
  });

  it("does not blow up on a missing task list", () => {
    expect(triageAssignments(undefined, { todayStr: TODAY })).toEqual([]);
  });
});

describe("studyPlanPrompt", () => {
  const courses = [{ id: "c1", name: "Stats", target_grade: 7 }];
  const exams = [
    { id: "e1", name: "Midterm", course_id: "c1", date: "2026-03-03", weight: 30 },
    { id: "e2", name: "Final", course_id: "c1", date: "2026-03-20", weight: 50 },
  ];

  it("orders the least-ready exam first", () => {
    const plan = studyPlanPrompt({
      exams, courses, todayStr: TODAY,
      focusSessions: [{ exam_id: "e1", duration: 900, completed: true }],
    });
    expect(plan[0].exam.id).toBe("e2");
  });

  it("attaches a dated revision plan to each exam", () => {
    const plan = studyPlanPrompt({ exams, courses, todayStr: TODAY });
    expect(plan[0].blocks[0].date).toBe(TODAY);
    expect(plan.every((p) => p.readiness.score >= 0 && p.readiness.score <= 100)).toBe(true);
  });

  it("returns nothing when no exam is in the window", () => {
    expect(studyPlanPrompt({ exams: [], courses, todayStr: TODAY })).toEqual([]);
  });
});

describe("keypoints", () => {
  it("pulls explicit Q/A lines first", () => {
    const pts = keypoints("Q: Photosynthesis converts light into chemical energy stored in glucose.\nSomething unrelated.");
    expect(pts[0]).toMatch(/Photosynthesis/);
  });

  it("prefers the author's own bullets", () => {
    const pts = keypoints("intro noise\n- The heart has four chambers that pump blood around the body.\n- Lungs exchange oxygen.");
    expect(pts.some((p) => /four chambers/.test(p))).toBe(true);
  });

  it("extracts the right-hand side of a definition", () => {
    const pts = keypoints("Mitosis is the process by which a cell divides into two identical daughter cells.");
    expect(pts[0]).toMatch(/divides into two identical daughter cells/);
  });

  it("strips list labels and trailing punctuation", () => {
    const pts = keypoints("Important: Water boils at one hundred degrees Celsius at sea level pressure.");
    expect(pts[0]).not.toMatch(/^[-*•]/);
    expect(pts[0]).not.toMatch(/^Important/);
  });

  it("deduplicates and never exceeds the limit", () => {
    const line = "- The mitochondria is the powerhouse of the cell and produces most ATP.";
    expect(keypoints([line, line, line].join("\n"), { limit: 2 }).length).toBeLessThanOrEqual(2);
  });

  it("falls back to the longest sentence for pure prose", () => {
    const pts = keypoints("Short one. A considerably longer sentence carrying the bulk of the actual information here.");
    expect(pts[0].length).toBeGreaterThan(20);
  });

  it("returns nothing for empty input instead of throwing", () => {
    expect(keypoints("")).toEqual([]);
    expect(keypoints(undefined)).toEqual([]);
  });

  it("ignores lines too short to be informative", () => {
    expect(keypoints("Ok.\nYes.")).toEqual([]);
  });
});

describe("buildFlashcards", () => {
  it("builds a card from a definition", () => {
    const cards = buildFlashcards("Mitosis is the division of a cell into two identical daughter cells.");
    expect(cards[0].front).toBe("What is Mitosis?");
    expect(cards[0].back).toMatch(/daughter cells/);
  });

  it("builds a card from a bullet definition", () => {
    const cards = buildFlashcards("- Osmosis is the movement of water across a semipermeable membrane.");
    expect(cards[0].front).toBe("What is Osmosis?");
  });

  it("uses the term for 'means' phrasings", () => {
    const cards = buildFlashcards("Homeostasis means the maintenance of a stable internal environment.");
    expect(cards[0].front).toBe("What does Homeostasis mean?");
  });

  it("keeps an explicit Q/A pair intact, minus the trailing full stop", () => {
    const cards = buildFlashcards("Q: What is entropy? A: A measure of disorder in a system.");
    expect(cards[0]).toEqual({ front: "What is entropy?", back: "A measure of disorder in a system" });
  });

  it("does not eat the dot on an abbreviation", () => {
    const cards = buildFlashcards("U.S. is the currency system used in the United States of America.");
    expect(cards[0].back).toBe("the currency system used in the United States of America");
    expect(buildFlashcards("GDP stands for Gross Domestic Product, U.S.")[0].back).toContain("U.S.");
  });

  it("drops a question with no answer rather than emit an empty back", () => {
    expect(buildFlashcards("Q: What is entropy?")).toEqual([]);
  });

  it("returns nothing when the text holds no definitions", () => {
    expect(buildFlashcards("It was a dark and stormy night.")).toEqual([]);
  });

  it("honours the limit and never repeats a front", () => {
    const cards = buildFlashcards("A is one definition here.\nB is another definition there.\nC is a third one as well.", { limit: 2 });
    expect(cards.length).toBeLessThanOrEqual(2);
    expect(new Set(cards.map((c) => c.front)).size).toBe(cards.length);
  });

  it("is safe on empty input", () => {
    expect(buildFlashcards("")).toEqual([]);
  });
});

describe("summarizeNote", () => {
  it("returns numbered keypoints and a word count", () => {
    const { points, words, summary } = summarizeNote("Mitosis is the division of a cell into two identical daughter cells.");
    expect(points).toHaveLength(1);
    expect(summary).toMatch(/^1\. /);
    expect(words).toBeGreaterThan(5);
  });

  it("stays empty rather than inventing content for a blank note", () => {
    expect(summarizeNote("")).toEqual({ points: [], words: 0, summary: "" });
  });
});

describe("detectIntent", () => {
  it("routes the four supported intents", () => {
    expect(detectIntent("what should I do today?")).toBe("triage");
    expect(detectIntent("prioritise my tasks")).toBe("triage");
    expect(detectIntent("build me a study plan")).toBe("study");
    expect(detectIntent("make flashcards")).toBe("flashcards");
    expect(detectIntent("summarise this note")).toBe("summary");
  });

  it("returns null when nothing matches", () => {
    expect(detectIntent("hello")).toBeNull();
    expect(detectIntent("")).toBeNull();
  });
});

describe("heuristicReply", () => {
  it("answers a triage question from real tasks", () => {
    const text = heuristicReply("what should I do today?", {
      ...ctx(),
      tasks: [{ id: "t1", title: "Lab report", due_date: TODAY, priority: "high", status: "todo" }],
    });
    expect(text).toMatch(/Lab report/);
    expect(text).toMatch(/Priority order/);
  });

  it("answers a study question with readiness numbers", () => {
    const text = heuristicReply("make me a study plan", {
      ...ctx(),
      courses: [{ id: "c1", name: "Stats" }],
      exams: [{ id: "e1", name: "Midterm", course_id: "c1", date: "2026-03-05", weight: 30 }],
    });
    expect(text).toMatch(/Midterm/);
    expect(text).toMatch(/% ready/);
  });

  it("answers a flashcard request with real cards", () => {
    const text = heuristicReply("make flashcards", {
      ...ctx(),
      notes: [{ title: "Bio", content: "Mitosis is the division of a cell into two identical daughter cells." }],
    });
    expect(text).toMatch(/flashcards/);
    expect(text).toMatch(/What is Mitosis\?/);
  });

  it("summarises a note when asked", () => {
    const text = heuristicReply("summarise my notes", {
      ...ctx(),
      notes: [{ title: "Photosynthesis", content: "- Plants convert light energy into chemical energy stored as glucose." }],
    });
    expect(text).toMatch(/Key points from "Photosynthesis"/);
  });

  it("falls back to stickies when there are no notes", () => {
    const text = heuristicReply("summarise", {
      ...ctx(),
      stickies: [{ content: "Remember the deadline is Friday for the lab report." }],
    });
    expect(text).toMatch(/Key points/);
  });

  it("never claims to have no data when it simply has none of that kind", () => {
    const text = heuristicReply("what should I do today?", { ...ctx() });
    expect(text).toMatch(/No open tasks/);
  });

  it("does not let an untitled note hijack note selection", () => {
    // Regression: `"summarise".includes("")` is true, so an empty title used to
    // match every prompt and outrank notes[0].
    const text = heuristicReply("summarise", {
      ...ctx(),
      notes: [
        { title: "Alpha", content: "- First note content that is long enough." },
        { title: "", content: "- Second note content that is long enough." },
      ],
    });
    expect(text).toMatch(/Key points from "Alpha"/);
    expect(text).toMatch(/First note/);
  });

  it("still picks the note the prompt actually names", () => {
    const text = heuristicReply("summarise Genetics please", {
      ...ctx(),
      notes: [
        { title: "Alpha", content: "- First note content that is long enough." },
        { title: "Genetics", content: "- The named note content that is long enough." },
      ],
    });
    expect(text).toMatch(/Key points from "Genetics"/);
  });

  it("never renders the literal string undefined for an untitled note", () => {
    const text = heuristicReply("summarise", {
      ...ctx(),
      notes: [{ content: "- A body with no title field at all, long enough here." }],
    });
    expect(text).not.toMatch(/undefined/);
    expect(text).toMatch(/Key points from "your note"/);
  });

  it("does not hallucinate a plan with no exams", () => {
    expect(heuristicReply("make me a study plan", ctx())).toMatch(/No exams scheduled/);
  });
});

describe("offlineResponse", () => {
  it("always returns displayable text so the chat never renders an empty bubble", () => {
    const r = offlineResponse("what should I do today?", { ...ctx(), hasData: false });
    expect(typeof r.text).toBe("string");
    expect(r.text.length).toBeGreaterThan(0);
  });

  it("flags itself as heuristic and labels the mode", () => {
    const r = offlineResponse("hello", { ...ctx() });
    expect(r.status).toBe(AI_STATUS.OFFLINE_HEURISTIC);
    expect(r.heuristic).toBe(true);
  });

  it("swallows a generator crash rather than breaking the chat", () => {
    const exploding = {
      ...ctx(),
      get tasks() { throw new Error("boom"); },
    };
    const r = offlineResponse("what should I do today?", exploding);
    expect(r.text).toMatch(/couldn't compute an answer/);
  });

  it("reports degraded status honestly when the edge function errored", () => {
    const r = offlineResponse("summarise", { ...ctx(), status: AI_STATUS.DEGRADED });
    expect(r.status).toBe(AI_STATUS.DEGRADED);
    expect(r.heuristic).toBe(true);
  });

  it("is deterministic — same question, same answer", () => {
    const input = ["what should I do today?", { ...ctx(), tasks: [{ id: "1", title: "A", due_date: TODAY, priority: "high", status: "todo" }] }];
    expect(offlineResponse(...input)).toEqual(offlineResponse(...input));
  });
});
