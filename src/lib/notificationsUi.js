// Pure presentation helpers for the Notifications Center — no UI/DOM imports so
// they stay unit-testable in node (same pattern as the rest of src/lib).

// Compact relative label: "Today", "Tomorrow", "Yesterday", "{Mon d}" else.
export const relLabel = (dateStr) => {
  if (!dateStr) return "";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + "T00:00:00");
  d.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

// Deterministic group folding preserving the engine's date-sorted order.
export const groupByGroup = (notifs = []) => {
  const m = {};
  notifs.forEach((n) => {
    if (!m[n.group]) m[n.group] = [];
    m[n.group].push(n);
  });
  return m;
};