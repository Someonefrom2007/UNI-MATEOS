// Landing page narrative — single source of truth for section order, anchors,
// header navigation labels and key copy. Pure data (no React) so the story
// sequence and "no invented numbers" rule are unit-testable in node.

export const ILLUSTRATIVE_LABEL = "Illustrative preview";

// Beats of the 2.0 landing story, in order. `nav` marks sections linked from
// the sticky header.
export const LANDING_SECTIONS = [
  { id: "hero", label: "Hero" },
  { id: "problem", label: "Problem" },
  { id: "manifesto", label: "UNI·MATE" },
  { id: "product", label: "Product", nav: "Product" },
  { id: "intelligence", label: "Intelligence", nav: "Academic intelligence" },
  { id: "planning", label: "Planning", nav: "Study planning" },
  { id: "focus", label: "Focus", nav: "Focus" },
  { id: "community", label: "Community", nav: "Community" },
  { id: "privacy", label: "Privacy", nav: "Privacy" },
  { id: "future", label: "Future" },
  { id: "cta", label: "CTA" },
];

export const navSections = () => LANDING_SECTIONS.filter((s) => s.nav);

export const HERO = {
  kicker: "The personal academic operating system",
  headline: "UNI·MATE",
  tagline: "Your university, organized around you.",
  sub:
    "Schedule, courses, tasks, exams, grades, notes and focus — one connected command center for everything your university life throws at you.",
  ctaPrimary: "Start free",
  ctaSecondary: "I already have an account",
};

export const PROBLEM = {
  kicker: "Today",
  headline: "University life arrives from everywhere at once.",
  points: [
    "A different app per course",
    "Deadlines scattered across email and chat",
    "Grades that never add up to a clear picture",
    "Exam week arriving like it was kept secret",
  ],
};

export const MANIFESTO = {
  kicker: "UNI·MATE",
  headline: "A single place that thinks in semesters, not tabs.",
  body:
    "One course is one object with everything attached — its schedule, tasks, exams, grades and notes. The university lives as a connected whole, the way it does in your head.",
};

export const PRODUCT = {
  kicker: "Product",
  headline: "Your university, visualized.",
  body:
    "Courses, schedule, tasks, exams, grades, notes, resources, focus and community — every surface reads from the same semester, so nothing asks you twice.",
  marks: [
    ["Dashboard", "What matters now, answered every time you open it"],
    ["Schedule", "Day, week and month views with live conflict warnings"],
    ["Courses", "Real CRUD — professor, code, credits, topics, progress"],
    ["Smart views", "Tasks, exams, notes and resources bound to their course"],
  ],
};

export const INTELLIGENCE = {
  kicker: "Academic intelligence",
  headline: "Grades that actually tell you where you stand.",
  body:
    "The 0–10 ECTS system, weighted by credits, with honest per-course forecasts — not a generic percentage slapped on top of your life.",
  bands: [
    ["< 5.0", "Fail"],
    ["5.0 – 6.9", "Pass"],
    ["7.0 – 8.9", "Notable"],
    ["9.0 – 9.9", "Outstanding"],
    ["10.0", "Matrícula de Honor"],
  ],
};

export const PLANNING = {
  kicker: "Study planning",
  headline: "Know what has to happen before it becomes a crisis.",
  body:
    "Tasks carry real deadlines, durations and priorities. Workload is built from what you actually scheduled — never a made-up score.",
};

export const FOCUS = {
  kicker: "Focus",
  headline: "A quieter place to actually work.",
  body:
    "Immersive pomodoro sessions tied to the course in front of you. The interface steps back, the timer breathes, and the rest of the semester waits.",
};

export const COMMUNITY = {
  kicker: "Community",
  headline: "Students helping students.",
  body:
    "Questions, shared resources and study groups between people at the same university — identities by initials and geometry, never photos.",
};

export const PRIVACY = {
  kicker: "Privacy",
  headline: "Your university belongs to you.",
  points: [
    "Runs fully locally — your data survives refresh and restart",
    "No profile pictures, no public academics, nothing auto-shared",
    "Your personal academic data is never exposed by default",
  ],
};

export const FUTURE = {
  kicker: "Future",
  headline: "Built to grow with your semester.",
  body:
    "A data layer designed for sync and ownership from day one — when accounts arrive, your local work moves with you.",
};

export const CTA = {
  headline: "Your semester, in one place.",
  sub: "Set up your courses once. The schedule, tasks, exams and grades build themselves around them.",
};