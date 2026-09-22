import { getTable } from "@/lib/tables";

const IDENTITY_KEYS = ["id", "user_id", "created_at", "updated_at"];

const isPlainRecord = (value) =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

/**
 * Read an exported UNI·MATE backup ("{ exported_at, data: { Entity: rows[] } }")
 * and validate its overall shape. Returns { ok: true, bundle } or { ok: false, error }.
 * @param {string} text
 * @returns {{ ok: true, bundle: object } | { ok: false, error: string }}
 */
export const parseExport = (text) => {
  if (typeof text !== "string" || !text.trim()) return { ok: false, error: "empty" };
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: "malformed" };
  }
  if (!isPlainRecord(parsed)) return { ok: false, error: "shape" };
  if (!isPlainRecord(parsed.data)) return { ok: false, error: "shape" };
  return { ok: true, bundle: parsed };
};

/** Entity name -> table name, or null when the entity isn't a known table. */
export const entityTable = (entity) => getTable(entity) || null;

/**
 * Keep only plain record rows for a known entity. Rows keep their identity
 * fields (id / user_id / created_at / updated_at) so a restore into the same
 * store preserves cross-row references (foreign keys stay valid).
 * @param {string} entity
 * @param {unknown} rows
 * @returns {Array<Record<string, unknown>>}
 */
export const sanitizeRows = (entity, rows) => {
  const table = entityTable(entity);
  if (!table || !Array.isArray(rows)) return [];
  return rows.filter(isPlainRecord).map((r) => ({ ...r }));
};

/** Drop the identity/ownership fields a row carries (for re-homing exports). */
export const forgetIdentity = (row) => {
  const out = { ...row };
  IDENTITY_KEYS.forEach((key) => {
    delete out[key];
  });
  return out;
};

/**
 * Decide which rows to create on import: rows whose id already exists in the
 * target store are skipped (the live copy is authoritative, keeping foreign
 * keys stable), the rest are queued for creation as-is.
 * @param {string} entity
 * @param {unknown} rows
 * @param {string[]} [existingIds]
 * @returns {{ entity: string, table: string|null, create: Array<object>, skip: number }}
 */
export const planImport = (entity, rows, existingIds = []) => {
  const clean = sanitizeRows(entity, rows);
  const seen = new Set(existingIds.map((id) => String(id)));
  const create = [];
  let skip = 0;
  clean.forEach((row) => {
    if (row.id && seen.has(String(row.id))) {
      skip += 1;
      return;
    }
    create.push(row);
  });
  return { entity, table: entityTable(entity), create, skip };
};

/**
 * Pure overview of a parsed bundle: known entities with their row counts.
 * @param {object} [data]
 * @returns {Array<{ entity: string, table: string, rows: number }>}
 */
export const summarizeBundle = (data = {}) =>
  Object.entries(data)
    .filter(([entity]) => entityTable(entity))
    .map(([entity, rows]) => ({
      entity,
      table: entityTable(entity),
      rows: sanitizeRows(entity, rows).length,
    }));

/**
 * Run an import against any repository that exposes list(table) and
 * create(table, row). Ids already present are skipped (live copy wins);
 * create failures are counted, not thrown, so one bad row never aborts the rest.
 * @param {{ list: Function, create: Function }} repo
 * @param {object} [data] - bundle.data keyed by entity name
 * @returns {Promise<{ imported: number, skipped: number, failed: number, entities: Array<{ entity: string, table: string, imported: number, skipped: number, failed: number }> }>}
 */
export const runImport = async (repo, data = {}) => {
  const total = { imported: 0, skipped: 0, failed: 0, entities: [] };
  for (const entity of Object.keys(data)) {
    const table = entityTable(entity);
    if (!table) continue;
    let existing = [];
    try {
      existing = (await repo.list(table)) || [];
    } catch {}
    const plan = planImport(entity, data[entity], existing.map((r) => r.id));
    let imported = 0;
    let failed = 0;
    for (const row of plan.create) {
      try {
        await repo.create(table, row);
        imported += 1;
      } catch {
        failed += 1;
      }
    }
    total.imported += imported;
    total.skipped += plan.skip;
    total.failed += failed;
    total.entities.push({ entity, table, imported, skipped: plan.skip, failed });
  }
  return total;
};