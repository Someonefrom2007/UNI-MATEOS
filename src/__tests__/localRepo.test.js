import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createMemoryStorage, createLocalStorageAdapter } from "@/lib/repo/storage";
import { createLocalRepo, newId } from "@/lib/repo/localRepo";
import {
  hasSupabaseEnv,
  isLocalWorkspace,
  LOCAL_WORKSPACE_USER,
  loadLocalProfile,
  saveLocalProfile,
} from "@/lib/repo/select";

const FIXED = "2026-09-14T00:00:00.000Z";

describe("storage: injectable key-value backend", () => {
  it("memory storage round-trips, removes and clears", () => {
    const s = createMemoryStorage();
    expect(s.getItem("a")).toBeNull();
    s.setItem("a", "1");
    expect(s.getItem("a")).toBe("1");
    s.removeItem("a");
    expect(s.getItem("a")).toBeNull();
    s.setItem("b", "2");
    s.clear();
    expect(s.getItem("b")).toBeNull();
  });

  describe("namespacing against a browser-like localStorage", () => {
    let originalWindow;
    let fake;

    beforeEach(() => {
      originalWindow = globalThis.window;
      fake = {
        getItem(k) {
          return Object.prototype.hasOwnProperty.call(this, k) ? this[k] : null;
        },
        setItem(k, v) {
          this[k] = String(v);
        },
        removeItem(k) {
          delete this[k];
        },
      };
      globalThis.window = { localStorage: fake };
    });

    afterEach(() => {
      globalThis.window = originalWindow;
    });

    it("prefixes every key so app data can't collide", () => {
      const adapter = createLocalStorageAdapter("unimate:v1");
      adapter.setItem("courses", "[]");
      expect(fake["unimate:v1:courses"]).toBe("[]");
      expect(adapter.getItem("courses")).toBe("[]");
    });

    it("scopes clear to the namespace only", () => {
      const adapter = createLocalStorageAdapter("unimate:v1");
      adapter.setItem("courses", "[]");
      fake.setItem("other:key", "keep");
      adapter.clear();
      expect(adapter.getItem("courses")).toBeNull();
      expect(fake["other:key"]).toBe("keep");
    });
  });
});

describe("localRepo: on-device CRUD contract", () => {
  const makeRepo = (over = {}) =>
    createLocalRepo({
      storage: createMemoryStorage(),
      userId: "u-1",
      now: () => FIXED,
      idFactory: () => "id-1",
      ...over,
    });

  it("injects id/user/timestamps and snake_cases incoming keys", () => {
    const repo = makeRepo();
    const row = repo.create("courses", { name: "Algorithms", targetGrade: 8 });
    expect(row).toMatchObject({
      id: "id-1",
      user_id: "u-1",
      name: "Algorithms",
      target_grade: 8,
      created_at: FIXED,
      updated_at: FIXED,
    });
    expect(repo.list("courses")).toEqual([row]);
  });

  it("returns an empty list for unknown or malformed tables", () => {
    const storage = createMemoryStorage();
    storage.setItem("tasks", "{not valid json");
    const repo = createLocalRepo({ storage });
    expect(repo.list("tasks")).toEqual([]);
    expect(repo.list("never-created")).toEqual([]);
  });

  it("update merges in place, preserves id/created_at and bumps updated_at", () => {
    let clock = "2026-01-01T00:00:00.000Z";
    const repo = makeRepo({ now: () => clock });
    repo.create("tasks", { title: "A" });
    clock = "2026-01-02T00:00:00.000Z";
    const updated = repo.update("tasks", "id-1", { status: "done", dueDate: "2026-02-01" });
    expect(updated).toMatchObject({
      status: "done",
      due_date: "2026-02-01",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-02T00:00:00.000Z",
    });
    expect(repo.update("tasks", "missing", { status: "x" })).toBeNull();
  });

  it("delete reports whether a row was actually removed", () => {
    let n = 0;
    const repo = makeRepo({ idFactory: () => `id-${++n}` });
    repo.create("tasks", { title: "A" });
    repo.create("tasks", { title: "B" });
    expect(repo.delete("tasks", "id-1")).toBe(true);
    expect(repo.delete("tasks", "id-1")).toBe(false);
    expect(repo.list("tasks").map((r) => r.id)).toEqual(["id-2"]);
  });

  it("deleteWhere removes a batch by predicate (feed cleanup)", () => {
    let n = 0;
    const repo = makeRepo({ idFactory: () => `id-${++n}` });
    repo.create("schedule_events", { google_event_id: "ics:feed-a:1" });
    repo.create("schedule_events", { google_event_id: "ics:feed-a:2" });
    repo.create("schedule_events", { google_event_id: "ics:feed-b:1" });
    const removed = repo.deleteWhere("schedule_events", (r) => r.google_event_id.startsWith("ics:feed-a:"));
    expect(removed).toBe(2);
    expect(repo.list("schedule_events")).toHaveLength(1);
  });

  it("persists across repo instances that share one storage backend", () => {
    const storage = createMemoryStorage();
    createLocalRepo({ storage, idFactory: () => "id-1" }).create("notes", { title: "Shared" });
    const second = createLocalRepo({ storage });
    expect(second.list("notes").map((r) => r.title)).toEqual(["Shared"]);
  });

  it("newId yields unique, non-empty string ids", () => {
    const ids = new Set(Array.from({ length: 50 }, () => newId()));
    expect(ids.size).toBe(50);
    expect([...ids].every((v) => typeof v === "string" && v.length > 0)).toBe(true);
  });
});

