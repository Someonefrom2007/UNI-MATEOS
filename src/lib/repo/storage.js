// Injectable key-value storage for the local data layer.
//
// The browser build reads/writes window.localStorage under a "unimate:v1"
// prefix. Non-browser environments (vitest runs in Node without jsdom) and
// browsers where localStorage is unavailable fall back to an in-memory Map so
// the repository contract stays testable without a DOM.
//
// Storage adapters are *transparent*: setItem receives the exact JSON string
// the caller stores, getItem returns the same original JSON string. The
// compressed adapter (the default) transparently lends itself as a wrapping
// layer over any base adapter.
import { compressString, decompressString, expandValue, minifyValue } from "@/lib/dataCompressor";

export const STORAGE_PREFIX = "unimate:v1";

// Values shorter than this are stored as plain JSON (no marker, no LZ pass) so
// tiny payloads stay tiny and remain readable by previous builds.
export const COMPRESS_MARKER = "umc1:";
export const MINIFY_THRESHOLD = 64;

export const createMemoryStorage = () => {
  const map = new Map();
  return {
    _isMemory: true,
    getItem: (key) => (map.has(String(key)) ? map.get(String(key)) : null),
    setItem: (key, value) => {
      map.set(String(key), String(value));
    },
    removeItem: (key) => {
      map.delete(String(key));
    },
    clear: () => map.clear(),
  };
};

const safeLocalStorage = () => {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    const testKey = "__unimate_storage_probe__";
    window.localStorage.setItem(testKey, "1");
    window.localStorage.removeItem(testKey);
    return window.localStorage;
  } catch {
    return null;
  }
};

// Namespaced adapter: every key is prefixed so app data never leaks into or
// collides with other data living in the same storage.
export const createLocalStorageAdapter = (prefix = STORAGE_PREFIX) => {
  const root = safeLocalStorage() || createMemoryStorage();
  const scoped = (key) => `${prefix}:${String(key)}`;

  const clear = () => {
    if (root._isMemory) {
      root.clear();
      return;
    }
    for (const k of Object.keys(root)) {
      if (String(k).startsWith(`${prefix}:`)) root.removeItem(k);
    }
  };

  return {
    getItem: (key) => root.getItem(scoped(key)),
    setItem: (key, value) => root.setItem(scoped(key), value),
    removeItem: (key) => root.removeItem(scoped(key)),
    clear,
  };
};

const tryParse = (value) => {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
};

// Compressed adapter: minifies keys, serializes, LZ-compresses and marker-
// prefixes larger payloads, and transparently expands them back on read.
// Reads always return the caller-facing original JSON string. Unmarked values
// (legacy data, non-compressing writes) pass through verbatim, so this is
// fully backward compatible with build v1.0.0 data, and a stored value is
// never larger than the value that was handed in.
export const createCompressedStorageAdapter = (
  base,
  { marker = COMPRESS_MARKER, threshold = MINIFY_THRESHOLD } = {}
) => {
  const compress = (value) => {
    const parsed = tryParse(value);
    if (parsed === undefined) return { value, stored: value };
    const stored = marker + compressString(JSON.stringify(minifyValue(parsed)));
    // Keep whatever representation is smaller so compression never backfires.
    return stored.length < value.length ? { value, stored } : { value, stored: value };
  };

  return {
    getItem: (key) => {
      const raw = base.getItem(key);
      if (raw == null || !raw.startsWith(marker)) return raw;
      try {
        const parsed = JSON.parse(decompressString(raw.slice(marker.length)));
        return JSON.stringify(expandValue(parsed));
      } catch {
        return raw;
      }
    },
    setItem: (key, value) => {
      if (value == null) {
        base.removeItem(key);
        return;
      }
      // Tiny payloads always stay plain (no parse + minify overhead).
      if (value.length < threshold || !value.trim().startsWith("{")) {
        base.setItem(key, value);
        return;
      }
      base.setItem(key, compress(value).stored);
    },
    removeItem: (key) => base.removeItem(key),
    clear: () => base.clear(),
  };
};

// Environment-aware default: real localStorage when the page provides it,
// otherwise a memory store (node tests, storage-blocked contexts). Memoized so
// every consumer in a runtime shares one backend — otherwise separately-created
// repos would each get an isolated memory store when localStorage is blocked.
let defaultStorage = null;

export const getDefaultStorage = () => {
  if (!defaultStorage) {
    defaultStorage = createCompressedStorageAdapter(createLocalStorageAdapter());
  }
  return defaultStorage;
};