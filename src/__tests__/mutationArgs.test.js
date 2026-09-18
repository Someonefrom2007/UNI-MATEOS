import { describe, it, expect } from "vitest";
import { resolveMutationArgs, applyRepoMutation } from "@/lib/mutationArgs";
import { createLocalRepo } from "@/lib/repo/localRepo";
import { createMemoryStorage } from "@/lib/repo/storage";

// Regression guard for a bug that made every create silently useless: the data
// layer read `[id, payload]` positionally for all three operations, but callers
// pass a create's row as the *first* argument. The row was therefore bound to
// `id` and every insert persisted with only its injected metadata — visible as
// a new row that appears then shows blank everywhere.
describe("resolveMutationArgs", () => {
  it("treats a create's single argument as the payload", () => {
    const row = { course_id: "c1", date: "2026-09-18", status: "present" };
    const { id, payload } = resolveMutationArgs("create", [row]);
    expect(payload).toEqual(row);
    // The id is not supplied by the caller; the repo generates it.
    expect(id).toBeUndefined();
  });

  it("never drops fields when the row happens to carry an id", () => {
    const row = { id: "r1", name: "Quiz" };
    const { payload } = resolveMutationArgs("create", [row]);
    expect(payload.name).toBe("Quiz");
  });

  it("splits an update into id and patch", () => {
    const patch = { status: "completed" };
    const { id, payload } = resolveMutationArgs("update", ["r1", patch]);
    expect(id).toBe("r1");
    expect(payload).toEqual(patch);
  });

  it("reads only the id for a delete", () => {
    const { id, payload } = resolveMutationArgs("delete", ["r1"]);
    expect(id).toBe("r1");
    expect(payload).toBeUndefined();
  });

  it("tolerates missing arguments instead of throwing", () => {
    expect(resolveMutationArgs("create", [])).toEqual({ id: undefined, payload: undefined });
    expect(resolveMutationArgs("update", [])).toEqual({ id: undefined, payload: undefined });
  });
});

describe("applyRepoMutation against the real repository", () => {
  const setup = () => createLocalRepo({ storage: createMemoryStorage(), now: () => "T" });

  it("persists every field of a created row", () => {
    const repo = setup();
    const created = applyRepoMutation(repo, "tasks", "create", [
      { title: "Essay draft", due_date: "2026-09-24", priority: "high", status: "todo" },
    ]);
    // The bug's signature was a row carrying only injected metadata.
    expect(created.title).toBe("Essay draft");
    expect(created.due_date).toBe("2026-09-24");
    expect(created.priority).toBe("high");
    expect(created.id).toBeTruthy();
    expect(repo.list("tasks")).toHaveLength(1);
  });

  it("keeps exactly the fields the caller supplied", () => {
    const repo = setup();
    applyRepoMutation(repo, "attendance", "create", [
      { course_id: "c1", date: "2026-09-18", status: "present" },
    ]);
    const [row] = repo.list("attendance");
    expect(row.course_id).toBe("c1");
    expect(row.date).toBe("2026-09-18");
    expect(row.status).toBe("present");
  });

  it("applies an update patch by id without losing other fields", () => {
    const repo = setup();
    const created = applyRepoMutation(repo, "tasks", "create", [{ title: "Keep me", status: "todo" }]);
    applyRepoMutation(repo, "tasks", "update", [created.id, { status: "completed" }]);
    const [row] = repo.list("tasks");
    expect(row.status).toBe("completed");
    expect(row.title).toBe("Keep me");
  });

  it("deletes by id", () => {
    const repo = setup();
    const created = applyRepoMutation(repo, "tasks", "create", [{ title: "Temp" }]);
    applyRepoMutation(repo, "tasks", "delete", [created.id]);
    expect(repo.list("tasks")).toHaveLength(0);
  });

  it("rejects an unknown operation rather than writing", () => {
    const repo = setup();
    expect(() => applyRepoMutation(repo, "tasks", "upsert", [{}])).toThrow(/Unknown op/);
    expect(repo.list("tasks")).toHaveLength(0);
  });
});