describe("adapter selection: environment-based", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("is local when Supabase env vars are absent", () => {
    vi.stubEnv("VITE_SUPABASE_URL", "");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "");
    expect(hasSupabaseEnv()).toBe(false);
    expect(isLocalWorkspace()).toBe(true);
  });

  it("selects Supabase when both env vars are present", () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon-key");
    expect(hasSupabaseEnv()).toBe(true);
    expect(isLocalWorkspace()).toBe(false);
  });

  it("treats a partial env as local", () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "");
    expect(hasSupabaseEnv()).toBe(false);
  });

  it("exposes a stable synthetic workspace identity", () => {
    expect(LOCAL_WORKSPACE_USER.id).toBeTruthy();
    expect(LOCAL_WORKSPACE_USER.email).toMatch(/@/);
    expect(LOCAL_WORKSPACE_USER.is_local_workspace).toBe(true);
    expect(Object.isFrozen(LOCAL_WORKSPACE_USER)).toBe(true);
  });

  it("round-trips the on-device profile and clears it on null", () => {
    saveLocalProfile({ university: "UB", year: "3" });
    expect(loadLocalProfile()).toMatchObject({ university: "UB", year: "3" });
    saveLocalProfile(null);
    expect(loadLocalProfile()).toBeNull();
  });
});

describe("demoData: local workspace seeding", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("seeds every table through the local repo and returns real counts", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_SUPABASE_URL", "");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "");

    const { loadDemoData } = await import("@/lib/demoData");
    const { getDefaultStorage } = await import("@/lib/repo/storage");
    const { createLocalRepo: createRepo } = await import("@/lib/repo/localRepo");

    const summary = await loadDemoData();
    expect(summary).toMatchObject({ courses: 4, classes: 6, tasks: 5, exams: 3, grades: 4, notes: 2, stickies: 5, habits: 2 });

    const repo = createRepo({ storage: getDefaultStorage() });
    expect(repo.list("courses")).toHaveLength(4);
    expect(repo.list("tasks")).toHaveLength(5);
    expect(repo.list("habit_logs")).toHaveLength(4);
    // Foreign keys resolve to real created ids (not undefined).
    const courseIds = new Set(repo.list("courses").map((c) => c.id));
    expect(repo.list("schedule_events").every((e) => courseIds.has(e.course_id))).toBe(true);

    getDefaultStorage().clear();
  });
});
