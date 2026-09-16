import { describe, it, expect, beforeEach } from "vitest";
import {
  ANCHOR_DEFAULTS,
  MINIMIZED_SIZE,
  PIN_LIMITS,
  VIEWPORT,
  clampPin,
  createAnchor,
  minimizeToCorner,
  restorePin,
  toggleMinimize,
  moveAnchor,
  resizeAnchor,
  nextZ,
  bringToFront,
  upsertAnchor,
  removeAnchor,
  normalizeAnchors,
  compressAnchors,
  decompressAnchors,
  createAnchoredStore,
} from "@/lib/anchoredStickies";
import { createMemoryStorage } from "@/lib/repo/storage";

const vp = { width: 1024, height: 768 };

const makePin = (overrides = {}) => ({
  stickyId: "a1",
  x: 80,
  y: 96,
  width: ANCHOR_DEFAULTS.width,
  height: ANCHOR_DEFAULTS.height,
  minimized: false,
  z: 1,
  ...overrides,
});

describe("clampPin", () => {
  it("keeps a valid pin inside viewport unchanged", () => {
    const pin = makePin();
    expect(clampPin(pin, vp)).toEqual(pin);
  });

  it("clamps width and height to minimums", () => {
    const pin = makePin({ width: 40, height: 30 });
    const clamped = clampPin(pin, vp);
    expect(clamped.width).toBe(PIN_LIMITS.min.width);
    expect(clamped.height).toBe(PIN_LIMITS.min.height);
  });

  it("clamps width and height to maximums", () => {
    const pin = makePin({ width: 800, height: 600 });
    const clamped = clampPin(pin, vp);
    expect(clamped.width).toBe(PIN_LIMITS.max.width);
    expect(clamped.height).toBe(PIN_LIMITS.max.height);
  });

  it("clamps x and y to stay inside viewport", () => {
    const pin = makePin({ x: -50, y: -50 });
    const clamped = clampPin(pin, vp);
    expect(clamped.x).toBe(8);
    expect(clamped.y).toBe(8);
  });

  it("clamps x so pin does not extend past right edge", () => {
    const pin = makePin({ x: vp.width, y: 96 });
    const clamped = clampPin(pin, vp);
    expect(clamped.x + clamped.width).toBeLessThanOrEqual(vp.width);
  });

  it("clamps y so pin does not extend past bottom edge", () => {
    const pin = makePin({ y: vp.height, x: 80 });
    const clamped = clampPin(pin, vp);
    expect(clamped.y + clamped.height).toBeLessThanOrEqual(vp.height);
  });

  it("fills missing coordinates with defaults", () => {
    const pin = { stickyId: "a1" };
    const clamped = clampPin(pin, vp);
    expect(clamped.x).toBe(8);
    expect(clamped.y).toBe(8);
    expect(clamped.width).toBe(ANCHOR_DEFAULTS.width);
    expect(clamped.height).toBe(ANCHOR_DEFAULTS.height);
  });
});

describe("createAnchor", () => {
  it("places the anchor top-right just below the header", () => {
    const anchor = createAnchor({ stickyId: "s1", viewport: vp, z: 3 });
    expect(anchor.stickyId).toBe("s1");
    expect(anchor.x).toBe(vp.width - ANCHOR_DEFAULTS.width - 24);
    expect(anchor.y).toBe(88);
    expect(anchor.minimized).toBe(false);
    expect(anchor.z).toBe(3);
  });

  it("uses provided width/height", () => {
    const anchor = createAnchor({ stickyId: "s1", viewport: vp, width: 320, height: 200 });
    expect(anchor.width).toBe(320);
    expect(anchor.height).toBe(200);
  });

  it("clamps to viewport when custom size is too large", () => {
    const anchor = createAnchor({ stickyId: "s1", viewport: { width: 300, height: 300 }, width: 500, height: 400 });
    expect(anchor.width).toBeLessThanOrEqual(PIN_LIMITS.max.width);
    expect(anchor.height).toBeLessThanOrEqual(PIN_LIMITS.max.height);
  });
});

describe("minimizeToCorner / restorePin / toggleMinimize", () => {
  it("minimizes to compact corner chip and remembers open size", () => {
    const pin = makePin({ width: 300, height: 220 });
    const mini = minimizeToCorner(pin, vp);
    expect(mini.minimized).toBe(true);
    expect(mini.width).toBe(MINIMIZED_SIZE.width);
    expect(mini.height).toBe(MINIMIZED_SIZE.height);
    expect(mini.openWidth).toBe(300);
    expect(mini.openHeight).toBe(220);
    expect(mini.x + mini.width).toBeLessThanOrEqual(vp.width);
    expect(mini.y + mini.height).toBeLessThanOrEqual(vp.height);
  });

  it("restores the original open size when unminimized", () => {
    const pin = makePin({ minimized: true, openWidth: 310, openHeight: 230 });
    const restored = restorePin(pin, vp);
    expect(restored.minimized).toBe(false);
    expect(restored.width).toBe(310);
    expect(restored.height).toBe(230);
    expect(restored.openWidth).toBeUndefined();
    expect(restored.openHeight).toBeUndefined();
  });

  it("toggleMinimize opens an open pin", () => {
    const pin = makePin({ width: 280, height: 180 });
    const toggled = toggleMinimize(pin, vp);
    expect(toggled.minimized).toBe(true);
    expect(toggled.openWidth).toBe(280);
    expect(toggled.openHeight).toBe(180);
  });

  it("toggleMinimize closes a minimized pin", () => {
    const pin = makePin({ minimized: true, openWidth: 280, openHeight: 180 });
    const toggled = toggleMinimize(pin, vp);
    expect(toggled.minimized).toBe(false);
    expect(toggled.width).toBe(280);
    expect(toggled.height).toBe(180);
  });

  it("double-toggle preserves original size", () => {
    const pin = makePin({ width: 260, height: 200 });
    const back = toggleMinimize(toggleMinimize(pin, vp), vp);
    expect(back.minimized).toBe(false);
    expect(back.width).toBe(260);
    expect(back.height).toBe(200);
  });
});

