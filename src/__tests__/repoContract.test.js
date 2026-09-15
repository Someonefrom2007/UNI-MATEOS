// Shared repository contract suite (Mission 2): the SAME assertions must pass
// against the local on-device repo and the Supabase-hosted repo, proving a
// future backend can sit under the same interface without UI rewrites.
import { describe, it, expect } from "vitest";
import { createMemoryStorage } from "@/lib/repo/storage";
import { createLocalRepo } from "@/lib/repo/localRepo";
import { createSupabaseRepo } from "@/lib/repo/supabaseRepo";

const FIXED = "2026-09-14T00:00:00.000Z";

const localFactory = () =>
  createLocalRepo({
    storage: createMemoryStorage(),
    userId: "u-1",
    now: () => FIXED,
    idFactory: () => "id-1",
  });

// Minimal chainable mock of supabase-js v2: per-table in-memory store,
// matchable eq/in filters, terminal ops computed on await, single-row ops.
const createMockSupabaseClient = () => {
  const db = new Map();
  const rowsOf = (table) => db.get(table) || [];
  const matches = (row, match) =>
    Object.entries(match).every(([k, v]) =>
      v && typeof v === "object" && "$in" in v ? v.$in.includes(row[k]) : row[k] === v
    );
  const clone = (v) => (Array.isArray(v) ? v.map((r) => ({ ...r })) : v ? { ...v } : v);

  const chain = (table, state) => {
    const q = {
      select() {
        if (!state.op) state.op = "list";
        return q;
      },
      insert(payload) {
        if (!state.op) state.op = "insert";
        state.payload = payload;
        return q;
      },
      update(patch) {
        if (!state.op) state.op = "update";
        state.patch = patch;
        return q;
      },
      delete() {
        if (!state.op) state.op = "delete";
        return q;
      },
      eq(k, v) {
        state.match[k] = v;
        return q;
      },
      in(k, vs) {
        state.match[k] = { $in: vs };
        return q;
      },
      single() {
        state.single = true;
        return q;
      },
      then(resolve, reject) {
        return Promise.resolve().then(() => {
          const rows = rowsOf(table);
          let data = null;
          let error = null;
          const single = state.single;
          switch (state.op) {
            case "list":
              data = rows.filter((r) => matches(r, state.match)).map((r) => ({ ...r }));
              if (single) {
                const hit = data[0];
                if (hit) data = { ...hit };
                else {
                  data = null;
                  error = { message: "row not found", code: "PGRST116" };
                }
              }
              break;
            case "insert": {
              const ins = (Array.isArray(state.payload) ? state.payload : [state.payload]).map((r) => ({ ...r }));
              db.set(table, [...rows, ...ins]);
              data = single ? clone(ins[ins.length - 1]) : clone(ins);
              break;
            }
            case "update": {
              const next = rows.map((r) => {
                if (!matches(r, state.match)) return r;
                data = { ...r, ...state.patch };
                return data;
              });
              db.set(table, next);
              if (!data) error = { message: "row not found", code: "PGRST116" };
              else data = clone(data);
              break;
            }
            case "delete": {
              const removed = rows.filter((r) => matches(r, state.match));
              db.set(table, rows.filter((r) => !matches(r, state.match)));
              data = removed.length ? clone(removed) : null;
              break;
            }
            default:
              error = { message: `unhandled op ${state.op}` };
          }
          const out = { data, error };
          return resolve(out);
        }, reject);
      },
    };
    return q;
  };

  return {
    from(table) {
      return chain(table, { match: {}, op: "", single: false, payload: null, patch: null });
    },
    _dump(table) {
      return clone(rowsOf(table));
    },
  };
};

const supabaseFactory = () => {
  const client = createMockSupabaseClient();
  return {
    repo: createSupabaseRepo({ client, userId: "u-1", now: () => FIXED, idFactory: () => "id-1" }),
    dump: (table) => client._dump(table),
  };
};

const runContract = (name, make) => {
  describe(`repository contract — ${name}`, () => {
    it("list returns every row with the stored shape", async () => {
      const repo = make();
      await repo.create("courses", { name: "Algorithms", targetGrade: 8 });
      expect(await repo.list("courses")).toEqual([
        {
          id: "id-1",
          user_id: "u-1",
          name: "Algorithms",
          target_grade: 8,
          created_at: FIXED,
          updated_at: FIXED,
        },
      ]);
    });

    it("list is empty for an unknown table", async () => {
      const repo = make();
      expect(await repo.list("never-created")).toEqual([]);
    });

    it("create injects id/user/timestamps and snake_cases incoming keys", async () => {
      const repo = make();
      const row = await repo.create("tasks", { title: "Read Ch.5", dueDate: "2026-09-20" });
      expect(row).toMatchObject({
        id: "id-1",
        user_id: "u-1",
        title: "Read Ch.5",
        due_date: "2026-09-20",
        created_at: FIXED,
        updated_at: FIXED,
      });
    });

    it("update merges in place, preserves id/created_at and bumps updated_at", async () => {
      const repo = make();
      await repo.create("tasks", { title: "A" });
      const updated = await repo.update("tasks", "id-1", { status: "done", dueDate: "2026-09-21" });
      expect(updated).toMatchObject({
        title: "A",
        status: "done",
        due_date: "2026-09-21",
        id: "id-1",
        created_at: FIXED,
        updated_at: FIXED,
      });
    });

    it("update returns null when no row matches", async () => {
      const repo = make();
      expect(await repo.update("tasks", "missing", { status: "x" })).toBeNull();
    });

    it("delete reports whether a row was actually removed", async () => {
      const repo = make();
      await repo.create("tasks", { title: "A" });
      expect(await repo.delete("tasks", "id-1")).toBe(true);
      expect(await repo.delete("tasks", "id-1")).toBe(false);
    });

    it("deleteWhere removes a batch by predicate and reports the count", async () => {
      const repo = make();
      await repo.create("schedule_events", { id: "ev-1", google_event_id: "ics:feed-a:1" });
      await repo.create("schedule_events", { id: "ev-2", google_event_id: "ics:feed-a:2" });
      await repo.create("schedule_events", { id: "ev-3", google_event_id: "ics:feed-b:1" });
      const removed = await repo.deleteWhere("schedule_events", (r) =>
        r.google_event_id.startsWith("ics:feed-a:")
      );
      expect(removed).toBe(2);
      expect((await repo.list("schedule_events")).map((r) => r.google_event_id)).toEqual(["ics:feed-b:1"]);
    });
  });
};

runContract("local (storage-backed)", localFactory);
runContract(
  "supabase (mocked client)",
  () => supabaseFactory().repo
);

describe("supabase adapter specifics", () => {
  it("persists through the real (mock) client store, not call-local state", async () => {
    const { repo, dump } = supabaseFactory();
    await repo.create("notes", { title: "Hosted note" });
    expect(dump("notes")).toEqual([
      {
        id: "id-1",
        user_id: "u-1",
        title: "Hosted note",
        created_at: FIXED,
        updated_at: FIXED,
      },
    ]);
  });

  it("clear() is refused to prevent accidental full-table deletes", () => {
    const repo = supabaseFactory().repo;
    expect(() => repo.clear("courses")).toThrow(/not supported/);
  });

  it("deleteWhere with no matches is a no-op returning 0", async () => {
    const repo = supabaseFactory().repo;
    expect(await repo.deleteWhere("schedule_events", () => true)).toBe(0);
  });
});