// Backup export engine — pure, so the Settings UI stays a thin shell and the
// format is unit-testable without a repository, a browser, or the DOM.
//
// The restore side already lives in dataImport.js (parseExport / planImport /
// runImport). This module owns the *write* half plus validation, and composes
// those existing pieces rather than reimplementing them.
//
// Backward compatibility matters here: backups written by earlier builds carry
// no `kind`/`version`, so validation treats them as legacy v0 and accepts them
// as long as the `{ data: { Entity: rows[] } } }` shape holds.

import { compressPayload, decompressPayload } from "@/lib/dataCompressor";
import { parseExport, summarizeBundle, runImport } from "@/lib/dataImport";
import { getTable } from "@/lib/tables";

export const BACKUP_KIND = "unimate-backup";
export const BACKUP_VERSION = 1;

// Entities written to a .unimate backup. Mirrors the Settings EXPORT_ENTITIES
// list plus stickies, which is the set a user would expect to recover.
export const BACKUP_ENTITIES = Object.freeze([
  "Course", "ScheduleEvent", "Task", "Exam", "Grade", "Note", "Resource",
  "FocusSession", "Goal", "Habit", "HabitLog", "Project", "Attendance",
  "StickyNote",
]);

// Entities offered as spreadsheet exports. Grades/notes are deliberately absent:
// they are prose/grades, and a CSV of them adds nothing over the JSON backup.
export const CSV_ENTITIES = Object.freeze(["ScheduleEvent", "Task", "Exam"]);

const isPlainRecord = (v) => Boolean(v && typeof v === "object" && !Array.isArray(v));

/**
 * Assemble a backup bundle from a `{ Entity: rows[] }` map.
 * Only known entities are kept, and only plain-record rows, so a bad payload can
 * never produce a file that later fails its own validation.
 */
export const buildBackup = (data = {}, { exportedAt = new Date().toISOString() } = {}) => {
  const out = {};
  for (const entity of BACKUP_ENTITIES) {
    if (!Object.prototype.hasOwnProperty.call(data, entity)) continue;
    const rows = Array.isArray(data[entity]) ? data[entity] : [];
    out[entity] = rows.filter(isPlainRecord);
  }
  return { kind: BACKUP_KIND, version: BACKUP_VERSION, exported_at: exportedAt, data: out };
};

/** Pretty-printed JSON. Human-diffable, still a valid restore payload. */
export const toBackupJSON = (backup) => JSON.stringify(backup, null, 2);

/**
 * Compressed variant. Reuses the dataCompressor minify+LZ path, so an export is
 * far smaller on disk than the pretty JSON. Restore via fromCompressedBackup.
 */
export const toCompressedBackup = (backup) => compressPayload(backup);

export const fromCompressedBackup = (raw) => {
  try {
    const value = decompressPayload(raw);
    return isPlainRecord(value) ? value : null;
  } catch {
    return null;
  }
};

/** RFC 4180 field escaping: wrap when needed and double any inner quote. */
export const csvEscape = (value) => {
  if (value === null || value === undefined) return "";
  const s = value instanceof Date ? value.toISOString() : String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/**
 * Deterministic column order: keys in first-seen order across the rows, so a
 * CSV re-exported twice produces byte-identical output.
 */
export const csvColumns = (rows = []) => {
  const cols = [];
  const seen = new Set();
  for (const row of rows) {
    if (!isPlainRecord(row)) continue;
    for (const key of Object.keys(row)) {
      if (!seen.has(key)) {
        seen.add(key);
        cols.push(key);
      }
    }
  }
  return cols;
};

/**
 * Render one entity's rows as CSV. Empty input still emits just the header when
 * columns are supplied, so a header-only file is a valid (if empty) export.
 */
export const toCSV = (rows = [], { columns = null } = {}) => {
  const cols = columns || csvColumns(rows);
  if (!cols.length) return "";
  const lines = [cols.map(csvEscape).join(",")];
  for (const row of rows) {
    if (!isPlainRecord(row)) continue;
    lines.push(cols.map((c) => csvEscape(row[c])).join(","));
  }
  return lines.join("\r\n");
};

/** Convenience: entity name -> CSV string, for a known entity. */
export const entityToCSV = (entity, rows = []) =>
  getTable(entity) ? toCSV(Array.isArray(rows) ? rows : []) : "";

/**
 * Validate a backup file's text before anything touches the repository.
 * Delegates shape parsing to dataImport.parseExport so both halves agree, then
 * adds signature and entity checks on top.
 *
 * Legacy bundles (no `kind`) are accepted when the shape holds, because users
 * are holding files exported by previous builds.
 *
 * @returns {{ ok: true, backup: object, legacy: boolean, summary: Array } | { ok: false, error: string }}
 */
export const validateBackup = (text) => {
  const parsed = parseExport(text);
  // `in` narrowing rather than a `.ok` check: JSDoc renders a bare `true`/`false`
  // in a union as plain boolean, so the `ok` flag is not a usable discriminant.
  if ("error" in parsed) return { ok: false, error: parsed.error };

  const { data } = parsed.bundle;
  const legacy = parsed.bundle.kind === undefined;
  if (!legacy) {
    if (parsed.bundle.kind !== BACKUP_KIND) return { ok: false, error: "foreign" };
    if (typeof parsed.bundle.version !== "number") return { ok: false, error: "version" };
    // A newer major format may reorder/rename fields we cannot safely read.
    if (parsed.bundle.version > BACKUP_VERSION) return { ok: false, error: "too-new" };
  }

  for (const [entity, rows] of Object.entries(data)) {
    if (!getTable(entity)) continue; // unknown entities are ignored, not fatal
    if (!Array.isArray(rows)) return { ok: false, error: "shape" };
  }

  return { ok: true, backup: parsed.bundle, legacy, summary: summarizeBundle(data) };
};

/**
 * Validate then restore. Corrupt input never reaches the repository — the
 * function returns before any write, so a bad file cannot destroy local data.
 *
 * mode "merge"   -> skip ids already present (default; live copy wins)
 * mode "replace" -> wipe the known tables first, then insert
 *
 * @param {{ list: Function, create: Function, replaceAll?: Function }} repo
 * @param {string} text
 * @returns {Promise<{ ok: boolean, error?: string, imported?: number, skipped?: number, failed?: number, entities?: Array }>}
 */
export const validateAndRestoreBackup = async (repo, text, { mode = "merge" } = {}) => {
  const check = validateBackup(text);
  if ("error" in check) return { ok: false, error: check.error };

  if (mode === "replace") {
    // Only wipe entities the bundle actually carries, so a partial file cannot
    // silently erase tables the user never exported.
    for (const entity of Object.keys(check.backup.data)) {
      if (!getTable(entity)) continue;
      try {
        if (typeof repo.replaceAll === "function") await repo.replaceAll(getTable(entity), check.backup.data[entity]);
      } catch {
        return { ok: false, error: "replace-failed" };
      }
    }
  }

  const result = await runImport(repo, check.backup.data);
  return { ok: true, imported: result.imported, skipped: result.skipped, failed: result.failed, entities: result.entities };
};
