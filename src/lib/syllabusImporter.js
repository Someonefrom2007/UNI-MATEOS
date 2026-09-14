// Syllabus importer — pure data prep extracted from Courses.jsx handleImport.
// Separates linking logic so link resolution + non-matching course_link
// behaviour can be unit tested without a live DB.

const strip = (v) => (v === null || v === undefined ? "" : String(v).trim());

// Prepare parsed rows for bulk insert. Returns prepared row bundles plus a
// helper resolveCourseId used while iterating through courses.
export const prepareSyllabusImport = ({ courses = [], tasks = [], exams = [] } = {}) => {
  const linkMap = {};
  const stripKeys = (row, ...keys) => {
    const { ...rest } = row;
    keys.forEach((k) => delete rest[k]);
    return rest;
  };
  const courseBundles = courses.map((c) => ({ payload: stripKeys(c, "_link"), link: String(c._link || "") }));
  const taskBundles = tasks.map((t) => ({ payload: stripKeys(t, "course_link"), courseLink: String(t.course_link || "") }));
  const examBundles = exams.map((e) => ({ payload: stripKeys(e, "course_link"), courseLink: String(e.course_link || "") }));
  return { courseBundles, taskBundles, examBundles, linkMap };
};

// Resolve a course_link against the current linkMap (returns id | null).
export const resolveCourseId = (linkMap = {}, courseLink = "") => linkMap[courseLink] ?? null;

// All unique course_link values that have no matching course row, so the
// caller can surface an optional "unmapped" warning.
export const unmappedLinks = ({ courseBundles = [], taskBundles = [], examBundles = [] } = {}) => {
  const validLinks = new Set(courseBundles.map((c) => String(c.link || "").trim()).filter(Boolean));
  const unmapped = new Set();
  [...taskBundles, ...examBundles].forEach((bundle) => {
    const link = String(bundle.courseLink || "").trim();
    if (link && !validLinks.has(link)) unmapped.add(link);
  });
  return [...unmapped].sort();
};