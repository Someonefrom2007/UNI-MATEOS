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