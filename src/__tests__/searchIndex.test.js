import { describe, it, expect } from "vitest";
import { buildSearchRows, capPerType, SEARCH_TYPES, TYPE_LABEL } from "@/lib/searchIndex";
import { filterCommandPalette } from "@/lib/paletteSearch";

const DATA = {
  Course: [
    { id: "c1", name: "Álgebra Lineal", code: "MAT101", professor: "Dr. Serra" },
    { id: "c2", name: "Cognitive Psychology", code: "PSY101", professor: "Dr. Vidal" },
  ],
  Task: [
    { id: "t1", title: "Problem set 4", due_date: "2026-09-20" },
    { id: "t2", title: "Old essay", due_date: "2026-01-01", archived: true },
  ],
  Note: [{ id: "n1", title: "Memory systems", content: "<p>Working memory holds about four chunks.</p>" }],
  Exam: [{ id: "e1", name: "Quiz 1", date: "2026-09-21", type: "quiz" }],
  Resource: [{ id: "r1", name: "Lecture slides", type: "pdf", url: "https://example.edu/slides" }],
  Grade: [{ id: "g1", name: "Assignment 1", grade: 7.5, weight: 20 }],
  Goal: [{ id: "go1", name: "Reach 8.0", category: "academic" }],
  Habit: [{ id: "h1", name: "Read 30 min", frequency: "daily" }],
  ScheduleEvent: [{ id: "s1", title: "Algorithms lecture", date: "2026-09-18", start_time: "09:00", room: "S-12" }],
  StickyNote: [{ id: "st1", content: "<p>Ask about the exam format</p>" }],
};

const search = (query, data = DATA) =>
  filterCommandPalette({ query, dataRows: buildSearchRows(data, { query }) });

describe("buildSearchRows", () => {
  it("maps every supported entity to a row", () => {
    const rows = buildSearchRows(DATA);
    SEARCH_TYPES.forEach((type) => {
      expect(rows.some((r) => r.type === type), `${type} produced no row`).toBe(true);
    });
  });

  it("labels rows with a human entity name", () => {
    const rows = buildSearchRows(DATA);
    expect(rows.find((r) => r.type === "ScheduleEvent").typeLabel).toBe("Event");
    expect(rows.find((r) => r.type === "StickyNote").typeLabel).toBe("Sticky");
  });

  it("skips archived rows so search cannot resurface them", () => {
    const rows = buildSearchRows(DATA);
    expect(rows.some((r) => r.id === "t2")).toBe(false);
  });

  it("tolerates a missing entity array", () => {
    expect(buildSearchRows({ Task: DATA.Task })).toHaveLength(1);
    expect(buildSearchRows({})).toEqual([]);
    expect(buildSearchRows()).toEqual([]);
  });

  it("strips HTML from note content in the subtitle", () => {
    const note = buildSearchRows(DATA).find((r) => r.type === "Note");
    expect(note.sub).not.toContain("<p>");
    expect(note.sub).toContain("Working memory");
  });

  it("falls back to a readable title when a row has none", () => {
    const rows = buildSearchRows({ Task: [{ id: "x" }] });
    expect(rows[0].label).toBe("Untitled task");
  });
});

describe("destinations", () => {
  it("routes entities with detail pages directly to them", () => {
    const rows = buildSearchRows(DATA);
    expect(rows.find((r) => r.id === "c1").to).toBe("/courses/c1");
    expect(rows.find((r) => r.id === "n1").to).toBe("/notes/n1");
    expect(rows.find((r) => r.id === "e1").to).toBe("/exams/e1");
  });

  it("routes list-only entities with a highlight target", () => {
    const rows = buildSearchRows(DATA);
    expect(rows.find((r) => r.id === "t1").to).toBe("/tasks?highlight=t1");
    expect(rows.find((r) => r.id === "g1").to).toBe("/grades?highlight=g1");
    expect(rows.find((r) => r.id === "h1").to).toBe("/habits?highlight=h1");
    expect(rows.find((r) => r.id === "s1").to).toBe("/schedule?highlight=s1");
  });

  it("gives every row a destination so nothing is a dead result", () => {
    buildSearchRows(DATA).forEach((r) => {
      expect(r.to, `${r.type} row had no destination`).toBeTruthy();
    });
  });
});

