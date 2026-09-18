// Search index — turns every user-owned row into a navigable palette result.
//
// Kept separate from the palette component so the mapping from entity to label,
// subtitle and destination is testable without a DOM. Every entry points at a
// real destination: entity routes where they exist, and a `?highlight=` target
// where the page is a single list.
//
// Nothing here invents data. An entity with no rows simply contributes no
// results.

import { norm } from "./paletteSearch";
import { notePreview } from "./format";

// Which fields are worth searching for each entity, in priority order. The
// first match decides the subtitle so the result explains itself.
const SEARCHABLE = {
  Course: (c) => [c.name, c.code, c.professor],
  Task: (t) => [t.title, t.description],
  Exam: (e) => [e.name, e.location, e.type],
  Note: (n) => [n.title, notePreview(n.content)],
  Resource: (r) => [r.name, r.url, r.type],
  ScheduleEvent: (e) => [e.title, e.room],
  Grade: (g) => [g.name],
  Goal: (g) => [g.name, g.category],
  Habit: (h) => [h.name],
  StickyNote: (s) => [s.content],
  // CommunityPost is intentionally absent: posts are not part of the shared
  // useUserData cache, so indexing them here would yield results that navigate
  // to a feed which cannot resolve them. Community gets its own search when it
  // has a dedicated source.
};

export const SEARCH_TYPES = Object.keys(SEARCHABLE);

// Human label + destination for a row. `route` handles entities with detail
// pages; `list` covers the rest and appends a highlight target.
const DESTINATION = {
  Course: (c) => ({ to: `/courses/${c.id}` }),
  Note: (n) => ({ to: `/notes/${n.id}` }),
  Exam: (e) => ({ to: `/exams/${e.id}` }),
  Task: (t) => ({ to: `/tasks?highlight=${t.id}` }),
  Resource: (r) => ({ to: `/resources?highlight=${r.id}` }),
  ScheduleEvent: (e) => ({ to: `/schedule?highlight=${e.id}` }),
  Grade: (g) => ({ to: `/grades?highlight=${g.id}` }),
  Goal: (g) => ({ to: `/goals?highlight=${g.id}` }),
  Habit: (h) => ({ to: `/habits?highlight=${h.id}` }),
  StickyNote: (s) => ({ to: `/stickies?highlight=${s.id}` }),
};

export const TYPE_LABEL = {
  Course: "Course",
  Task: "Task",
  Exam: "Exam",
  Note: "Note",
  Resource: "Resource",
  ScheduleEvent: "Event",
  Grade: "Grade",
  Goal: "Goal",
  Habit: "Habit",
  StickyNote: "Sticky",
};

const titleOf = (type, row) => {
  switch (type) {
    case "Course": return row.name || row.code || "Untitled course";
    case "Task": return row.title || "Untitled task";
    case "Exam": return row.name || "Untitled exam";
    case "Note": return row.title || "Untitled note";
    case "Resource": return row.name || "Untitled resource";
    case "ScheduleEvent": return row.title || "Untitled event";
    case "Grade": return row.name || "Untitled assessment";
    case "Goal": return row.name || "Untitled goal";
    case "Habit": return row.name || "Untitled habit";
    case "StickyNote": return notePreview(row.content).slice(0, 60) || "Sticky note";
    default: return "Untitled";
  }
};

const subtitleOf = (type, row) => {
  switch (type) {
    case "Course": return [row.code, row.professor].filter(Boolean).join(" · ");
    case "Task": return row.due_date ? `Due ${row.due_date}` : "No due date";
    case "Exam": return [row.date, row.type].filter(Boolean).join(" · ");
    case "Note": return notePreview(row.content).slice(0, 70);
    case "Resource": return row.type || row.url || "";
    case "ScheduleEvent": return [row.date, row.start_time, row.room].filter(Boolean).join(" · ");
    case "Grade": return row.grade !== null && row.grade !== undefined ? `${Number(row.grade).toFixed(2)} · ${row.weight || 0}%` : "";
    case "Goal": return row.category || "";
    case "Habit": return row.frequency || "";
    case "StickyNote": return notePreview(row.content).slice(0, 70);
    default: return "";
  }
};

// Which text matched, so the subtitle can show the reason for the hit rather
// than a field the user did not search for.
const matchSubtitle = (type, row, query) => {
  if (!query) return subtitleOf(type, row);
  const fields = (SEARCHABLE[type] || (() => []))(row);
  const hit = fields.find((f) => f && norm(f).includes(query));
  if (hit && hit !== titleOf(type, row)) {
    return type === "Note" || type === "StickyNote"
      ? notePreview(hit).slice(0, 70)
      : hit;
  }
  return subtitleOf(type, row);
};

/**
 * Flatten entity arrays into palette rows. Scoring and filtering stay in
 * filterCommandPalette so search behaves identically for data and commands;
 * this only decides what each row says.
 * @param {Record<string, Array<object>>} data rows keyed by entity name
 * @param {{ query?: string }} [opts]
 */
export const buildSearchRows = (data = {}, { query = "" } = {}) => {
  const nq = norm(query).trim();
  const rows = [];

  SEARCH_TYPES.forEach((type) => {
    const list = data[type];
    if (!Array.isArray(list)) return;

    list.forEach((row) => {
      // Archived rows stay out of search: surfacing something the student put
      // away as a top hit is worse than not finding it.
      if (row.archived) return;
      rows.push({
        type,
        typeLabel: TYPE_LABEL[type],
        id: row.id,
        label: titleOf(type, row),
        sub: matchSubtitle(type, row, nq),
        ...DESTINATION[type](row),
      });
    });
  });

  return rows;
};

/**
 * Cap how many of one entity type can appear, so a search for "exam" cannot
 * bury the course you were actually after.
 *
 * MUST run on scored, ordered rows (the output of filterCommandPalette) rather
 * than on the raw index: capping before ranking drops the best match whenever
 * an entity holds more rows than the limit. Non-entity rows (actions, nav) are
 * left untouched so navigation never gets truncated.
 */
export const capPerType = (rows = [], limit = 6) => {
  const counts = {};
  return rows.filter((r) => {
    if (r.group !== "data") return true;
    const key = r.type || "other";
    counts[key] = (counts[key] || 0) + 1;
    return counts[key] <= limit;
  });
};
