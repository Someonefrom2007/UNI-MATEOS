// Persistent ICS feed subscriptions — stored locally so the schedule can
// re-hydrate live external events on every load (and offline, once fetched).

const FEEDS_KEY = "um-ics-feeds";

export const loadFeeds = () => {
  if (typeof localStorage === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(FEEDS_KEY) || "[]");
  } catch {
    return [];
  }
};

export const saveFeeds = (feeds) => {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(FEEDS_KEY, JSON.stringify(feeds));
};

export const addFeed = (url, name) => {
  const feeds = loadFeeds();
  if (feeds.some((f) => f.url === url)) return feeds;
  const next = [...feeds, { url, name: name || feedName(url) }];
  saveFeeds(next);
  return next;
};

export const removeFeed = (url) => {
  const next = loadFeeds().filter((f) => f.url !== url);
  saveFeeds(next);
  return next;
};

export const feedName = (url) => {
  try {
    return new URL(url).host;
  } catch {
    return url.slice(0, 40);
  }
};

// Imported events are re-created on every sync, because the sync only knows
// what the feed sends. Deleting one would therefore bring it back moments
// later. Suppressed ids are remembered here so a deleted import stays deleted,
// and only the user can bring it back.
const SUPPRESSED_KEY = "um-ics-suppressed";

export const loadSuppressed = () => {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = JSON.parse(localStorage.getItem(SUPPRESSED_KEY) || "[]");
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
};

export const isSuppressed = (googleEventId, list = loadSuppressed()) =>
  Boolean(googleEventId) && list.includes(googleEventId);

export const suppressEvent = (googleEventId) => {
  if (!googleEventId) return loadSuppressed();
  const next = Array.from(new Set([...loadSuppressed(), googleEventId]));
  if (typeof localStorage !== "undefined") localStorage.setItem(SUPPRESSED_KEY, JSON.stringify(next));
  return next;
};

export const unsuppressEvent = (googleEventId) => {
  const next = loadSuppressed().filter((id) => id !== googleEventId);
  if (typeof localStorage !== "undefined") localStorage.setItem(SUPPRESSED_KEY, JSON.stringify(next));
  return next;
};

export const clearSuppressed = () => {
  if (typeof localStorage !== "undefined") localStorage.setItem(SUPPRESSED_KEY, JSON.stringify([]));
  return [];
};