describe("searching across entities", () => {
  it("finds a course by code, not just name", () => {
    const hits = search("MAT101");
    expect(hits).toHaveLength(1);
    expect(hits[0].label).toBe("Álgebra Lineal");
  });

  it("ignores accents in the query", () => {
    expect(search("algebra")).toHaveLength(1);
    expect(search("Algebra")[0].label).toBe("Álgebra Lineal");
  });

  it("finds a note by its body text", () => {
    const hits = search("chunks");
    expect(hits[0].type).toBe("Note");
  });

  it("searches professors and rooms", () => {
    expect(search("Vidal")[0].id).toBe("c2");
    expect(search("S-12")[0].id).toBe("s1");
  });

  it("returns nothing for a query that matches no entity", () => {
    expect(search("zzzznothing")).toEqual([]);
  });

  it("does not index entities with no browsable destination", () => {
    // Community posts are not in the shared data cache, and focus sessions have
    // no history surface; indexing either would produce a dead result.
    expect(SEARCH_TYPES).not.toContain("CommunityPost");
    expect(SEARCH_TYPES).not.toContain("FocusSession");
  });

  it("every indexed type has a label and a destination", () => {
    SEARCH_TYPES.forEach((type) => {
      expect(TYPE_LABEL[type], `${type} has no label`).toBeTruthy();
    });
  });

  it("surfaces a grade with its value so the hit is verifiable", () => {
    const hit = search("Assignment 1")[0];
    expect(hit.sub).toContain("7.50");
  });
});

describe("capPerType", () => {
  const dataRow = (type, i) => ({ type, group: "data", id: `${type}${i}`, label: `${type} ${i}` });

  it("limits how many of one entity can appear", () => {
    const rows = Array.from({ length: 10 }, (_, i) => dataRow("Task", i));
    expect(capPerType(rows, 3)).toHaveLength(3);
  });

  it("counts each entity separately", () => {
    const rows = [
      ...Array.from({ length: 4 }, (_, i) => dataRow("Task", i)),
      ...Array.from({ length: 4 }, (_, i) => dataRow("Note", i)),
    ];
    expect(capPerType(rows, 3)).toHaveLength(6);
  });

  it("never truncates actions or navigation, however many data rows precede them", () => {
    const rows = [
      ...Array.from({ length: 12 }, (_, i) => dataRow("Task", i)),
      { label: "Go to Tasks", group: "nav" },
      { label: "Quick Add Task", group: "action" },
    ];
    const capped = capPerType(rows, 3);
    expect(capped.filter((r) => r.group === "data")).toHaveLength(3);
    expect(capped.filter((r) => r.group === "nav")).toHaveLength(1);
    expect(capped.filter((r) => r.group === "action")).toHaveLength(1);
  });

  it("keeps the highest-scoring rows rather than the first ones seen", () => {
    // Ordered as the scorer emits them: best match first. Capping the tail must
    // leave the good hits intact.
    const rows = [
      { type: "Task", group: "data", id: "best", label: "Exam prep", _score: 99 },
      { type: "Task", group: "data", id: "second", label: "Exam notes", _score: 80 },
      { type: "Task", group: "data", id: "worst", label: "Exam review", _score: 3 },
    ];
    expect(capPerType(rows, 2).map((r) => r.id)).toEqual(["best", "second"]);
  });
});

describe("palette pipeline (score then cap)", () => {
  // Mirrors CommandPalette: index the rows, rank them, then cap each entity.
  // Capping first would drop the strongest match whenever an entity is large.
  const pipeline = (query, data, limit = 6) =>
    capPerType(
      filterCommandPalette({ query, dataRows: buildSearchRows(data, { query }) }),
      limit,
    );

  const manyTasks = {
    Task: [
      ...Array.from({ length: 8 }, (_, i) => ({ id: `x${i}`, title: `Revision checklist ${i}` })),
      { id: "target", title: "Algebra problem set" },
    ],
    Course: [{ id: "c1", name: "Algebra", code: "M101" }],
  };

  it("still finds the exact match when its entity exceeds the per-type cap", () => {
    const ids = pipeline("algebra", manyTasks).map((r) => r.id);
    expect(ids).toContain("target");
    expect(ids).toContain("c1");
  });

  it("does not exceed the cap for a crowded entity", () => {
    const rows = pipeline("revision", manyTasks, 3);
    expect(rows.filter((r) => r.type === "Task")).toHaveLength(3);
  });

  it("returns an empty list for a query that matches nothing", () => {
    expect(pipeline("zzzznomatch", manyTasks)).toHaveLength(0);
  });
});
