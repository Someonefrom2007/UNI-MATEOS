import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createMemoryStorage,
  createCompressedStorageAdapter,
  getDefaultStorage,
  COMPRESS_MARKER,
  MINIFY_THRESHOLD,
} from "@/lib/repo/storage";
import {
  compressString,
  decompressString,
  minifyValue,
  expandValue,
  compressBytes,
  decompressBytes,
} from "@/lib/dataCompressor";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const prose = (i) =>
  `Note ${i}: The central dogma of molecular biology describes the flow of genetic information from DNA to RNA to protein. Transcription produces a messenger RNA copy of a gene, which is then translated by ribosomes into a polypeptide chain. Mutations in regulatory regions can disrupt this process and lead to disease phenotypes we study in practical sessions.`;

const makePayload = () => ({
  notes: Array.from({ length: 10 }, (_, i) => ({
    id: `n${i}`,
    user_id: "u-1",
    created_at: "2026-09-14T00:00:00.000Z",
    updated_at: "2026-09-14T00:00:00.000Z",
    title: `Biochem summary ${i}`,
    content: prose(i),
    category: "bio",
    tags: ["cellular", "regulation", "exam"],
    priority: 2,
    status: "active",
    due_date: `2026-10-0${(i % 9) + 1}`,
    estimated_duration: 120,
    archived: false,
  })),
  tasks: Array.from({ length: 8 }, (_, i) => ({
    id: `t${i}`,
    user_id: "u-1",
    course_id: "c1",
    title: `Problem set ${i}`,
    description: prose(i).slice(0, 300),
    status: "todo",
    priority: (i % 3) + 1,
    due_date: "2026-09-20",
    type: "homework",
  })),
  exams: [
    {
      id: "e1",
      user_id: "u-1",
      course_id: "c1",
      title: "Midterm",
      target_grade: 9,
      current: 0,
      weight: 40,
      date: "2026-11-15",
      room: "A-101",
      color: "#3b82f6",
    },
  ],
});

const payloadString = () => JSON.stringify(makePayload());

// ---------------------------------------------------------------------------
// LZ string round-trip
// ---------------------------------------------------------------------------

describe("compressString / decompressString", () => {
  it("round-trips plain ASCII text", () => {
    const s = "hello world hello world";
    expect(decompressString(compressString(s))).toBe(s);
  });

  it("round-trips non-ASCII characters", () => {
    const s = "café Señora 日本語 ✓ — über naïve";
    expect(decompressString(compressString(s))).toBe(s);
  });

  it("handles empty string and null", () => {
    expect(decompressString(compressString(""))).toBe("");
    expect(decompressString("")).toBe("");
    expect(compressString(null)).toBe("");
  });

  it("compressed output only contains chars 0-255 (binary-string safe)", () => {
    const comp = compressString("a".repeat(1000));
    for (let i = 0; i < comp.length; i += 1)
      expect(comp.charCodeAt(i)).toBeLessThanOrEqual(255);
  });

  it("repeated prose compresses to >60% savings (LZ alone)", () => {
    const s = prose(0).repeat(20);
    const savings = 1 - compressString(s).length / s.length;
    expect(savings).toBeGreaterThan(0.6);
  });

  it("handles numbers serialized in JSON and single-char strings", () => {
    expect(decompressString(compressString("12345"))).toBe("12345");
    expect(decompressString(compressString("x"))).toBe("x");
  });
});

// ---------------------------------------------------------------------------
// Short-key schema transformers
// ---------------------------------------------------------------------------

