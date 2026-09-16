// Anchor engine for floating stickies — pure geometry + compressed persistence.
// Reuses the existing sticky-wall cards for content; this module only owns the
// overlay layout (position/size/minimize/z) and round-trips it through
// src/lib/dataCompressor for zero storage bloat.

import { compressPayload, decompressPayload } from "@/lib/dataCompressor";
import { createLocalStorageAdapter } from "@/lib/repo/storage";

export const ANCHOR_DEFAULTS = Object.freeze({ width: 240, height: 148 });
export const MINIMIZED_SIZE = Object.freeze({ width: 180, height: 46 });
export const PIN_LIMITS = Object.freeze({
  min: { width: 168, height: 104 },
  max: { width: 520, height: 440 },
});

// Fallback viewport for non-browser contexts (tests, SSR-safe defaults).
/** @type {{ width: number, height: number }} */
export const VIEWPORT = Object.freeze({ width: 1280, height: 800 });

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, Math.round(n)));

const pickWindow = (viewport = VIEWPORT) => ({
  width: viewport.width || VIEWPORT.width,
  height: viewport.height || VIEWPORT.height,
});

// Keep a pin fully inside the viewport and within the size limits.
export const clampPin = (anchor, viewport = VIEWPORT) => {
  const vp = pickWindow(viewport);
  const isMin = anchor.minimized;
  const width = isMin
    ? Number(anchor.width) || MINIMIZED_SIZE.width
    : clamp(Number(anchor.width) || ANCHOR_DEFAULTS.width, PIN_LIMITS.min.width, PIN_LIMITS.max.width);
  const height = isMin
    ? Number(anchor.height) || MINIMIZED_SIZE.height
    : clamp(Number(anchor.height) || ANCHOR_DEFAULTS.height, PIN_LIMITS.min.height, PIN_LIMITS.max.height);
  const x = clamp(Number(anchor.x) || 8, 8, Math.max(8, vp.width - width - 8));
  const y = clamp(Number(anchor.y) || 8, 8, Math.max(8, vp.height - height - 8));
  return { ...anchor, x, y, width, height };
};

// New overlay for a sticky, parked top-right just below the app header.
export const createAnchor = ({ stickyId, z = 1, width = ANCHOR_DEFAULTS.width, height = ANCHOR_DEFAULTS.height, viewport = VIEWPORT }) => {
  const vp = pickWindow(viewport);
  return clampPin(
    {
      stickyId,
      x: Math.max(8, vp.width - width - 24),
      y: 88,
      width,
      height,
      minimized: false,
      z,
    },
    vp
  );
};

// Collapse to a compact corner chip in the bottom-right, remembering the open
// size so unminimizing restores exactly what the user had set.
export const minimizeToCorner = (anchor, viewport = VIEWPORT) => {
  const vp = pickWindow(viewport);
  const wasMinimized = anchor.minimized;
  return clampPin(
    {
      ...anchor,
      minimized: true,
      openWidth: wasMinimized ? anchor.openWidth : anchor.width,
      openHeight: wasMinimized ? anchor.openHeight : anchor.height,
      width: MINIMIZED_SIZE.width,
      height: MINIMIZED_SIZE.height,
      x: Math.max(8, vp.width - MINIMIZED_SIZE.width - 24),
      y: Math.max(8, vp.height - MINIMIZED_SIZE.height - 88),
    },
    vp
  );
};

export const restorePin = (anchor, viewport = VIEWPORT) =>
  clampPin(
    {
      ...anchor,
      minimized: false,
      width: anchor.openWidth || ANCHOR_DEFAULTS.width,
      height: anchor.openHeight || ANCHOR_DEFAULTS.height,
      openWidth: undefined,
      openHeight: undefined,
    },
    viewport
  );

export const toggleMinimize = (anchor, viewport = VIEWPORT) =>
  anchor.minimized ? restorePin(anchor, viewport) : minimizeToCorner(anchor, viewport);

