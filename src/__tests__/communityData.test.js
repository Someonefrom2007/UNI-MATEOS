import { describe, it, expect } from "vitest";
import {
  CONTENT_TYPES,
  contentType,
  MODERATION,
  moderationMeta,
  canTransition,
  applyModeration,
  effectiveStatus,
  reportReasons,
  newReport,
  toggleSaved,
  isVisible,
  feedFilter,
  applyFilters,
  sortPosts,
  decoratePosts,
  authorIdentity,
  identityGradient,
  timeAgo,
} from "@/lib/communityData";

const post = (overrides = {}) => ({
  id: "p1",
  user_id: "u-a",
  title: "How do exams work?",
  content: "Looking for advice.",
  type: "question",
  status: "active",
  created_at: "2026-09-01T10:00:00Z",
  ...overrides,
});

const like = (postId, userId) => ({ id: `l-${userId}-${postId}`, post_id: postId, user_id: userId });
const reply = (postId) => ({ id: `r-${postId}`, post_id: postId, content: "hi", user_id: "u-b" });

describe("Community: content types", () => {
  it("registers all six directive content types in order with question first", () => {
    expect(CONTENT_TYPES.map((t) => t.value)).toEqual(["question", "tip", "win", "resource", "event", "announcement"]);
  });

  it("looks up a type and falls back to question for unknown values", () => {
    expect(contentType("tip").label).toBe("Tip");
    expect(contentType("nope").label).toBe("Question");
  });
});

describe("Community: moderation state machine", () => {
  it("starts every post active and legacy rows default to active", () => {
    expect(effectiveStatus(post())).toBe("active");
    expect(effectiveStatus({ id: "x" })).toBe("active");
  });

  it("allows self-hide and restore, mod remove and pending approval", () => {
    expect(canTransition("active", "self_hide")).toBe(true);
    expect(canTransition("active", "mod_remove")).toBe(true);
    expect(canTransition("hidden", "self_restore")).toBe(true);
    expect(canTransition("pending", "mod_approve")).toBe(true);
    expect(canTransition("active", "mod_approve")).toBe(false);
  });

  it("applies transitions and keeps illegal moves unchanged", () => {
    expect(applyModeration("active", "self_hide")).toBe(MODERATION.HIDDEN);
    expect(applyModeration("hidden", "self_restore")).toBe(MODERATION.ACTIVE);
    expect(applyModeration("pending", "mod_remove")).toBe(MODERATION.REMOVED);
    expect(applyModeration("active", "self_restore")).toBe("active");
  });

  it("always returns a matching moderation meta for any status", () => {
    expect(moderationMeta("active").label).toBe("Active");
    expect(moderationMeta("removed").label).toBe("Removed by moderators");
  });
});

describe("Community: saves and reports", () => {
  it("toggles saved ids immutably", () => {
    let set = new Set();
    set = toggleSaved(set, "p1");
    set = toggleSaved(set, "p1");
    expect(set.has("p1")).toBe(false);
    set = toggleSaved(set, "p1");
    expect([...set]).toEqual(["p1"]);
  });

  it("creates a normalized open report", () => {
    const r = newReport({ postId: "p1", reason: "spam", userId: "u-x", idFactory: () => "rpt-1" });
    expect(r).toMatchObject({ id: "rpt-1", post_id: "p1", user_id: "u-x", reason: "spam", status: "open" });
    expect(rptHasMeta(reportReasons, r.reason)).toBe(true);
  });
});

const rptHasMeta = (list, reason) => list.includes(reason);

