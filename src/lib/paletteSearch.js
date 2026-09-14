// Command palette search core — accent-aware normalization, fuzzy scoring and
// result filtering. Pure and unit-testable, no DOM dependencies.

export const norm = (s) =>
  (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

// Subsequence fuzzy scoring: 100 - start offset for a contiguous prefix hit,
// otherwise 60 minus the summed gap cost between letters (min score 1).
export const fuzzy = (s, q) => {
  const text = norm(s);
  if (!text || !q) return 0;
  if (text.includes(q)) return 100 - text.indexOf(q);
  let si = 0;
  let cost = 0;
  for (const ch of q) {
    const found = text.indexOf(ch, si);
    if (found === -1) return 0;
    cost += found - si + 1;
    si = found + 1;
  }
  return Math.max(1, 60 - cost);
};

// Global keydown capture for toggling the palette (matches ⌘K / Ctrl+K).
export const isPaletteShortcut = (e) =>
  Boolean((e.metaKey || e.ctrlKey) && String(e.key).toLowerCase() === "k");

// Build the full ordered result list the palette renders: rapid actions,
// navigation commands, then scored data rows. groupOrder stabilizes ties.
export const filterCommandPalette = ({ query, actions = [], commands = [], dataRows = [] }) => {
  const nq = norm(query).trim();
  const out = [];
  const scored = [];
  if (nq) {
    actions.forEach((a) => {
      if (fuzzy(a.label, nq) > 0 || fuzzy(a.sub || "", nq) > 0) scored.push({ ...a, group: "action" });
    });
    commands.forEach((c) => {
      if (fuzzy(c.label, nq) > 0) scored.push({ ...c, group: "nav" });
    });
  } else {
    actions.forEach((a) => scored.push({ ...a, group: "action" }));
    commands.forEach((c) => scored.push({ ...c, group: "nav" }));
  }
  out.push(...scored);
  dataRows.forEach((r) => {
    const score = fuzzy(r.label, nq) || fuzzy(r.sub || "", nq);
    if (score > 0) out.push({ group: "data", type: r.type, label: r.label, sub: r.sub || "", to: r.to, _score: score });
  });
  if (nq) out.sort((a, b) => (b._score || 0) - (a._score || 0) || (a.group === "nav" ? -1 : 0));
  return out;
};