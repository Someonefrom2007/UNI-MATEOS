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
import { resolveTable, usesIdentityPrimaryKey } from "@/lib/tables";

const isMissingRow = (error) =>
  Boolean(
    error &&
      (error.code === "PGRST116" ||
        /no rows|row not found|not found|does not exist/i.test(String(error.message || "")))
  );

const rowsOf = (res) => res.data ?? [];

/**
 * Hosted repository adapter over a supabase-js client.
 * @param {object} [options={}]
 * @param {object} [options.client] - supabase-js client
 * @param {string|(() => Promise<?string>)} [options.userId] - row owner id (RLS
 *   scope) or a resolver for it; resolved on first use so the shared repo can
 *   stay valid across session restore. Unknown owners omit user_id and let the
 *   database default auth.uid().
 * @param {() => string} [options.now]       - timestamp factory
 * @param {() => string} [options.idFactory] - row id factory
 */
export const createSupabaseRepo = ({
  client,
  userId = "supabase-user",
  now = () => new Date().toISOString(),
  idFactory = newId,
} = {}) => {
  const resolveOwner = async () => {
    if (typeof userId === "function") return (await userId()) || null;
    return userId || null;
  };

  // Single choke point where a caller-supplied table name becomes a physical
  // table. Entity names ("User") are mapped to snake_case here, so a caller
  // can never issue a query against a table that does not exist.
  const clientFor = (table) => client.from(resolveTable(table));

  return {
    async list(table) {
      const res = await clientFor(table).select("*");
      if (res.error) throw res.error;
      return rowsOf(res);
    },

    async create(table, record = {}) {
      const owner = await resolveOwner();
      const row = {
        ...toSnakeCase(record),
        // bigint IDENTITY tables (waitlist, audit_log) are assigned server
        // side. Injecting a UUID there is Postgres 22P02 invalid input syntax
        // for type bigint — the hosted waitlist signup died on this.
        ...(usesIdentityPrimaryKey(table) ? {} : { id: record.id || idFactory() }),
        created_at: record.created_at || now(),
        updated_at: record.updated_at || now(),
      };
      // Only stamp ownership when it's known — otherwise the DB fills
      // auth.uid() through its own default (guarantees RLS on the insert).
      if (record.user_id) row.user_id = record.user_id;
      else if (owner) row.user_id = owner;
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