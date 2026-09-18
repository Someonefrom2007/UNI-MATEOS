import { describe, it, expect } from "vitest";
import { diffICS } from "@/lib/calendarSync";

const row = (id, title = "Lecture") => ({ google_event_id: id, title, type: "class" });

describe("diffICS", () => {
  it("returns only events not already stored", () => {
    const { toCreate, skipped } = diffICS([row("a")], [row("a"), row("b")]);
    expect(toCreate.map((r) => r.google_event_id)).toEqual(["b"]);
    expect(skipped).toBe(1);
  });

  it("creates everything when nothing is stored yet", () => {
    const { toCreate, skipped } = diffICS([], [row("a"), row("b")]);
    expect(toCreate).toHaveLength(2);
    expect(skipped).toBe(0);
  });

  it("never recreates an event the user deleted", () => {
    const { toCreate, skipped, suppressed } = diffICS([], [row("a"), row("b")], ["a"]);
    expect(toCreate.map((r) => r.google_event_id)).toEqual(["b"]);
    expect(skipped).toBe(0);
    expect(suppressed).toBe(1);
  });

  it("keeps a suppressed event out even after it is gone from storage", () => {
    // The feed resends it every sync; only the suppression list stops it.
    const first = diffICS([], [row("gone")], ["gone"]);
    const second = diffICS([], [row("gone")], ["gone"]);
    expect(first.toCreate).toHaveLength(0);
    expect(second.toCreate).toHaveLength(0);
  });

  it("tolerates missing input and rows without ids", () => {
    expect(diffICS(undefined, undefined).toCreate).toEqual([]);
    const { toCreate } = diffICS([], [{ title: "no id" }]);
    expect(toCreate).toHaveLength(1);
  });

  it("does not duplicate the same id twice in one run", () => {
    const { toCreate } = diffICS([], [row("a"), row("a")]);
    expect(toCreate).toHaveLength(1);
  });
});