describe("minifyValue / expandValue", () => {
  const obj = {
    id: "x1",
    user_id: "u1",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-02T00:00:00.000Z",
    title: "Test",
    content: "body",
    due_date: "2026-02-01",
    tags: ["math"],
    nested: { start_time: "09:00", priority: 3, customField: true },
    __unknown: "keep",
  };

  it("shortens known keys and passes unknown keys through unchanged", () => {
    expect(minifyValue(obj)).toEqual({
      i: "x1",
      ui: "u1",
      crt: "2026-01-01T00:00:00.000Z",
      upd: "2026-01-02T00:00:00.000Z",
      t: "Test",
      c: "body",
      dd: "2026-02-01",
      ta: ["math"],
      nested: { st: "09:00", p: 3, customField: true },
      __unknown: "keep",
    });
  });

  it("round-trips deep equality (minify → expand)", () => {
    expect(expandValue(minifyValue(obj))).toEqual(obj);
  });

  it("round-trips arrays at any depth", () => {
    const data = [
      { title: "A", due_date: "2026-01-01", tags: ["x", "y"] },
      [{ priority: 1, nested: { start_time: "08:00", __custom: true } }],
    ];
    expect(expandValue(minifyValue(data))).toEqual(data);
  });

  it("does not mangle primitives", () => {
    expect(minifyValue("hello")).toBe("hello");
    expect(minifyValue(42)).toBe(42);
    expect(minifyValue(null)).toBeNull();
    expect(minifyValue(true)).toBe(true);
    expect(minifyValue(undefined)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// createCompressedStorageAdapter
// ---------------------------------------------------------------------------

describe("createCompressedStorageAdapter", () => {
  it("round-trips a realistic payload and returns the original JSON string", () => {
    const base = createMemoryStorage();
    const adapter = createCompressedStorageAdapter(base);
    const original = payloadString();
    adapter.setItem("notes", original);
    expect(adapter.getItem("notes")).toBe(original);
    expect(base.getItem("notes").startsWith(COMPRESS_MARKER)).toBe(true);
  });

  it("achieves >60% storage savings on realistic text-heavy data", () => {
    const base = createMemoryStorage();
    const adapter = createCompressedStorageAdapter(base);
    const original = payloadString();
    adapter.setItem("notes", original);
    const stored = base.getItem("notes");
    const savings = 1 - stored.length / original.length;
    expect(savings).toBeGreaterThan(0.6);
  });

  it("stores small values (< threshold) verbatim with no marker", () => {
    const base = createMemoryStorage();
    const adapter = createCompressedStorageAdapter(base);
    const tiny = JSON.stringify([{ id: "x", title: "hi" }]);
    adapter.setItem("small", tiny);
    expect(base.getItem("small")).toBe(tiny);
    expect(adapter.getItem("small")).toBe(tiny);
  });

  it("backward-compatible with legacy unmarked plain JSON", () => {
    const base = createMemoryStorage();
    base.setItem(
      "courses",
      '[{"id":"x","title":"Legacy","due_date":"2026-01-01"}]'
    );
    const adapter = createCompressedStorageAdapter(base);
    expect(adapter.getItem("courses")).toBe(
      '[{"id":"x","title":"Legacy","due_date":"2026-01-01"}]'
    );
  });

  it("works transparently across adapter instances on the same base", () => {
    const base = createMemoryStorage();
    const first = createCompressedStorageAdapter(base);
    const original = payloadString();
    first.setItem("tasks", original);
    const second = createCompressedStorageAdapter(base);
    expect(second.getItem("tasks")).toBe(original);
  });

  it("returns raw value (no throw) for a corrupt compressed entry", () => {
    const base = createMemoryStorage();
    base.setItem("x", "umc1:garbage~invalid");
    const adapter = createCompressedStorageAdapter(base);
    expect(adapter.getItem("x")).toBe("umc1:garbage~invalid");
  });

  it("getItem returns null for non-existent keys", () => {
    const base = createMemoryStorage();
    const adapter = createCompressedStorageAdapter(base);
    expect(adapter.getItem("missing")).toBeNull();
  });

  it("delegates removeItem and clear to the base", () => {
    const base = createMemoryStorage();
    const adapter = createCompressedStorageAdapter(base);
    adapter.setItem("a", "1");
    adapter.setItem("b", "2");
    adapter.removeItem("a");
    expect(adapter.getItem("a")).toBeNull();
    expect(adapter.getItem("b")).toBe("2");
    adapter.clear();
    expect(adapter.getItem("b")).toBeNull();
  });

  it("null setItem removes the key", () => {
    const base = createMemoryStorage();
    const adapter = createCompressedStorageAdapter(base);
    adapter.setItem("k", "v");
    adapter.setItem("k", null);
    expect(base.getItem("k")).toBeNull();
  });

  it("never stores a value larger than the original for any payload size", () => {
    const base = createMemoryStorage();
    const adapter = createCompressedStorageAdapter(base);
    const sizes = [
      "[]",
      '{"x":1}',
      JSON.stringify(
        Array.from({ length: 100 }, (_, i) => ({
          id: String(i),
          user_id: "u",
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-01T00:00:00.000Z",
          title: `Item ${i}`,
          content: prose(i),
          priority: i,
          tags: ["a"],
          due_date: "2026-01-01",
          status: "todo",
        }))
      ),
      payloadString(),
    ];
    for (const val of sizes) {
      adapter.setItem("test", val);
      const stored = base.getItem("test");
      expect(stored.length).toBeLessThanOrEqual(val.length);
      expect(adapter.getItem("test")).toBe(val);
    }
  });

  it("round-trips complex nested structures with all mapped short keys", () => {
    const complex = {
      title: "A",
      notes: [{ content: "X", start_time: "09:00" }],
      exams: [{ target_grade: 9, weight: 40 }],
    };
    const base = createMemoryStorage();
    const adapter = createCompressedStorageAdapter(base);
    adapter.setItem("data", JSON.stringify(complex));
    expect(JSON.parse(adapter.getItem("data"))).toEqual(complex);
  });
});

// ---------------------------------------------------------------------------
// getDefaultStorage integration
// ---------------------------------------------------------------------------

describe("getDefaultStorage provides a compressed adapter by default", () => {
  beforeEach(() => getDefaultStorage().clear());
  afterEach(() => getDefaultStorage().clear());

  it("full round-trip through the default storage singleton", () => {
    const storage = getDefaultStorage();
    const original = payloadString();
    storage.setItem("tasks", original);
    expect(storage.getItem("tasks")).toBe(original);
  });
});

// ---------------------------------------------------------------------------
// Async CompressionStream wrappers
// ---------------------------------------------------------------------------

describe("compressBytes / decompressBytes", () => {
  it.runIf(typeof CompressionStream !== "undefined")(
    "round-trips bytes and achieves >60% gzip savings",
    async () => {
      const longText = prose(0).repeat(5);
      const bytes = new TextEncoder().encode(longText);
      const compressed = await compressBytes(bytes);
      const back = await decompressBytes(compressed);
      expect(new TextDecoder().decode(back)).toBe(longText);
      expect(1 - compressed.length / bytes.length).toBeGreaterThan(0.6);
    }
  );

  it.runIf(typeof CompressionStream !== "undefined")(
    "round-trips an entire JSON payload via async wrappers",
    async () => {
      const original = payloadString();
      const bytes = new TextEncoder().encode(original);
      const compressed = await compressBytes(bytes);
      const back = await decompressBytes(compressed);
      expect(new TextDecoder().decode(back)).toBe(original);
    }
  );
});

// ---------------------------------------------------------------------------
// Integration: full repo CRUD through compressed default storage
// ---------------------------------------------------------------------------

describe("integration: localRepo CRUD through compressed default storage", () => {
  let createLocalRepo;
  let repo;

  beforeEach(async () => {
    getDefaultStorage().clear();
    ({ createLocalRepo } = await import("@/lib/repo/localRepo"));
    repo = createLocalRepo({
      storage: getDefaultStorage(),
      userId: "test-user",
      now: () => "2026-09-14T00:00:00.000Z",
      idFactory: () => `tid-${Math.random().toString(36).slice(2, 8)}`,
    });
  });

  afterEach(() => getDefaultStorage().clear());

  it("CRUD round-trips through the compressed adapter", () => {
    const created = repo.create("courses", {
      name: "Biology",
      targetGrade: 9,
    });
    expect(repo.list("courses")).toHaveLength(1);
    expect(repo.list("courses")[0]).toMatchObject({
      name: "Biology",
      target_grade: 9,
    });
    repo.update("courses", created.id, { targetGrade: 8.5 });
    expect(repo.list("courses")[0].target_grade).toBe(8.5);
    expect(repo.delete("courses", created.id)).toBe(true);
    expect(repo.list("courses")).toHaveLength(0);
  });

  it("stores many rows via getDefaultStorage and reads them back identical", () => {
    Array.from({ length: 20 }, (_, i) =>
      repo.create("notes", {
        title: `Note ${i}`,
        content: prose(i),
        due_date: `2026-10-${String(i + 1).padStart(2, "0")}`,
      })
    );
    const storage = getDefaultStorage();
    const readBack = JSON.parse(storage.getItem("notes"));
    expect(readBack).toHaveLength(20);
    expect(readBack[0]).toMatchObject({ title: "Note 0", content: prose(0) });
  });
});
