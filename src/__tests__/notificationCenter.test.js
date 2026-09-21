// Notification Center — pure UI-helper tests. Helpers are kept in a DOM-free
// module (src/lib/notificationsUi) so they run in node; the engine itself is
// covered by src/__tests__/notifications.test.js. No rows are fabricated here —
// inputs are real-shaped fixtures only.
import { describe, it, expect } from "vitest";
import { relLabel, groupByGroup } from "@/lib/notificationsUi";

const tz = (dateStr) => `${dateStr}T12:00:00`;
const iso = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

describe("relLabel", () => {
  it("labels today, tomorrow, and yesterday relative to the real clock", () => {
    const now = new Date();
    const today = iso(now);
    const plus = (days) => {
      const d = new Date(now);
      d.setDate(d.getDate() + days);
      return iso(d);
    };
    expect(relLabel(today)).toBe("Today");
    expect(relLabel(plus(1))).toBe("Tomorrow");
    expect(relLabel(plus(-1))).toBe("Yesterday");
  });

  it("falls back to a short date beyond a day either side", () => {
    const far = iso(new Date("2030-01-05T12:00:00"));
    expect(relLabel(far).length).toBeGreaterThan(0);
    expect(relLabel(far)).not.toBe("Today");
  });

  it("handles empty input without throwing", () => {
    expect(relLabel("")).toBe("");
    expect(relLabel(null)).toBe("");
    expect(relLabel(undefined)).toBe("");
  });
});

describe("groupByGroup", () => {
  it("folds deterministically preserving engine order within each group", () => {
    const notifs = [
      { id: "a", group: "academic", date: "2026-09-22" },
      { id: "b", group: "academic", date: "2026-09-21" },
      { id: "c", group: "milestone", date: "2026-09-22" },
      { id: "d", group: "community", date: "2026-09-23" },
    ];
    const g = groupByGroup(notifs);
    expect(Object.keys(g)).toEqual(["academic", "milestone", "community"]);
    expect(g.academic.map((n) => n.id)).toEqual(["a", "b"]);
    expect(g.milestone.map((n) => n.id)).toEqual(["c"]);
    expect(g.community.map((n) => n.id)).toEqual(["d"]);
  });

  it("yields an empty object for no notifications", () => {
    expect(groupByGroup()).toEqual({});
    expect(groupByGroup([])).toEqual({});
  });
});
