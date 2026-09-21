// Environment-aware repository factory (Phase 1 — Foundation): a single
// repository interface serves both modes. These tests prove createRepo()
// picks the local adapter by default in this (env-less) test environment and
// the Supabase adapter in hosted mode, and that the hosted rows carry the
// authenticated user id so RLS keeps enforcing ownership.
import { describe, it, expect, vi, afterEach } from "vitest";
import { createRepo } from "@/lib/repo/select";
import { createMemoryStorage } from "@/lib/repo/storage";
import { createMockSupabaseClient } from "@/__tests__/helpers/mockSupabaseClient";

const FIXED = "2026-09-18T00:00:00.000Z";

// createRepo() reads import.meta.env at call time. The factory's default branch
// is exercised air-tightly by toggling the Supabase env vars and restoring them
// afterwards, so the assertions hold whether or not .env.local is present.
const setEnv = (vars) => {
  const env = import.meta.env;
  const saved = {};
  for (const key of Object.keys(vars)) {
    saved[key] = env[key];
    if (vars[key] === undefined) delete env[key];
    else env[key] = vars[key];
  }
  return () => {
    for (const key of Object.keys(saved)) {
      if (saved[key] === undefined) delete env[key];
      else env[key] = saved[key];
    }
  };
};

describe("createRepo — adapter selection", () => {
  it("defaults to the local adapter when no Supabase env is present", () => {
    const restore = setEnv({ VITE_SUPABASE_URL: undefined, VITE_SUPABASE_ANON_KEY: undefined });
    try {
      const repo = createRepo({ storage: createMemoryStorage(), userId: "local-workspace" });
      const row = repo.create("notes", { title: "Local note" });
      expect(row.user_id).toBe("local-workspace");
      repo.clear("notes"); // local adapter supports clear()
    } finally {
      restore();
    }
  });

  it("defaults to the hosted adapter when Supabase env is present (client required)", () => {
    const restore = setEnv({ VITE_SUPABASE_URL: "https://demo.supabase.co", VITE_SUPABASE_ANON_KEY: "k" });
    try {
      expect(() => createRepo({})).toThrow(/requires a supabase client/);
    } finally {
      restore();
    }
  });

  it("refuses hosted mode without a supabase client", () => {
    expect(() =>
      createRepo({ environment: "hosted", client: undefined, userId: "u-1" })
    ).toThrow(/requires a supabase client/);
  });

  it("returns the Supabase adapter in hosted mode", () => {
    const repo = createRepo({
      environment: "hosted",
      client: createMockSupabaseClient(),
      userId: "u-1",
    });
    expect(typeof repo.list).toBe("function");
    expect(() => repo.clear()).toThrow(/not supported/);
  });
});

describe("createRepo — hosted wiring", () => {
  it("injects the authenticated user id so RLS scopes rows to the owner", async () => {
    const client = createMockSupabaseClient();
    const repo = createRepo({
      environment: "hosted",
      client,
      userId: "auth-uid-1",
      now: () => FIXED,
      idFactory: () => "row-1",
    });
    await repo.create("courses", { name: "Linear Algebra", targetGrade: 8 });
    expect(client._dump("courses")).toEqual([
      {
        id: "row-1",
        user_id: "auth-uid-1",
        name: "Linear Algebra",
        target_grade: 8,
        created_at: FIXED,
        updated_at: FIXED,
      },
    ]);
    expect((await repo.list("courses"))[0].user_id).toBe("auth-uid-1");
  });

  it("updates and deletes through the shared client store", async () => {
    const client = createMockSupabaseClient();
    const repo = createRepo({
      environment: "hosted",
      client,
      userId: "auth-uid-1",
      now: () => FIXED,
      idFactory: () => "row-1",
    });
    await repo.create("tasks", { title: "Read Ch.1" });
    await repo.update("tasks", "row-1", { status: "done" });
    expect(client._dump("tasks")[0]).toMatchObject({ title: "Read Ch.1", status: "done" });
    expect(await repo.delete("tasks", "row-1")).toBe(true);
    expect(client._dump("tasks")).toEqual([]);
  });

  it("resolves the owner lazily from a function userId (fresh session)", async () => {
    const client = createMockSupabaseClient();
    const repo = createRepo({
      environment: "hosted",
      client,
      userId: async () => "auth-from-session",
      now: () => FIXED,
      idFactory: () => "row-7",
    });
    await repo.create("courses", { name: "Signals" });
    expect(client._dump("courses")[0]).toMatchObject({ id: "row-7", user_id: "auth-from-session", name: "Signals" });
  });

  it("omits user_id when the owner is unknown so the DB default auth.uid() applies", async () => {
    const client = createMockSupabaseClient();
    const repo = createRepo({ environment: "hosted", client, userId: async () => null });
    const row = await repo.create("courses", { name: "No owner yet" });
    expect(row.user_id).toBeUndefined();
    expect(client._dump("courses")[0].user_id).toBeUndefined();
  });

  it("works with an existing row set (seeded client)", async () => {
    const client = createMockSupabaseClient();
    client._seed("courses", [
      { id: "c-9", user_id: "auth-uid-1", name: "Calculus", created_at: FIXED, updated_at: FIXED },
    ]);
    const repo = createRepo({ environment: "hosted", client, userId: "auth-uid-1" });
    expect((await repo.list("courses")).map((r) => r.name)).toEqual(["Calculus"]);
  });
});

describe("getAppRepo — shared application repository", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("serves one local repo when no Supabase env is present", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_SUPABASE_URL", "");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "");
    const { getAppRepo } = await import("@/lib/repo/select");

    const repo = getAppRepo();
    expect(getAppRepo()).toBe(repo); // one shared instance
    const row = repo.create("courses", { name: "Singleton course" });
    expect(row.user_id).toBe("local-workspace");
    expect(repo.list("courses").map((r) => r.name)).toEqual(["Singleton course"]);
    repo.clear("courses");
  });
});