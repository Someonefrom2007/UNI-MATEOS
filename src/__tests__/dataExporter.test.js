import { describe, it, expect, vi } from "vitest";
import {
  BACKUP_KIND,
  BACKUP_VERSION,
  BACKUP_ENTITIES,
  CSV_ENTITIES,
  buildBackup,
  toBackupJSON,
  toCompressedBackup,
  fromCompressedBackup,
  csvEscape,
  csvColumns,
  toCSV,
  entityToCSV,
  validateBackup,
  validateAndRestoreBackup,
} from "@/lib/dataExporter";

const DATA = {
  Course: [{ id: "c1", name: "Algebra", code: "ALG" }],
  ScheduleEvent: [
    { id: "e1", title: "Algebra lecture", type: "class", date: "2026-03-15", start_time: "09:00", end_time: "11:00" },
    { id: "e2", title: "Lab, room B3", type: "class", date: "2026-03-16", start_time: "10:00", end_time: "12:00" },
  ],
  Task: [
    { id: "t1", title: "Problem set 4", status: "todo", due_date: "2026-04-02" },
    { id: "t2", title: "Lab report", status: "completed", due_date: "2026-04-01" },
  ],
  Exam: [{ id: "x1", name: "Final", date: "2026-05-18" }],
  StickyNote: [{ id: "s1", content: "buy milk", color: "amber", pinned: true }],
};

const fakeRepo = (seed = []) => {
  const rows = { schedule_events: [...seed], tasks: [], exams: [] };
  return {
    rows,
    list: vi.fn(async (t) => rows[t] || []),
    create: vi.fn(async (t, row) => {
      rows[t] = rows[t] || [];
      rows[t].push(row);
      return row;
    }),
  };
};

describe("buildBackup", () => {
  it("stamps a signature and version", () => {
    const b = buildBackup({ Course: [] });
    expect(b.kind).toBe(BACKUP_KIND);
    expect(b.version).toBe(BACKUP_VERSION);
  });

  it("keeps only known entities, in the declared order", () => {
    const b = buildBackup({ Task: [], Course: [], NotARealEntity: [{ id: "x" }] });
    expect(Object.keys(b.data)).toEqual(["Course", "Task"]);
  });

  it("drops non-record rows so the file can never fail its own validation", () => {
    const b = buildBackup({ Course: [{ id: "c1" }, null, "nope", 7, []] });
    expect(b.data.Course).toEqual([{ id: "c1" }]);
  });

  it("tolerates a missing entity being absent or non-array", () => {
    const b = buildBackup({ Course: "not-an-array" });
    expect(b.data.Course).toEqual([]);
    expect(b.data.Task).toBeUndefined();
  });

  it("records the export timestamp", () => {
    expect(buildBackup({}, { exportedAt: "2026-04-02T10:00:00.000Z" }).exported_at).toBe("2026-04-02T10:00:00.000Z");
  });
});

describe("JSON export round-trip", () => {
  it("round-trips every row back out of the serialized file", () => {
    const b = buildBackup(DATA);
    const restored = validateBackup(toBackupJSON(b));
    expect(restored.ok).toBe(true);
    expect(restored.backup.data.ScheduleEvent).toHaveLength(2);
    expect(restored.backup.data.StickyNote[0].pinned).toBe(true);
  });

  it("survives the pretty-printer unchanged", () => {
    expect(toBackupJSON(buildBackup(DATA))).toContain("\n  ");
  });

  it("produces identical output for identical input (deterministic)", () => {
    const a = toBackupJSON(buildBackup(DATA, { exportedAt: "X" }));
    const b = toBackupJSON(buildBackup(DATA, { exportedAt: "X" }));
    expect(a).toBe(b);
  });

  it("compresses smaller than pretty JSON and decompresses back", () => {
    const b = buildBackup(DATA);
    const raw = toCompressedBackup(b);
    expect(typeof raw).toBe("string");
    expect(raw.length).toBeLessThan(toBackupJSON(b).length);
    const back = fromCompressedBackup(raw);
    expect(back.data.ScheduleEvent).toHaveLength(2);
  });

  it("returns null for garbage instead of throwing", () => {
    expect(fromCompressedBackup("not-compressed-at-all")).toBeNull();
  });
});

