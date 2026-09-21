import { describe, it, expect } from "vitest";
import { topicStats } from "@/lib/topicStats";

describe("topicStats", () => {
  it("is zeroed for an empty list", () => {
    expect(topicStats([])).toEqual({ count: 0, mastery: 0, reviewed: 0, coverage: 0 });
    expect(topicStats(null)).toEqual({ count: 0, mastery: 0, reviewed: 0, coverage: 0 });
  });

  it("rounds average mastery and derives coverage from reviewed", () => {
    const stats = topicStats([
      { name: "Eigenvalues", mastery: 40, reviewed: false },
      { name: "Bases & dimension", mastery: 71, reviewed: true },
      { name: "Diagonalization", mastery: 100, reviewed: true },
    ]);
    expect(stats).toEqual({ count: 3, mastery: 70, reviewed: 2, coverage: 67 });
  });

  it("defends against missing keys and non-numeric mastery", () => {
    const stats = topicStats([{ name: "x" }, { name: "y", mastery: "80" }, { name: "z", reviewed: true }]);
    expect(stats).toEqual({ count: 3, mastery: 27, reviewed: 1, coverage: 33 });
  });
});