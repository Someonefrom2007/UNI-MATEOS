// First-class topic stats — shared by the Topics page, course knowledge tab,
// and anywhere else mastery needs a number. Pure and deterministic so the
// Knowledge module's signals stay consistent across surfaces.

/**
 * Summarize a topic list for display.
 * @param {Array<{mastery?: number, reviewed?: boolean}>} [topics]
 * @returns {{ count: number, mastery: number, reviewed: number, coverage: number }}
 */
export const topicStats = (topics) => {
  const list = topics || [];
  const count = list.length;
  const total = list.reduce((s, t) => s + (Number(t.mastery) || 0), 0);
  const reviewed = list.filter((t) => t.reviewed).length;
  return {
    count,
    mastery: count ? Math.round(total / count) : 0,
    reviewed,
    coverage: count ? Math.round((reviewed / count) * 100) : 0,
  };
};