describe("moveAnchor / resizeAnchor", () => {
  it("moves to exact position inside viewport", () => {
    const pin = makePin();
    const moved = moveAnchor(pin, { x: 100, y: 200 }, vp);
    expect(moved.x).toBe(100);
    expect(moved.y).toBe(200);
  });

  it("clamps movement to viewport bounds", () => {
    const pin = makePin();
    const moved = moveAnchor(pin, { x: 9999, y: 9999 }, vp);
    expect(moved.x + moved.width).toBeLessThanOrEqual(vp.width);
    expect(moved.y + moved.height).toBeLessThanOrEqual(vp.height);
  });

  it("resizes to requested dimensions", () => {
    const pin = makePin();
    const resized = resizeAnchor(pin, { width: 350, height: 250 }, vp);
    expect(resized.width).toBe(350);
    expect(resized.height).toBe(250);
  });

  it("clamps resize to limits", () => {
    const pin = makePin();
    const tooSmall = resizeAnchor(pin, { width: 10, height: 10 }, vp);
    expect(tooSmall.width).toBe(PIN_LIMITS.min.width);
    expect(tooSmall.height).toBe(PIN_LIMITS.min.height);
    const tooLarge = resizeAnchor(pin, { width: 900, height: 700 }, vp);
    expect(tooLarge.width).toBe(PIN_LIMITS.max.width);
    expect(tooLarge.height).toBe(PIN_LIMITS.max.height);
  });
});

describe("z-index ordering", () => {
  it("nextZ returns 1 for empty array", () => {
    expect(nextZ([])).toBe(1);
  });

  it("nextZ returns max+1", () => {
    expect(nextZ([{ z: 3 }, { z: 7 }, { z: 5 }])).toBe(8);
  });

  it("bringToFront pushes the selected pin to the top", () => {
    const pins = [
      { stickyId: "a1", z: 1 },
      { stickyId: "a2", z: 5 },
      { stickyId: "a3", z: 3 },
    ];
    const reordered = bringToFront(pins, "a1");
    const a1 = reordered.find((p) => p.stickyId === "a1");
    expect(a1.z).toBe(6);
  });

  it("bringToFront returns same array if sticky not found", () => {
    const pins = [{ stickyId: "a1", z: 1 }];
    expect(bringToFront(pins, "missing")).toBe(pins);
  });
});

describe("upsertAnchor / removeAnchor", () => {
  it("upsert adds a new anchor", () => {
    const result = upsertAnchor([], makePin({ stickyId: "a1" }));
    expect(result).toHaveLength(1);
    expect(result[0].stickyId).toBe("a1");
  });

  it("upsert replaces an existing anchor with the same stickyId", () => {
    const pins = [makePin({ stickyId: "a1", z: 1 }), makePin({ stickyId: "a2", z: 2 })];
    const result = upsertAnchor(pins, makePin({ stickyId: "a1", z: 3 }));
    expect(result).toHaveLength(2);
    expect(result.find((p) => p.stickyId === "a1").z).toBe(3);
  });

  it("removeAnchor drops the matching anchor", () => {
    const pins = [makePin({ stickyId: "a1" }), makePin({ stickyId: "a2" })];
    expect(removeAnchor(pins, "a1")).toHaveLength(1);
    expect(removeAnchor(pins, "a1")[0].stickyId).toBe("a2");
  });
});

describe("normalizeAnchors", () => {
  it("returns empty for non-array input", () => {
    expect(normalizeAnchors(null)).toEqual([]);
    expect(normalizeAnchors(undefined)).toEqual([]);
    expect(normalizeAnchors("garbage")).toEqual([]);
  });

  it("drops malformed entries and clamps valid ones", () => {
    const result = normalizeAnchors([{ stickyId: "a1" }, null, { noStickyId: true }, { stickyId: "a2", x: 99999 }], vp);
    expect(result).toHaveLength(2);
    expect(result[0].stickyId).toBe("a1");
    expect(result[1].stickyId).toBe("a2");
    expect(result[1].x + result[1].width).toBeLessThanOrEqual(vp.width);
  });
});

