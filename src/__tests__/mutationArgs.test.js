import { describe, it, expect } from "vitest";
import { resolveMutationArgs } from "@/lib/mutationArgs";

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
