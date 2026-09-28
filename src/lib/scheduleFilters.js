// Schedule/calendar view filters — pure, so the UI stays a thin shell and the
// rules are unit-testable without React or a repo.
//
// Semantics: an empty facet list means "no constraint" (show everything), which
// is the least surprising behaviour for a toggle group — a new filter never
// silently hides the user's whole timetable.
//
// Facets map onto the real schema rather than invented fields:
//   course  -> courses.code (falls back to the course name when no code is set)
//   type    -> schedule_events.type IN (class|exam|task|study|personal|deadline)
//   status  -> tasks.status IN (todo|in_progress|completed)

// Mirrors the CHECK constraint on public.schedule_events.type.
export const EVENT_TYPES = Object.freeze(["class", "exam", "task", "study", "personal", "deadline"]);

// Mirrors the CHECK constraint on public.tasks.status.
export const TASK_STATUSES = Object.freeze(["todo", "in_progress", "completed"]);

export const courseCode = (course) =>
  String(course?.code || course?.name || "").trim();

// Sortable option list for the course filter. Courses with neither code nor name
// are dropped, and ids are de-duplicated so a repeated course cannot double up.
export const courseFilterOptions = (courses = []) => {
  const seen = new Set();
  const out = [];
  for (const c of courses || []) {
    const code = courseCode(c);
    if (!code || seen.has(c?.id)) continue;
    seen.add(c.id);
    out.push({ id: c.id, code });
  }
  return out.sort((a, b) => a.code.localeCompare(b.code));
};

export const emptyFilters = () => ({ courseIds: [], types: [], statuses: [] });

// Toggle one value inside a facet, leaving the others untouched.
export const toggleValue = (list = [], value) =>
  (list || []).includes(value) ? list.filter((v) => v !== value) : [...(list || []), value];

// A filter is "active" (and worth showing a clear affordance for) only when at
// least one facet is non-empty.
export const hasActiveFilters = (filters) =>
  Boolean(
    (filters?.courseIds?.length) || (filters?.types?.length) || (filters?.statuses?.length),
  );

// Events respect the course + type facets. Events carry no completion column, so
// a null course_id is kept whenever the course facet is active — otherwise a
// personal event would vanish just because the user selected one course.
export const filterEvents = (events = [], filters = {}) => {
  const courseIds = filters.courseIds || [];
  const types = filters.types || [];
  return (events || []).filter((e) => {
    if (courseIds.length && !e?.course_id) return false;
    if (courseIds.length && !courseIds.includes(e.course_id)) return false;
    if (types.length && !types.includes(e.type)) return false;
    return true;
  });
};

// Tasks respect the course + completion facets. status lives only on tasks, so
// the type facet deliberately does not apply here.
export const filterTasks = (tasks = [], filters = {}) => {
  const courseIds = filters.courseIds || [];
  const statuses = filters.statuses || [];
  return (tasks || []).filter((t) => {
    if (courseIds.length && !t?.course_id) return false;
    if (courseIds.length && !courseIds.includes(t.course_id)) return false;
    if (statuses.length && !statuses.includes(t.status)) return false;
    return true;
  });
};

// Single entry point used by the Schedule page. Exams are unfiltered on purpose:
// an exam is a fixed assessment, and hiding one behind a "completed" toggle would
// quietly hide deadlines the student still has to sit.
export const applyScheduleFilters = ({ events = [], tasks = [], exams = [] } = {}, filters = {}) => ({
  events: filterEvents(events, filters),
  tasks: filterTasks(tasks, filters),
  exams: exams || [],
});
