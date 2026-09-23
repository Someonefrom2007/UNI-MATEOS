import { describe, it, expect } from "vitest";
import { normalizeMutateArgs } from "@/lib/mutateArgs";

describe("normalizeMutateArgs (useUserData.mutate arg contract)", () => {
  it("create: single payload object is used verbatim (StickyWall/Focus/Schedule call style)", () => {
    const args = normalizeMutateArgs("create", [{ content: "remind me", color: "amber" }]);
    expect(args).toEqual({ id: undefined, payload: { content: "remind me", color: "amber" } });
  });

  it("create: supports the two-slot (id, payload) style without dropping data", () => {
    const args = normalizeMutateArgs("create", ["id-9", { title: "t" }]);
    expect(args.payload).toEqual({ title: "t" });
  });

  it("create: missing payload yields a writable empty object, never undefined", () => {
    expect(normalizeMutateArgs("create", []).payload).toEqual({});
    expect(normalizeMutateArgs("create", [undefined]).payload).toEqual({});
  });

  it("update: (id, payload) keeps both slots", () => {
    expect(normalizeMutateArgs("update", ["row-1", { status: "done" }])).toEqual({
      id: "row-1",
      payload: { status: "done" },
    });
  });

  it("delete: single id", () => {
    expect(normalizeMutateArgs("delete", ["row-2"])).toEqual({ id: "row-2", payload: undefined });
  });
});