describe("compressed persistence round-trip", () => {
  it("compressAnchors produces a string shorter than uncompressed JSON", () => {
    const pins = Array.from({ length: 10 }, (_, i) => makePin({ stickyId: `s${i}`, z: i + 1 }));
    const raw = JSON.stringify(pins);
    const compressed = compressAnchors(pins);
    expect(typeof compressed).toBe("string");
    expect(compressed.length).toBeLessThan(raw.length);
  });

  it("decompressAnchors round-trips the full anchor set", () => {
    const pins = [
      makePin({ stickyId: "s1", x: 10, y: 20, width: 200, height: 150, z: 1 }),
      makePin({ stickyId: "s2", x: 300, y: 400, minimized: true, openWidth: 280, openHeight: 200, z: 2 }),
    ];
    const compressed = compressAnchors(pins);
    const restored = decompressAnchors(compressed);
    expect(restored).toHaveLength(2);
    const s1 = restored.find((p) => p.stickyId === "s1");
    expect(s1.x).toBe(10);
    expect(s1.y).toBe(20);
    expect(s1.width).toBe(200);
    expect(s1.height).toBe(150);
    const s2 = restored.find((p) => p.stickyId === "s2");
    expect(s2.minimized).toBe(true);
    expect(s2.openWidth).toBe(280);
    expect(s2.openHeight).toBe(200);
  });

  it("decompressAnchors returns [] for null or garbage", () => {
    expect(decompressAnchors(null)).toEqual([]);
    expect(decompressAnchors("not-valid-compressed-data!!!")).toEqual([]);
  });

  it("round-trips through a memory storage adapter", () => {
    const storage = createMemoryStorage();
    const store = createAnchoredStore({ storage, key: "test-anchors" });
    store.pin("s1", vp);
    store.pin("s2", vp);
    expect(storage.getItem("test-anchors")).toBeTruthy();
    const store2 = createAnchoredStore({ storage, key: "test-anchors" });
    expect(store2.list()).toHaveLength(2);
    expect(store2.list().some((a) => a.stickyId === "s1")).toBe(true);
    expect(store2.list().some((a) => a.stickyId === "s2")).toBe(true);
  });
});

describe("createAnchoredStore", () => {
  let storage;

  beforeEach(() => {
    storage = createMemoryStorage();
  });

  it("pin adds an anchor and persists", () => {
    const store = createAnchoredStore({ storage, key: "a" });
    store.pin("s1", vp);
    expect(store.list()).toHaveLength(1);
    expect(store.list()[0].stickyId).toBe("s1");
  });

  it("pin does not duplicate if already pinned", () => {
    const store = createAnchoredStore({ storage, key: "a" });
    store.pin("s1", vp);
    store.pin("s1", vp);
    expect(store.list()).toHaveLength(1);
  });

  it("unpin removes the anchor", () => {
    const store = createAnchoredStore({ storage, key: "a" });
    store.pin("s1", vp);
    store.unpin("s1");
    expect(store.list()).toHaveLength(0);
  });

  it("update applies a mutator and normalizes the result", () => {
    const store = createAnchoredStore({ storage, key: "a" });
    store.pin("s1", vp);
    store.update("s1", (a) => ({ ...a, width: 300, height: 220 }), vp);
    expect(store.list()[0].width).toBe(300);
    expect(store.list()[0].height).toBe(220);
  });

  it("update clamps an out-of-bounds mutation", () => {
    const store = createAnchoredStore({ storage, key: "a" });
    store.pin("s1", vp);
    store.update("s1", (a) => ({ ...a, x: 9999, y: 9999 }), vp);
    const pin = store.list()[0];
    expect(pin.x + pin.width).toBeLessThanOrEqual(vp.width);
    expect(pin.y + pin.height).toBeLessThanOrEqual(vp.height);
  });

  it("setAnchors replaces the full set", () => {
    const store = createAnchoredStore({ storage, key: "a" });
    store.pin("s1", vp);
    store.setAnchors([makePin({ stickyId: "s2", z: 1 })], vp);
    expect(store.list()).toHaveLength(1);
    expect(store.list()[0].stickyId).toBe("s2");
  });

  it("subscribers are notified on every mutation", () => {
    const store = createAnchoredStore({ storage, key: "a" });
    let count = 0;
    const unsub = store.subscribe(() => { count++; });
    store.pin("s1", vp);
    store.pin("s2", vp);
    store.unpin("s1");
    expect(count).toBe(3);
    unsub();
    store.pin("s3", vp);
    expect(count).toBe(3);
  });

  it("survives garbage at startup and initializes empty", () => {
    storage.setItem("bad", "not-compressible-!!!data!!!");
    const store = createAnchoredStore({ storage, key: "bad" });
    expect(store.list()).toEqual([]);
  });

  it("persists compressed payload visible in raw storage", () => {
    const store = createAnchoredStore({ storage, key: "raw" });
    store.pin("s1", vp);
    store.pin("s2", vp);
    const raw = storage.getItem("raw");
    expect(typeof raw).toBe("string");
    expect(raw.length).toBeGreaterThan(2);
    const restored = decompressAnchors(raw);
    expect(restored).toHaveLength(2);
  });
});