export const moveAnchor = (anchor, { x, y }, viewport = VIEWPORT) => clampPin({ ...anchor, x: x ?? anchor.x, y: y ?? anchor.y }, viewport);

export const resizeAnchor = (anchor, { width, height }, viewport = VIEWPORT) => clampPin({ ...anchor, width: width ?? anchor.width, height: height ?? anchor.height }, viewport);

export const nextZ = (anchors = []) => anchors.reduce((m, a) => Math.max(m, Number(a.z) || 0), 0) + 1;

export const bringToFront = (anchors = [], stickyId) => {
  const pin = anchors.find((a) => a.stickyId === stickyId);
  if (!pin) return anchors;
  return upsertAnchor(anchors, { ...pin, z: nextZ(anchors) });
};

export const upsertAnchor = (anchors, anchor) => [...anchors.filter((a) => a.stickyId !== anchor.stickyId), anchor];

export const removeAnchor = (anchors, stickyId) => anchors.filter((a) => a.stickyId !== stickyId);

export const normalizeAnchors = (raw, viewport = VIEWPORT) =>
  Array.isArray(raw)
    ? raw
        .map((a) => (a && a.stickyId ? clampPin({ minimized: false, width: ANCHOR_DEFAULTS.width, height: ANCHOR_DEFAULTS.height, z: 1, ...a }, viewport) : null))
        .filter(Boolean)
    : [];

// Compressed persistence — explicit dataCompressor round-trip.
export const compressAnchors = (anchors = []) => compressPayload(normalizeAnchors(anchors));
export const decompressAnchors = (raw) => {
  if (!raw) return [];
  try {
    return normalizeAnchors(decompressPayload(raw));
  } catch {
    return [];
  }
};

const emitFor = (listeners) => listeners.forEach((fn) => fn());

// Key-value store for anchors, with reactive subscribers and explicit
// compressed persistence. Accepts an injectable storage adapter so tests can
// prove the compressed round-trip without a browser.
export const createAnchoredStore = ({ storage, key = "anchors" }) => {
  const listeners = new Set();
  let cache = [];
  try {
    cache = decompressAnchors(storage.getItem(key));
  } catch {
    cache = [];
  }

  const persist = (next, viewport = VIEWPORT) => {
    cache = normalizeAnchors(next, viewport);
    storage.setItem(key, compressAnchors(cache));
    emitFor(listeners);
    return cache;
  };

  return {
    subscribe: (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    getSnapshot: () => cache,
    list: () => cache,
    pin: (stickyId, viewport = VIEWPORT) => {
      if (cache.some((a) => a.stickyId === stickyId)) return cache;
      return persist([...cache, createAnchor({ stickyId, viewport, z: nextZ(cache) })], viewport);
    },
    unpin: (stickyId, viewport = VIEWPORT) => persist(removeAnchor(cache, stickyId), viewport),
    update: (stickyId, mutator, viewport = VIEWPORT) => {
      const pin = cache.find((a) => a.stickyId === stickyId);
      if (!pin) return cache;
      return persist(upsertAnchor(cache, mutator(pin, viewport)), viewport);
    },
    setAnchors: (anchors, viewport = VIEWPORT) => persist(normalizeAnchors(anchors, viewport), viewport),
  };
};

let baseStorage = null;
export const getAnchoredBaseStorage = () => {
  if (!baseStorage) baseStorage = createLocalStorageAdapter("unimate:anchors");
  return baseStorage;
};

export const anchoredStore = createAnchoredStore({ storage: getAnchoredBaseStorage(), key: "anchors" });

// Current browser viewport with a deterministic fallback (used by the layer).
export const currentViewport = (w = typeof window === "undefined" ? null : window) =>
  w && Number.isFinite(w.innerWidth) && Number.isFinite(w.innerHeight)
    ? { width: w.innerWidth, height: w.innerHeight }
    : VIEWPORT;