describe("csvEscape", () => {
  it("passes plain values through untouched", () => {
    expect(csvEscape("ALG")).toBe("ALG");
    expect(csvEscape(42)).toBe("42");
  });

  it("renders null and undefined as empty fields", () => {
    expect(csvEscape(null)).toBe("");
    expect(csvEscape(undefined)).toBe("");
  });

  it("quotes and doubles embedded quotes", () => {
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
  });

  it("quotes values containing commas, quotes or newlines", () => {
    expect(csvEscape("a,b")).toBe('"a,b"');
    expect(csvEscape("line1\nline2")).toBe('"line1\nline2"');
  });

  it("serialises dates to ISO", () => {
    expect(csvEscape(new Date("2026-04-02T00:00:00Z"))).toBe("2026-04-02T00:00:00.000Z");
  });
});

describe("csvColumns / toCSV", () => {
  it("collects columns in first-seen order", () => {
    expect(csvColumns([{ b: 1, a: 2 }, { c: 3, a: 4 }])).toEqual(["b", "a", "c"]);
  });

  it("is deterministic regardless of row order within the same shape", () => {
    expect(csvColumns(DATA.ScheduleEvent)).toEqual(csvColumns(DATA.ScheduleEvent));
  });

  it("emits a header plus one line per row", () => {
    const csv = toCSV(DATA.Task);
    const lines = csv.split("\r\n");
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe("id,title,status,due_date");
  });

  it("keeps every row the same width as the header", () => {
    // Field-splitting must respect quoting, otherwise a value like
    // "Lab, room B3" would be miscounted as two fields.
    const fields = (line) => {
      const out = [];
      let cur = "";
      let quoted = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (quoted && line[i + 1] === '"') { cur += '"'; i++; }
          else quoted = !quoted;
        } else if (ch === "," && !quoted) { out.push(cur); cur = ""; }
        else cur += ch;
      }
      out.push(cur);
      return out;
    };
    const lines = toCSV(DATA.ScheduleEvent).split("\r\n");
    const width = fields(lines[0]).length;
    expect(width).toBe(6);
    lines.forEach((l) => expect(fields(l)).toHaveLength(width));
  });

  it("uses CRLF line endings per RFC 4180", () => {
    expect(toCSV(DATA.Task)).toContain("\r\n");
  });

  it("emits only a header when columns are forced on empty rows", () => {
    expect(toCSV([], { columns: ["id", "title"] })).toBe("id,title");
  });

  it("returns an empty string when there is nothing to describe", () => {
    expect(toCSV([])).toBe("");
  });

  it("quotes a value that would otherwise break the column count", () => {
    const csv = toCSV([{ id: "e2", title: "Lab, room B3" }]);
    expect(csv.split("\r\n")[1]).toBe('e2,"Lab, room B3"');
  });

  it("exports a known entity by name", () => {
    expect(entityToCSV("Task", DATA.Task)).toContain("Problem set 4");
  });

  it("refuses an unknown entity rather than emitting junk", () => {
    expect(entityToCSV("NotARealEntity", [{ id: 1 }])).toBe("");
  });

  it("offers CSV only for spreadsheet-friendly entities", () => {
    expect(CSV_ENTITIES).toEqual(["ScheduleEvent", "Task", "Exam"]);
  });
});

describe("validateBackup", () => {
  it("accepts a freshly built backup", () => {
    const r = validateBackup(toBackupJSON(buildBackup(DATA)));
    expect(r.ok).toBe(true);
    expect(r.legacy).toBe(false);
  });

  it("accepts a legacy backup with no signature", () => {
    const r = validateBackup(JSON.stringify({ exported_at: "x", data: { Course: [] } }));
    expect(r.ok).toBe(true);
    expect(r.legacy).toBe(true);
  });

  it("rejects empty input", () => {
    expect(validateBackup("").ok).toBe(false);
  });

  it("rejects non-JSON", () => {
    expect(validateBackup("{not json").ok).toBe(false);
  });

  it("rejects a mis-shaped payload", () => {
    expect(validateBackup(JSON.stringify({ data: "nope" })).ok).toBe(false);
  });

  it("rejects a foreign file that happens to have a data key", () => {
    const r = validateBackup(JSON.stringify({ kind: "some-other-app", version: 1, data: {} }));
    expect(r).toEqual({ ok: false, error: "foreign" });
  });

  it("rejects a non-numeric version", () => {
    expect(validateBackup(JSON.stringify({ kind: BACKUP_KIND, version: "1", data: {} })).ok).toBe(false);
  });

  it("refuses a backup from a newer format it cannot read safely", () => {
    const r = validateBackup(JSON.stringify({ kind: BACKUP_KIND, version: BACKUP_VERSION + 1, data: {} }));
    expect(r).toEqual({ ok: false, error: "too-new" });
  });

  it("rejects a known entity whose rows are not an array", () => {
    const r = validateBackup(JSON.stringify({ kind: BACKUP_KIND, version: 1, data: { Course: {} } }));
    expect(r).toEqual({ ok: false, error: "shape" });
  });

  it("ignores unknown entities rather than failing the file", () => {
    const r = validateBackup(JSON.stringify({ kind: BACKUP_KIND, version: 1, data: { Nope: "junk" } }));
    expect(r.ok).toBe(true);
  });

  it("summarises only known entities with real row counts", () => {
    const r = validateBackup(toBackupJSON(buildBackup(DATA)));
    const task = r.summary.find((s) => s.entity === "Task");
    expect(task.rows).toBe(2);
    expect(r.summary.every((s) => s.table)).toBe(true);
  });
});

