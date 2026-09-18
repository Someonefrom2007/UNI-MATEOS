// Row <-> form mapping for the record types that were create-only: exams,
// grades, resources and schedule events. Kept pure and separate from the pages
// so the same conversion rules are testable and identical everywhere a record
// can be edited.

const str = (v) => (v === null || v === undefined ? "" : String(v));
// A field the caller never rendered is absent, not invalid. Only real input is
// validated; absent values fall back to the entity default on save.
const isBlank = (v) => v === "" || v === null || v === undefined;

const numOrNull = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export const EXAM_TYPES = ["exam", "quiz", "midterm", "final", "assignment", "presentation", "project", "lab", "oral", "other"];
export const EVENT_TYPES = ["class", "exam", "task", "study", "personal", "deadline"];
export const RESOURCE_TYPES = ["link", "pdf", "doc", "video", "image", "presentation", "file"];
export const GRADE_TYPES = ["exam", "quiz", "assignment", "project", "participation", "other"];

// Grades are 0–10 in this system; anything outside is a typo, not a grade.
export const GRADE_MIN = 0;
export const GRADE_MAX = 10;

export const isValidGrade = (v) => {
  const n = numOrNull(v);
  return n !== null && n >= GRADE_MIN && n <= GRADE_MAX;
};

/* ---------------------------------- exams --------------------------------- */

export const examToForm = (exam = {}) => ({
  name: str(exam.name),
  course_id: exam.course_id ?? null,
  type: exam.type || "exam",
  date: str(exam.date),
  time: str(exam.time),
  location: str(exam.location),
  weight: str(exam.weight ?? ""),
  grade: str(exam.grade ?? ""),
  notes: str(exam.notes),
  status: exam.status || "upcoming",
});

export const formToExamPatch = (form = {}) => ({
  name: String(form.name || "").trim(),
  course_id: form.course_id || null,
  type: form.type || "exam",
  // Clearable fields must become null, not "", or the DB keeps a stale value.
  date: form.date || null,
  time: form.time || null,
  location: String(form.location || "").trim() || null,
  weight: numOrNull(form.weight) ?? 0,
  grade: numOrNull(form.grade),
  notes: String(form.notes || "").trim() || null,
  status: form.status || "upcoming",
});

export const validateExamForm = (form = {}) => {
  if (!String(form.name || "").trim()) return "Give the exam a name.";
  if (!form.course_id) return "Choose the course this exam belongs to.";
  if (!isBlank(form.weight) && numOrNull(form.weight) === null) return "Weight must be a number.";
  if (numOrNull(form.weight) !== null && (numOrNull(form.weight) < 0 || numOrNull(form.weight) > 100)) return "Weight must be between 0 and 100.";
  if (!isBlank(form.grade) && !isValidGrade(form.grade)) return "Grade must be between 0 and 10.";
  return null;
};

/* --------------------------------- grades --------------------------------- */

export const gradeToForm = (grade = {}) => ({
  name: str(grade.name),
  course_id: grade.course_id ?? null,
  exam_id: grade.exam_id ?? null,
  type: grade.type || "assignment",
  grade: str(grade.grade ?? ""),
  weight: str(grade.weight ?? ""),
  date: str(grade.date),
});

export const formToGradePatch = (form = {}) => ({
  name: String(form.name || "").trim(),
  course_id: form.course_id || null,
  exam_id: form.exam_id || null,
  type: form.type || "assignment",
  grade: Number(form.grade),
  weight: numOrNull(form.weight) ?? 0,
  date: form.date || null,
});

export const validateGradeForm = (form = {}) => {
  if (!String(form.name || "").trim()) return "Give the assessment a name.";
  if (!form.course_id) return "Choose the course this grade counts towards.";
  if (form.grade === "" || form.grade === null || form.grade === undefined) return "Enter a grade between 0 and 10.";
  if (!isValidGrade(form.grade)) return "Grade must be between 0 and 10.";
  if (!isBlank(form.weight) && numOrNull(form.weight) === null) return "Weight must be a number.";
  if (numOrNull(form.weight) !== null && (numOrNull(form.weight) < 0 || numOrNull(form.weight) > 100)) return "Weight must be between 0 and 100.";
  return null;
};

/* -------------------------------- resources ------------------------------- */

// Accept only web-like URLs; reject javascript:/data: so a resource link can
// never become an injection vector when opened.
export const isSafeUrl = (url) => {
  const s = String(url || "").trim();
  if (!s) return true;
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
};

export const resourceToForm = (resource = {}) => ({
  name: str(resource.name),
  type: resource.type || "link",
  course_id: resource.course_id ?? null,
  url: str(resource.url),
  description: str(resource.description),
});

export const formToResourcePatch = (form = {}) => ({
  name: String(form.name || "").trim(),
  type: form.type || "link",
  course_id: form.course_id || null,
  url: String(form.url || "").trim() || null,
  description: String(form.description || "").trim() || null,
});

export const validateResourceForm = (form = {}) => {
  if (!String(form.name || "").trim()) return "Give the resource a name.";
  if (!isSafeUrl(form.url)) return "Enter a link starting with http:// or https://.";
  return null;
};

/* ------------------------------ schedule events --------------------------- */

export const eventToForm = (event = {}) => ({
  title: str(event.title),
  type: event.type || "personal",
  course_id: event.course_id ?? null,
  date: str(event.date),
  day_of_week: event.day_of_week ?? "",
  start_time: str(event.start_time),
  end_time: str(event.end_time),
  room: str(event.room),
  recurring: Boolean(event.recurring),
});

export const formToEventPatch = (form = {}) => ({
  title: String(form.title || "").trim(),
  type: form.type || "personal",
  course_id: form.course_id || null,
  date: form.date || null,
  day_of_week: numOrNull(form.day_of_week),
  start_time: form.start_time || null,
  end_time: form.end_time || null,
  room: String(form.room || "").trim() || null,
  recurring: Boolean(form.recurring),
});

export const validateEventForm = (form = {}) => {
  if (!String(form.title || "").trim()) return "Give the event a title.";
  // Recurring classes need a weekday; one-off events need a date.
  if (form.recurring) {
    if (form.day_of_week === "" || form.day_of_week === null || form.day_of_week === undefined) return "Choose the weekday this repeats on.";
  } else if (!form.date) {
    return "Choose a date for this event.";
  }
  if (form.start_time && form.end_time && form.end_time <= form.start_time) return "The end time must be after the start time.";
  return null;
};

export const WEEKDAYS = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

/* ------------------------------ delete planning ---------------------------- */

// Deleting a grade asks whether the linked exam's stored mark should go too —
// otherwise the course average would silently keep counting a deleted score
// through the exam, which reads as a bug rather than a decision.
export const orphanedExamIds = (grade) =>
  grade && grade.exam_id ? [grade.exam_id] : [];