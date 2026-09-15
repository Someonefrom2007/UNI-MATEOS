// Supabase-ready repository (Mission 2): the same repository interface as
// LocalRepo, backed by the hosted PostgreSQL backend through a Supabase
// client. NOT wired as the default yet — the UI still talks to Supabase
// directly via useUserData. This adapter exists to prove the whole contract
// can run on the hosted edge and is exercised by the shared contract suite
// (repoContract.test.js) with a mocked client.
//
// Contract parity notes:
// - create()/update() snake_case incoming keys and inject id/user_id/
//   created_at/updated_at the same way LocalRepo does, so callers get
//   identical row shapes regardless of backend.
// - update() returns null when no row matches (mirrors LocalRepo).
// - delete() returns whether a row was removed; deleteWhere() returns a count.
// - clear() is intentionally unsupported on the hosted backend to prevent
//   accidental full-table deletes; scoped removals go through deleteWhere().
import { newId, toSnakeCase } from "@/lib/repo/localRepo";

const isMissingRow = (error) =>
  Boolean(
    error &&
      (error.code === "PGRST116" ||
        /no rows|row not found|not found|does not exist/i.test(String(error.message || "")))
  );

const rowsOf = (res) => res.data ?? [];

export const createSupabaseRepo = ({
  client,
  userId = "supabase-user",
  now = () => new Date().toISOString(),
  idFactory = newId,
} = {}) => {
  const buildRow = (record = {}) => ({
    ...toSnakeCase(record),
    id: record.id || idFactory(),
    user_id: record.user_id || userId,
    created_at: record.created_at || now(),
    updated_at: record.updated_at || now(),
  });

  const clientFor = (table) => client.from(table);

  return {
    async list(table) {
      const res = await clientFor(table).select("*");
      if (res.error) throw res.error;
      return rowsOf(res);
    },

    async create(table, record = {}) {
      const row = buildRow(record);
      const res = await clientFor(table).insert(row).select().single();
      if (res.error) throw res.error;
      return res.data;
    },

    async update(table, id, patch = {}) {
      const res = await clientFor(table)
        .eq("id", id)
        .update({ ...toSnakeCase(patch), updated_at: now() })
        .select()
        .single();
      if (res.error) {
        if (isMissingRow(res.error)) return null;
        throw res.error;
      }
      return res.data ?? null;
    },

    async delete(table, id) {
      const res = await clientFor(table).eq("id", id).delete();
      if (res.error) throw res.error;
      return rowsOf(res).length > 0;
    },

    async deleteWhere(table, predicate) {
      const rows = await this.list(table);
      const ids = rows.filter(predicate).map((r) => r.id);
      if (ids.length === 0) return 0;
      const res = await clientFor(table).in("id", ids).delete();
      if (res.error) throw res.error;
      return ids.length;
    },

    clear() {
      throw new Error(
        "clear() is not supported on the hosted Supabase adapter — use deleteWhere for scoped removals"
      );
    },
  };
};