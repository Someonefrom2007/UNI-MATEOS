// Phase 8 membership engine — join/leave scopes, ownership, labels, and the
// "postable into" set. Pure; no database or browser.
import { describe, it, expect } from "vitest";
import { createMembership, isMember, ownedScope, scopeLabel, myScopes } from "@/lib/communityData";

const FIXED = "2026-09-20T00:00:00.000Z";
const idFactory = (() => {
  let n = 0;
  return () => `m-${++n}`;
})();
const now = () => FIXED;

const community = (over = {}) => ({ id: "c-1", user_id: "u-1", kind: "course", name: "Algorithms", ...over });
const group = (over = {}) => ({ id: "g-1", user_id: "u-1", name: "Squad", ...over });

describe("createMembership", () => {
  it("links a user to a community with snake_case scope columns", () => {
    const m = createMembership({ id: "mm-1", userId: "u-2", communityId: "c-1", idFactory, now });
    expect(m).toMatchObject({
      id: "mm-1",
      user_id: "u-2",
      community_id: "c-1",
      group_id: null,
      created_at: FIXED,
    });
  });

  it("links to a study group and nulls the community column", () => {
    const m = createMembership({ userId: "u-2", groupId: "g-1", idFactory, now });
    expect(m.community_id).toBeNull();
    expect(m.group_id).toBe("g-1");
  });

  it("leaves id blank so the repository generates a real one", () => {
    const m = createMembership({ userId: "u-2", communityId: "c-1", now });
    expect(m.id).toBe("");
  });
});

describe("isMember", () => {
  const members = [
    createMembership({ userId: "u-2", communityId: "c-1", now }),
    createMembership({ userId: "u-2", groupId: "g-1", now }),
  ];

  it("flags a matching membership per kind", () => {
    expect(isMember(members, "community", "c-1", "u-2")).toBe(true);
    expect(isMember(members, "group", "g-1", "u-2")).toBe(true);
  });

  it("does not conflate the two scope kinds", () => {
    expect(isMember(members, "group", "c-1", "u-2")).toBe(false);
    expect(isMember(members, "community", "g-1", "u-2")).toBe(false);
  });

  it("is false for other users, unknown ids, or missing input", () => {
    expect(isMember(members, "community", "c-1", "u-9")).toBe(false);
    expect(isMember(members, "community", "nope", "u-2")).toBe(false);
    expect(isMember([], "community", "c-1", "u-2")).toBe(false);
    expect(isMember(members, "community", "", "u-2")).toBe(false);
  });
});

describe("ownedScope", () => {
  it("considers a row owned by its user_id", () => {
    expect(ownedScope(community(), "u-1")).toBe(true);
    expect(ownedScope(community(), "u-2")).toBe(false);
  });

  it("also honors created_by (local rows)", () => {
    expect(ownedScope({ id: "c-2", created_by: "u-7" }, "u-7")).toBe(true);
    expect(ownedScope({ id: "c-2", created_by: "u-7" }, "u-2")).toBe(false);
  });

  it("handles null rows", () => {
    expect(ownedScope(null, "u-1")).toBe(false);
    expect(ownedScope(undefined, "u-1")).toBe(false);
  });
});

describe("scopeLabel", () => {
  it("prefers name, then course/university fallbacks", () => {
    expect(scopeLabel(community({ name: "Algorithms" }))).toBe("Algorithms");
    expect(scopeLabel({ id: "c-1", name: "", course_name: "Linear Algebra" })).toBe("Linear Algebra");
    expect(scopeLabel({ id: "c-1", university_name: "UB" })).toBe("UB");
  });

  it("falls back to Untitled for nameless rows", () => {
    expect(scopeLabel({})).toBe("Untitled");
    expect(scopeLabel(null)).toBe("Untitled");
  });
});

describe("myScopes", () => {
  const members = [
    createMembership({ userId: "u-2", communityId: "c-2", now }),
    createMembership({ userId: "u-2", groupId: "g-2", now }),
  ];

  it("returns owned scopes plus the ones the user joined", () => {
    const communities = [community({ id: "c-1", user_id: "u-2" }), community({ id: "c-2", user_id: "u-9" }), community({ id: "c-3", user_id: "u-9" })];
    const out = myScopes(communities, members, "community", "u-2");
    expect(out.map((c) => c.id)).toEqual(["c-1", "c-2"]);
  });

  it("works for group scopes the same way", () => {
    const groups = [group({ id: "g-1", user_id: "u-2" }), group({ id: "g-2", user_id: "u-9" }), group({ id: "g-3", user_id: "u-9" })];
    const out = myScopes(groups, members, "group", "u-2");
    expect(out.map((g) => g.id)).toEqual(["g-1", "g-2"]);
  });

  it("degrades to owned-only when there are no memberships", () => {
    expect(myScopes([community({ id: "c-1", user_id: "u-2" })], [], "community", "u-2").map((c) => c.id)).toEqual(["c-1"]);
    expect(myScopes([], [], "community", "u-2")).toEqual([]);
  });
});