describe("Community: feeds, filters, sorting", () => {
  const a = post({ id: "a", user_id: "u-a", created_at: "2026-09-02T10:00:00Z" });
  const b = post({ id: "b", user_id: "u-b", created_at: "2026-09-03T10:00:00Z" });
  const hidden = post({ id: "c", user_id: "u-b", status: "hidden" });

  it("never shows other users' hidden or removed posts in discover", () => {
    const rows = [a, b, hidden];
    expect(feedFilter(rows, { feed: "discover", userId: "u-a" }).map((p) => p.id)).toEqual(["a", "b"]);
  });

  it("always shows your own posts even when hidden", () => {
    expect(feedFilter([hidden], { feed: "discover", userId: "u-b" }).map((p) => p.id)).toEqual(["c"]);
  });

  it("filters by mine and by saved ids", () => {
    expect(feedFilter([a, b], { feed: "mine", userId: "u-b" }).map((p) => p.id)).toEqual(["b"]);
    expect(feedFilter([a, b], { feed: "saved", userId: "u-a", savedIds: new Set(["a"]) }).map((p) => p.id)).toEqual(["a"]);
  });

  it("filters by type, course and free-text query", () => {
    const rows = [post({ id: "a", type: "question", course_id: "c1", content: "memorize formulas" }), post({ id: "b", type: "tip", course_id: "c2" })];
    expect(applyFilters(rows, { type: "tip" }).map((p) => p.id)).toEqual(["b"]);
    expect(applyFilters(rows, { courseId: "c1" }).map((p) => p.id)).toEqual(["a"]);
    expect(applyFilters(rows, { query: "formula" }).map((p) => p.id)).toEqual(["a"]);
    expect(applyFilters(rows, { type: "all", courseId: "all" }).map((p) => p.id)).toEqual(["a", "b"]);
  });

  it("sorts newest-first, and top by engagement then recency", () => {
    const old = { ...a, like_count: 5, reply_count: 1 };
    const hot = { ...b, like_count: 5, reply_count: 5 };
    expect(sortPosts([a, b]).map((p) => p.id)).toEqual(["b", "a"]);
    expect(sortPosts([old, hot], "top").map((p) => p.id)).toEqual(["b", "a"]);
  });

  it("isVisible honors owner visibility and active-only for others", () => {
    expect(isVisible(post({ status: "hidden" }), "u-a")).toBe(true);
    expect(isVisible(post({ status: "hidden" }), "u-z")).toBe(false);
    expect(isVisible(post({ status: "active" }), "u-z")).toBe(true);
  });
});

describe("Community: identity and decoration", () => {
  it("derives deterministic initials + gradient, never photos", () => {
    const id = authorIdentity("ana@uni.edu", "Ana García");
    expect(id.name).toBe("Ana García");
    expect(id.initials).toBe("AG");
    expect(identityGradient("Ana García")).toBe(id.gradient);
    expect(id.gradient).toMatch(/^from-/);
  });

  it("falls back to email local part when no name is provided", () => {
    const id = authorIdentity("juan.perez@uni.edu");
    expect(id.name).toBe("Juan Perez");
    expect(id.initials).toBe("JP");
  });

  it("decorates counts, liked/saved/mine state and author identity", () => {
    const [p] = decoratePosts([post()], {
      likes: [like("p1", "u-a"), like("p1", "u-b")],
      replies: [reply("p1")],
      courses: [{ id: "c9", name: "Linear Algebra", grade: 9.5, ects: 6 }],
      userId: "u-a",
      savedIds: new Set(["p1"]),
    });
    expect(p.like_count).toBe(2);
    expect(p.reply_count).toBe(1);
    expect(p.liked).toBe(true);
    expect(p.saved).toBe(true);
    expect(p.mine).toBe(true);
    expect(p.authorInitials).toBeTruthy();
  });

  it("exposes only the course name — no academic data ever", () => {
    const [p] = decoratePosts([post({ course_id: "c9" })], {
      courses: [{ id: "c9", name: "Linear Algebra", grade: 9.5, ects: 6, gpa: 9.8 }],
      userId: "u-z",
    });
    expect(p.courseName).toBe("Linear Algebra");
    expect(p.grade).toBeUndefined();
    expect(p.ects).toBeUndefined();
    expect(p.gpa).toBeUndefined();
  });

  it("handles legacy like rows using created_by_id", () => {
    const [p] = decoratePosts([post()], {
      likes: [{ id: "l", post_id: "p1", created_by_id: "u-a" }],
      userId: "u-a",
    });
    expect(p.liked).toBe(true);
  });
});

describe("Community: time display", () => {
  const now = new Date("2026-09-10T12:00:00Z").getTime();
  it("renders relative time buckets", () => {
    expect(timeAgo("2026-09-10T11:59:59Z", now)).toBe("just now");
    expect(timeAgo("2026-09-10T11:59:00Z", now)).toBe("1m ago");
    expect(timeAgo("2026-09-10T11:00:00Z", now)).toBe("1h ago");
    expect(timeAgo("2026-09-10T10:00:00Z", now)).toBe("2h ago");
    expect(timeAgo("2026-09-09T12:00:00Z", now)).toBe("1d ago");
    expect(timeAgo("2026-09-03T12:00:00Z", now)).toBe("1w ago");
    expect(timeAgo("2026-08-01T12:00:00Z", now)).toBe("5w ago");
    expect(timeAgo("", now)).toBe("");
  });
});