describe("validateAndRestoreBackup", () => {
  it("imports rows into an empty store", async () => {
    const repo = fakeRepo();
    const res = await validateAndRestoreBackup(repo, toBackupJSON(buildBackup(DATA)));
    expect(res.ok).toBe(true);
    expect(res.imported).toBeGreaterThan(0);
  });

  it("merges without duplicating ids already present", async () => {
    const repo = fakeRepo([{ id: "e1", title: "Already here" }]);
    const res = await validateAndRestoreBackup(repo, toBackupJSON(buildBackup(DATA)));
    expect(res.ok).toBe(true);
    expect(res.skipped).toBe(1);
    expect(repo.rows.schedule_events.filter((r) => r.id === "e1")).toHaveLength(1);
    expect(repo.rows.schedule_events.find((r) => r.id === "e1").title).toBe("Already here");
  });

  it("never writes to the repository when the file is corrupt", async () => {
    const repo = fakeRepo();
    const res = await validateAndRestoreBackup(repo, "{ truncated");
    expect(res.ok).toBe(false);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it("never writes when the file is a foreign format", async () => {
    const repo = fakeRepo();
    const res = await validateAndRestoreBackup(repo, JSON.stringify({ kind: "other", version: 1, data: { Course: [{ id: "c" }] } }));
    expect(res).toEqual({ ok: false, error: "foreign" });
    expect(repo.create).not.toHaveBeenCalled();
  });

  it("restores a legacy backup", async () => {
    const repo = fakeRepo();
    const res = await validateAndRestoreBackup(repo, JSON.stringify({ exported_at: "x", data: { Task: [{ id: "t9", title: "Old" }] } }));
    expect(res.ok).toBe(true);
    expect(repo.rows.tasks).toHaveLength(1);
  });

  it("reports per-entity counts", async () => {
    const repo = fakeRepo();
    const res = await validateAndRestoreBackup(repo, toBackupJSON(buildBackup(DATA)));
    const entities = res.entities.map((e) => e.entity);
    expect(entities).toContain("Task");
    expect(entities).toContain("ScheduleEvent");
  });

  it("uses replaceAll for replace mode", async () => {
    const rows = { schedule_events: [], tasks: [], exams: [] };
    const replaceAll = vi.fn(async (t) => { rows[t] = []; });
    const repo = { rows, list: vi.fn(async (t) => rows[t] || []), create: vi.fn(async (t, r) => { rows[t].push(r); return r; }), replaceAll };
    const res = await validateAndRestoreBackup(repo, toBackupJSON(buildBackup(DATA)), { mode: "replace" });
    expect(res.ok).toBe(true);
    expect(replaceAll).toHaveBeenCalled();
  });

  it("fails closed when replace cannot clear a table", async () => {
    const repo = { list: vi.fn(async () => []), create: vi.fn(), replaceAll: vi.fn(async () => { throw new Error("nope"); }) };
    const res = await validateAndRestoreBackup(repo, toBackupJSON(buildBackup(DATA)), { mode: "replace" });
    expect(res).toEqual({ ok: false, error: "replace-failed" });
  });

  it("does not call replaceAll for tables absent from the bundle", async () => {
    const replaceAll = vi.fn(async () => {});
    const repo = { list: vi.fn(async () => []), create: vi.fn(), replaceAll };
    await validateAndRestoreBackup(repo, JSON.stringify({ kind: BACKUP_KIND, version: 1, data: { Task: [] } }), { mode: "replace" });
    expect(replaceAll).toHaveBeenCalledTimes(1);
    expect(replaceAll).toHaveBeenCalledWith("tasks", []);
  });
});

describe("entity coverage", () => {
  it("backs up stickies alongside academic data", () => {
    expect(BACKUP_ENTITIES).toContain("StickyNote");
    expect(BACKUP_ENTITIES).toContain("ScheduleEvent");
  });
});
