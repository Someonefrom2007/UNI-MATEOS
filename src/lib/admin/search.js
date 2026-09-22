// UNI·MATE Control Center — ⌘K search.
//
// Admin command + resource search. Index groups map to the console sections and
// run against REAL data supplied by the caller; no results are invented. Every
// result carries a route and the permission required to see it.

/** Build the console command index (actions + resources). */
export const commandIndex = ({ routeLink, sections }) => {
  const list = [];
  sections.forEach((s) => {
    list.push({
      type: "section",
      id: s.id,
      label: s.label,
      keywords: s.keywords || [],
      href: routeLink(s.path),
      permission: s.permission,
      group: s.group || "Console",
    });
    (s.actions || []).forEach((a) => {
      list.push({
        type: "action",
        id: `${s.id}:${a.label}`,
        label: `${a.label}`,
        keywords: a.keywords || [],
        href: routeLink(s.path, a.to),
        permission: s.permission,
        group: a.group || s.label,
        quick: Boolean(a.quick),
      });
    });
  });
  return list;
};

const matchScore = (item, q) => {
  const hay = `${item.label} ${item.keywords.join(" ")}`.toLowerCase();
  if (!q) return 0;
  if (q.length > 32) return 0;
  const clean = q.toLowerCase().trim();
  if (hay.startsWith(clean)) return 3;
  if (hay.includes(clean)) return 2;
  return 0;
};

/**
 * Ranked search results from the index. Optional `filter` (e.g. a permission
 * cap) keeps restricted commands out of the palette.
 */
export const searchIndex = (items = [], q = "", { filter } = {}) => {
  if (!q || !String(q).trim()) return [];
  const clean = String(q).trim();
  return items
    .filter((item) => (filter ? filter(item) : true))
    .map((item) => ({ ...item, score: matchScore(item, clean) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 40);
};

/** Recent queries (LRU, capped) so ⌘K can suggest prior jumps. */
export const pushRecent = (recent = [], q, max = 8) =>
  [String(q).trim(), ...recent.filter((r) => r !== q)].slice(0, Math.max(0, max));

/** Split a custom query into (route, exactEntityHref) guess for direct jumps. */
export const routeGuess = (q = "", { searchPath } = {}) => {
  const clean = String(q).trim();
  if (!clean) return null;
  const hasPlus = clean.includes("+");
  return {
    term: hasPlus ? clean.split("+")[0].trim() : clean,
    exactHref: hasPlus ? `${searchPath}${encodeURIComponent(clean.split("+").slice(1).join("+"))}` : null,
  };
};