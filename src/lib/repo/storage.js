// Injectable key-value storage for the local data layer.
//
// The browser build reads/writes window.localStorage under a "unimate:v1"
// prefix. Non-browser environments (vitest runs in Node without jsdom) and
// browsers where localStorage is unavailable fall back to an in-memory Map so
// the repository contract stays testable without a DOM.
export const STORAGE_PREFIX = "unimate:v1";

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

// Environment-aware default: real localStorage when the page provides it,
// otherwise a memory store (node tests, storage-blocked contexts). Memoized so
// every consumer in a runtime shares one backend — otherwise separately-created
// repos would each get an isolated memory store when localStorage is blocked.
let defaultStorage = null;

export const getDefaultStorage = () => {
  if (!defaultStorage) defaultStorage = createLocalStorageAdapter();
  return defaultStorage;
};