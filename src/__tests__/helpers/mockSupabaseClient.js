// Minimal chainable mock of supabase-js v2 shared by every data-layer test:
// per-table in-memory store, matchable eq/in filters, terminal ops computed on
// await, single-row ops. Not a test file itself (no *.test.* name) — import it.
export const createMockSupabaseClient = () => {
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
          return resolve({ data, error });
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
    _seed(table, rows) {
      db.set(table, clone(rows));
    },
  };
};