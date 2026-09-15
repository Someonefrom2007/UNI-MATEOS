// Mission 5 follow-up: communities & study groups as first-class entities.
// Pure engine coverage — factories, lookups, feed scoping, decoration, and
// scope-chip derivation, all without a database or browser.
import { describe, it, expect } from "vitest";
import {
  COMMUNITY_KINDS,
  communityKind,
  createCommunity,
  createStudyGroup,
  communityOf,
  groupOf,
  scopeFeed,
  scopesFromPosts,
  decoratePosts,
} from "@/lib/communityData";

const FIXED = "2026-09-15T00:00:00.000Z";
const idFactory = (() => {
  let n = 0;
  return () => `id-${++n}`;
})();
const now = () => FIXED;

describe("community kind registry", () => {
  it("lists university and course as the two first-class kinds", () => {
    expect(COMMUNITY_KINDS.map((k) => k.value)).toEqual(["university", "course"]);
  });

  it("looks up a known kind and falls back to course", () => {
    expect(communityKind("university").label).toBe("University");
    expect(communityKind("something-else").value).toBe("course");
  });
});

describe("createCommunity", () => {
  it("builds a deterministic snake_case row with injected metadata", () => {
    const c = createCommunity({
      id: "c-1",
      kind: "course",
      name: "",
      courseId: "cc-9",
      courseName: "Algorithms",
      createdBy: "u-1",
      idFactory,
      now,
    });
    expect(c).toMatchObject({
      id: "c-1",
      kind: "course",
      university_name: "",
      course_id: "cc-9",
      course_name: "Algorithms",
      created_by: "u-1",
      created_at: FIXED,
      updated_at: FIXED,
    });
  });

  it("generates an id when none is provided and defaults kind to course", () => {
    const c = createCommunity({ name: "UB", idFactory, now });
    expect(c.id).toBe("id-1");
    expect(c.kind).toBe("course");
  });
});

describe("createStudyGroup", () => {
  it("builds a group row linked to its community", () => {
    const g = createStudyGroup({
      id: "g-1",
      communityId: "c-1",
      courseId: "cc-9",
      name: "Midterm squad",
      createdBy: "u-1",
      idFactory,
      now,
    });
    expect(g).toMatchObject({
      id: "g-1",
      community_id: "c-1",
      course_id: "cc-9",
      name: "Midterm squad",
      created_by: "u-1",
      created_at: FIXED,
    });
  });
});

describe("lookups", () => {
  const communities = [
    createCommunity({ id: "c-1", name: "UB", idFactory, now }),
    createCommunity({ id: "c-2", name: "Algorithms", idFactory, now }),
  ];
  const groups = [createStudyGroup({ id: "g-1", name: "Squad", idFactory, now })];

  it("finds by id with string coercion", () => {
    expect(communityOf(communities, "c-2").name).toBe("Algorithms");
    expect(communityOf(communities, "missing")).toBeNull();
    expect(groupOf(groups, "g-1").name).toBe("Squad");
    expect(groupOf([], "g-1")).toBeNull();
  });
});

describe("scopeFeed", () => {
  const posts = [
    { id: "p1", community_id: "c-1", group_id: "" },
    { id: "p2", community_id: "c-1", group_id: "g-1" },
    { id: "p3", community_id: "c-2", group_id: "g-2" },
  ];

  it("keeps everything when no scope is set", () => {
    expect(scopeFeed(posts, {}).map((p) => p.id)).toEqual(["p1", "p2", "p3"]);
  });

  it("filters by community", () => {
    expect(scopeFeed(posts, { communityId: "c-1" }).map((p) => p.id)).toEqual(["p1", "p2"]);
  });

  it("filters by group", () => {
    expect(scopeFeed(posts, { groupId: "g-2" }).map((p) => p.id)).toEqual(["p3"]);
  });

  it("combines community and group scopes", () => {
    expect(scopeFeed(posts, { communityId: "c-1", groupId: "g-1" }).map((p) => p.id)).toEqual(["p2"]);
  });

  it("treats an empty scope value as off", () => {
    expect(scopeFeed(posts, { communityId: "", groupId: "" }).length).toBe(3);
  });
});

describe("scopesFromPosts", () => {
  it("derives deduped, ordered chip options from what posts reference", () => {
    const communities = [
      createCommunity({ id: "c-1", name: "UB", idFactory, now }),
      createCommunity({ id: "c-2", courseId: "cc-9", courseName: "Algorithms", idFactory, now }),
      createCommunity({ id: "c-3", name: "Unreferenced", idFactory, now }),
    ];
    const groups = [
      createStudyGroup({ id: "g-1", name: "Squad A", idFactory, now }),
      createStudyGroup({ id: "g-2", name: "Squad B", idFactory, now }),
    ];
    const posts = [
      { id: "p1", community_id: "c-1", group_id: "g-1" },
      { id: "p2", community_id: "c-1", group_id: "g-1" },
      { id: "p3", community_id: "c-2", group_id: "g-2" },
    ];
    const { communities: cOptions, groups: gOptions } = scopesFromPosts(posts, { communities, groups });
    expect(cOptions).toEqual([
      { id: "c-1", name: "UB", kind: "course" },
      { id: "c-2", name: "Algorithms", kind: "course" },
    ]);
    expect(gOptions).toEqual([
      { id: "g-1", name: "Squad A" },
      { id: "g-2", name: "Squad B" },
    ]);
  });

  it("falls back to course_name / university_name for the chip label", () => {
    const communities = [
      createCommunity({ id: "c-1", name: "", courseId: "cc-1", courseName: "Linear Algebra", idFactory, now }),
    ];
    const posts = [{ id: "p1", community_id: "c-1" }];
    expect(scopesFromPosts(posts, { communities, groups: [] }).communities).toEqual([
      { id: "c-1", name: "Linear Algebra", kind: "course" },
    ]);
  });

  it("returns empty options when nothing is referenced", () => {
    expect(scopesFromPosts([], {})).toEqual({ communities: [], groups: [] });
  });
});

describe("decoratePosts with community/group names", () => {
  const communities = [createCommunity({ id: "c-1", name: "UB", idFactory, now })];
  const groups = [createStudyGroup({ id: "g-1", name: "Midterm squad", idFactory, now })];

  it("attaches NAME-only scope metadata (no academic fields)", () => {
    const posts = [{ id: "p1", user_id: "u-1", title: "T", content: "C", community_id: "c-1", group_id: "g-1", created_by: "student@ub.edu" }];
    const [decorated] = decoratePosts(posts, { communities, groups, userId: "u-1", savedIds: new Set() });
    expect(decorated.communityName).toBe("UB");
    expect(decorated.communityKind).toBe("course");
    expect(decorated.groupName).toBe("Midterm squad");
    expect(decorated.groupGradient).toMatch(/^from-\w+-\d+/);
    expect("grade" in decorated).toBe(false);
    expect("ects" in decorated).toBe(false);
  });

  it("leaves scope fields null when a post is scoped to nothing", () => {
    const [decorated] = decoratePosts([{ id: "p1", user_id: "u-1", title: "T", content: "C" }], { userId: "u-1" });
    expect(decorated.communityName).toBeNull();
    expect(decorated.groupName).toBeNull();
  });
});