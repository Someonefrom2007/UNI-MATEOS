// Local-first repository: an injectable, storage-backed CRUD layer exposing the
// same Table/entity surface as the Supabase adapter. Rows are kept as arrays of
// snake_case records with id / user_id / created_at / updated_at injected on
// create — mirroring what useUserData returns today.
import { getDefaultStorage } from "@/lib/repo/storage";

export const newId = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const snakeCaseKey = (key) => key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

const toSnakeCase = (obj) => {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return obj;
  const out = {};
  Object.keys(obj).forEach((k) => {
    out[snakeCaseKey(k)] = obj[k];
  });
  return out;
};

export const createLocalRepo = ({
  storage = getDefaultStorage(),
  userId = "local-workspace",
  now = () => new Date().toISOString(),
  idFactory = newId,
} = {}) => {
  const readTable = (table) => {
    const raw = storage.getItem(table);
    if (raw == null) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const writeTable = (table, rows) => {
    storage.setItem(table, JSON.stringify(rows));
  };

  return {
    list(table) {
      return readTable(table);
    },

    create(table, record = {}) {
      const rows = readTable(table);
      const row = {
        ...toSnakeCase(record),
        id: record.id || idFactory(),
        user_id: record.user_id || userId,
        created_at: record.created_at || now(),
        updated_at: record.updated_at || now(),
      };
      rows.push(row);
      writeTable(table, rows);
      return row;
    },

    update(table, id, patch = {}) {
      const rows = readTable(table);
      const idx = rows.findIndex((r) => String(r.id) === String(id));
      if (idx === -1) return null;
      const current = rows[idx];
      const updated = {
        ...current,
        ...toSnakeCase(patch),
        id: current.id,
        created_at: current.created_at,
        updated_at: now(),
      };
      rows[idx] = updated;
      writeTable(table, rows);
      return updated;
    },

    delete(table, id) {
      const rows = readTable(table);
      const next = rows.filter((r) => String(r.id) !== String(id));
      const removed = next.length !== rows.length;
      if (removed) writeTable(table, next);
      return removed;
    },

    deleteWhere(table, predicate) {
      const rows = readTable(table);
      const next = rows.filter((r) => !predicate(r));
      const removed = rows.length - next.length;
      if (removed) writeTable(table, next);
      return removed;
    },

    clear(table) {
      storage.removeItem(table);
    },
  };
};