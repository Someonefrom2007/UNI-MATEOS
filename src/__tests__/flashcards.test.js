// Flashcard engine — pure.
import { describe, it, expect } from "vitest";
import {
  createDeck,
  createCard,
  normalizeAnswer,
  answerMatches,
  shuffle,
  addDaysISO,
  gradeCard,
  dueCards,
  sessionQueue,
  sessionStats,
  isMastered,
} from "@/lib/flashcards";

const FIXED = "2026-09-20T10:00:00.000Z";
const now = () => FIXED;
const card = (over = {}) => createCard({ front: "f", back: "b", now, ...over });

describe("factories", () => {
  it("builds a deck row with repo-compatible defaults", () => {
    const d = createDeck({ title: "Linear Algebra", courseId: "c-1", now });
    expect(d).toMatchObject({ id: "", user_id: "", course_id: "c-1", title: "Linear Algebra", description: "" });
    expect(d.created_at).toBe(FIXED);
  });

  it("builds a card row and defaults due date to today", () => {
    const c = card({ deckId: "d-1", front: "Q", back: "A" });
    expect(c).toMatchObject({ deck_id: "d-1", front: "Q", back: "A", reviews: 0, interval: 0, last_result: null, due_date: "2026-09-20" });
  });
});

describe("normalizeAnswer / answerMatches", () => {
  it("normalizes case, punctuation and repeated spaces", () => {
    expect(normalizeAnswer("  Vector  SPACES! ")).toBe("vector spaces");
    expect(normalizeAnswer("Bessel's functions")).toBe("bessels functions");
    expect(normalizeAnswer("D'Algèbre,")).toBe("dalgèbre");
  });

  it("matches exact answers regardless of formatting", () => {
    expect(answerMatches("Vector spaces", "  VECTOR-SPACES? ")).toBe(true);
    expect(answerMatches("Bessel's functions", "bessels functions")).toBe(true);
    expect(answerMatches("a", "a")).toBe(true);
  });

  it("contains-match only for substantial given answers", () => {
    expect(answerMatches("Mitochondria is the powerhouse of the cell", "the powerhouse of the cell")).toBe(true);
    expect(answerMatches("short", "short extra junk words here")).toBe(true);
    expect(answerMatches("Mitochondria is the powerhouse of the cell", "the")).toBe(false);
    expect(answerMatches("", "x")).toBe(false);
    expect(answerMatches("x", "")).toBe(false);
  });
});

describe("shuffle", () => {
  it("is deterministic under an injected rng", () => {
    const rng = () => 0.5;
    const a = shuffle([1, 2, 3, 4], rng);
    const b = shuffle([1, 2, 3, 4], rng);
    expect(a).toEqual(b);
    expect(a).toHaveLength(4);
    expect([...a].sort()).toEqual([1, 2, 3, 4]);
  });
});

describe("addDaysISO / gradeCard scheduling", () => {
  it("rolls across month boundaries", () => {
    expect(addDaysISO("2026-09-20", 12)).toBe("2026-10-02");
    expect(addDaysISO("2026-09-20", 0)).toBe("2026-09-20");
  });

  it("again resets a new card to due today with zero streak", () => {
    const out = gradeCard(card(), "again", { now });
    expect(out.interval).toBe(0);
    expect(out.due_date).toBe("2026-09-20");
    expect(out.reviews).toBe(1);
    expect(out.streak).toBe(0);
  });

  it("new cards follow 1/3/7 day intro steps", () => {
    expect(gradeCard(card(), "hard", { now }).interval).toBe(1);
    expect(gradeCard(card(), "good", { now }).interval).toBe(3);
    expect(gradeCard(card(), "easy", { now }).interval).toBe(7);
  });

  it("reviewed cards grow by ease and adjust difficulty down on misses", () => {
    const c1 = gradeCard(card(), "good", { now });
    const c2 = gradeCard(c1, "good", { now });
    expect(c2.interval).toBe(Math.round(3 * c2.ease));
    expect(c2.due_date).toBe(addDaysISO("2026-09-20", c2.interval));
    expect(c2.streak).toBe(2);

    const easy = gradeCard(c1, "easy", { now });
    expect(easy.ease).toBeGreaterThan(c1.ease);
    const miss = gradeCard(c1, "hard", { now });
    expect(miss.ease).toBeLessThan(c1.ease);
    expect(miss.streak).toBe(2);
  });

  it("a failed reviewed card resets the gap and relearns through intro steps", () => {
    const good = gradeCard(card(), "good", { now });
    const failed = gradeCard(good, "again", { now });
    expect(failed.interval).toBe(0);
    expect(failed.due_date).toBe("2026-09-20");
    expect(failed.streak).toBe(0);
    const relearn = gradeCard(failed, "good", { now });
    expect(relearn.interval).toBe(3);
  });

  it("clamps ease into [1.3, 3]", () => {
    let c = card({ ease: 1.3 });
    for (let i = 0; i < 5; i += 1) c = gradeCard(c, "again", { now });
    expect(c.ease).toBe(1.3);
    let h = card({ ease: 3 });
    for (let i = 0; i < 5; i += 1) h = gradeCard(h, "easy", { now });
    expect(h.ease).toBe(3);
  });

  it("ignores unknown grades without mutating", () => {
    const c = card();
    expect(gradeCard(c, "maybe", { now })).toBe(c);
  });
});

describe("dueCards / sessionQueue / sessionStats", () => {
  it("collects never-reviewed and overdue cards, skipping future ones", () => {
    const old = { ...card({ front: "old" }), due_date: "2026-09-10", reviews: 2, interval: 0 };
    const fresh = card({ front: "fresh" });
    const future = gradeCard(card({ front: "future" }), "good", { now });
    const got = dueCards([old, fresh, future], "2026-09-20");
    expect(got.map((c) => c.front)).toEqual(["old", "fresh"]);
  });

  it("orders the queue by due date then creation", () => {
    const late = { ...card({ front: "late" }), created_at: "2026-09-19T00:00:00.000Z", due_date: "2026-09-10", reviews: 1 };
    const soon = { ...card({ front: "soon" }), created_at: "2026-09-18T00:00:00.000Z", due_date: "2026-09-20", reviews: 1 };
    expect(sessionQueue([late, soon], "2026-09-20").map((c) => c.front)).toEqual(["late", "soon"]);
  });

  it("caps the queue at the limit", () => {
    const cards = Array.from({ length: 30 }, (_, i) => card({ front: `c${i}` }));
    expect(sessionQueue(cards, "2026-09-20", { limit: 12 })).toHaveLength(12);
    expect(sessionQueue(cards, "2026-09-20", { limit: null })).toHaveLength(30);
  });

  it("computes deck stats", () => {
    const fresh = card({ front: "fresh" });
    const mastered = { ...card({ front: "mastered" }), interval: 25, reviews: 5, ease: 2.5, due_date: "2026-10-01" };
    const due = gradeCard(card({ front: "due" }), "again", { now });
    const stats = sessionStats([fresh, mastered, due], "2026-09-20");
    expect(stats).toMatchObject({ total: 3, fresh: 1, mastered: 1 });
    expect(stats.due).toBe(2);
    expect(stats.avgEase).toBeCloseTo(2.4, 1);
    expect(sessionStats([], "2026-09-20").avgEase).toBeNull();
  });

  it("isMastered flags far-future cards only", () => {
    expect(isMastered({ interval: 21 })).toBe(true);
    expect(isMastered({ interval: 8 })).toBe(false);
  });
});