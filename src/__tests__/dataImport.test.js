import { describe, it, expect } from "vitest";
import {
  parseExport,
  sanitizeRows,
  forgetIdentity,
  planImport,
  summarizeBundle,
  runImport,
} from "@/lib/dataImport";

const ROW = (id, extra = {}) => ({ id, user_id: "me", created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z", name: `row-${id}`, ...extra });

const BUNDLE = () => ({
  exported_at: "2026-09-22T10:00:00Z",
  data: {
    Course: [ROW("c1", { code: "ECO101" }), ROW("c2", { code: "LAW201" })],
    Task: [ROW("t1", { priority: 3 })],
    UnknownEntity: [{ id: "x" }],
    Broken: "not-an-array",
  },
});

const fakeRepo = (initial = {}) => {
  const store = {};
  Object.entries(initial).forEach(([table, rows]) => {
    store[table] = rows.map((r) => ({ ...r }));
  });
  const fail = new Set();
  return {
    store,
    failOn(table) { fail.add(table); },
    async list(table) { return store[table] ? store[table].map((r) => ({ ...r })) : []; },
    async create(table, record) {
      if (fail.has(table)) throw new Error("nope");
      const rows = store[table] || (store[table] = []);
      rows.push({ ...record });
      return { ...record };
    },
  };
};

describe("parseExport", () => {
  it("accepts a valid bundle", () => {
    const { ok, bundle } = parseExport(JSON.stringify(BUNDLE()));
    expect(ok).toBe(true);
    expect(bundle.data.Course).toHaveLength(2);
  });

  it("rejects empty, non-json or mis-shaped input", () => {
    expect(parseExport("").ok).toBe(false);
    expect(parseExport("   ").ok).toBe(false);
    expect(parseExport("not json {").ok).toBe(false);
    expect(parseExport(JSON.stringify([1, 2])).ok).toBe(false);
    expect(parseExport(JSON.stringify({ a: 1 })).ok).toBe(false);
    expect(parseExport(JSON.stringify({ data: "nope" })).ok).toBe(false);
  });

  it("round-trips real formatting automatically (whitespace/newlines ok)", () => {
    const { ok, bundle } = parseExport(
      JSON.stringify({ exported_at: "x", data: { Course: [ROW("a")] } }, null, 2)
    );
    expect(ok).toBe(true);
    expect(bundle.data.Course[0].id).toBe("a");
  });
});

describe("sanitizeRows / entityTable", () => {
  it("keeps only plain records for a known table", () => {
    expect(sanitizeRows("Course", BUNDLE().data.Course)).toHaveLength(2);
    expect(sanitizeRows("Course", "nope")).toEqual([]);
    expect(sanitizeRows("UnknownEntity", [{ id: "x" }])).toEqual([]);
    expect(sanitizeRows("Task", [null, "x", 1, ROW("a")])).toHaveLength(1);
  });

  it("preserves identity fields by default (FK-safe restore)", () => {
    const [row] = sanitizeRows("Course", [ROW("c1")]);
    expect(row.id).toBe("c1");
    expect(row.user_id).toBe("me");
    expect(row.created_at).toBe("2026-01-01T00:00:00Z");
  });

  it("forgetIdentity strips ownership for re-homing", () => {
    const stripped = forgetIdentity(ROW("c1"));
    expect(stripped).toEqual({ name: "row-c1" });
  });
});

describe("planImport", () => {
  it("queues new ids and skips ids already present", () => {
    const plan = planImport("Course", BUNDLE().data.Course, ["c1"]);
    expect(plan.create.map((r) => r.id)).toEqual(["c2"]);
    expect(plan.skip).toBe(1);
    expect(plan.table).toBe("courses");
  });

  it("creates everything when nothing exists yet", () => {
    const plan = planImport("Course", [ROW("a"), ROW("b")], []);
    expect(plan.create).toHaveLength(2);
    expect(plan.skip).toBe(0);
  });

  it("ignores rows without a resolvable table", () => {
    const plan = planImport("UnknownEntity", [ROW("x")], []);
    expect(plan.table).toBeNull();
    expect(plan.create).toEqual([]);
  });
});

describe("summarizeBundle", () => {
  it("reports only known entities with real row counts", () => {
    const out = summarizeBundle(BUNDLE().data);
    expect(out).toEqual([
      { entity: "Course", table: "courses", rows: 2 },
      { entity: "Task", table: "tasks", rows: 1 },
    ]);
  });
});

describe("runImport", () => {
  it("restores rows into a fresh store, skipping existing ids", async () => {
    const repo = fakeRepo({ courses: [ROW("c1")] });
    const total = await runImport(repo, BUNDLE().data);
    expect(total.imported).toBe(2); // c2 + t1
    expect(total.skipped).toBe(1); // c1 already present
    expect(total.failed).toBe(0);
    expect(repo.store.tasks).toHaveLength(1);
    expect(repo.store.courses).toHaveLength(2);
    expect(total.entities).toEqual([
      { entity: "Course", table: "courses", imported: 1, skipped: 1, failed: 0 },
      { entity: "Task", table: "tasks", imported: 1, skipped: 0, failed: 0 },
    ]);
  });

  it("counts failures instead of aborting the import", async () => {
    const repo = fakeRepo();
    repo.failOn("tasks");
    const total = await runImport(repo, BUNDLE().data);
    expect(total.imported).toBe(2); // courses only
    expect(total.failed).toBe(1); // tasks rejected
    expect(total.entities.find((e) => e.entity === "Task").failed).toBe(1);
  });

  it("handles an empty bundle", async () => {
    const repo = fakeRepo();
    const total = await runImport(repo, {});
    expect(total).toEqual({ imported: 0, skipped: 0, failed: 0, entities: [] });
  });
});