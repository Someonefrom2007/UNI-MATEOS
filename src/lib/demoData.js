// Demo semester — a believable starter workspace, seeded relative to today.

import { supabase } from "@/lib/supabase";

const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const inDays = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return iso(d);
};

// Insert helper: every write is awaited, surfaced, and thrown on failure so a
// partial seed can never look "successful". No silent catch-and-continue.
const insert = async (table, rows) => {
  const { data, error } = await supabase.from(table).insert(rows).select();
  if (error) throw new Error(`Seeding "${table}" failed: ${error.message}`);
  return data || [];
};

export const loadDemoData = async () => {
  const courses = await insert("courses", [
    { name: "Linear Algebra", code: "MATH201", professor: "Dr. Ferrer", ects: 6, semester: "1", target_grade: 7, color: "amber", archived: false },
    { name: "Programming Fundamentals", code: "CS101", professor: "Prof. Núñez", ects: 6, semester: "1", target_grade: 8, color: "cyan", archived: false },
    { name: "Introduction to Psychology", code: "PSY101", professor: "Dr. Vidal", ects: 6, semester: "1", target_grade: 7, color: "purple", archived: false },
    { name: "Academic Writing", code: "HUM105", professor: "Prof. Okafor", ects: 4, semester: "1", target_grade: 7.5, color: "green", archived: false },
  ]);
  if (!courses?.length) throw new Error('Seeding "courses" returned no rows');
  const [math, cs, psych, writing] = courses;

  await insert("schedule_events", [
    { title: "Linear Algebra — Lecture", type: "class", course_id: math.id, day_of_week: 1, start_time: "10:00", end_time: "11:30", room: "A-101", recurring: true },
    { title: "Linear Algebra — Practice", type: "class", course_id: math.id, day_of_week: 3, start_time: "10:00", end_time: "11:30", room: "A-101", recurring: true },
    { title: "Programming — Lab", type: "class", course_id: cs.id, day_of_week: 2, start_time: "12:00", end_time: "13:30", room: "Lab B-2", recurring: true },
    { title: "Programming — Lecture", type: "class", course_id: cs.id, day_of_week: 4, start_time: "12:00", end_time: "13:30", room: "C-201", recurring: true },
    { title: "Psychology — Seminar", type: "class", course_id: psych.id, day_of_week: 1, start_time: "15:00", end_time: "17:00", room: "S-12", recurring: true },
    { title: "Academic Writing — Workshop", type: "class", course_id: writing.id, day_of_week: 5, start_time: "09:00", end_time: "10:30", room: "D-301", recurring: true },
  ]);

  await insert("tasks", [
    { title: "Problem set 4 — vector spaces", course_id: math.id, due_date: inDays(2), priority: "high", status: "todo", estimated_duration: 120 },
    { title: "Read chapter 6 — memory & cognition", course_id: psych.id, due_date: inDays(3), priority: "medium", status: "todo", estimated_duration: 60 },
    { title: "Refactor calculator exercise", course_id: cs.id, due_date: inDays(-1), priority: "urgent", status: "todo", estimated_duration: 90 },
    { title: "Essay draft — argument structure", course_id: writing.id, due_date: inDays(6), priority: "high", status: "in_progress", estimated_duration: 150 },
    { title: "Set up Git for the group project", course_id: cs.id, due_date: inDays(-3), priority: "medium", status: "completed", completed_date: inDays(-3), estimated_duration: 30, actual_duration: 45 },
  ]);

  await insert("exams", [
    { name: "Quiz 1 — research methods", course_id: psych.id, type: "quiz", date: inDays(5), time: "12:00", weight: 15, status: "upcoming", location: "S-12" },
    { name: "Midterm — vector spaces", course_id: math.id, type: "midterm", date: inDays(11), time: "10:00", weight: 30, status: "upcoming", location: "A-101", topics: [
      { name: "Eigenvalues", mastery: 40, reviewed: false },
      { name: "Diagonalization", mastery: 25, reviewed: false },
      { name: "Bases & dimension", mastery: 70, reviewed: true },
    ] },
    { name: "Project demo — terminal app", course_id: cs.id, type: "project", date: inDays(17), time: "12:30", weight: 25, status: "upcoming" },
  ]);

  await insert("grades", [
    { name: "Problem set 3", course_id: math.id, grade: 6.8, weight: 10, date: inDays(-9), type: "assignment" },
    { name: "Lab 2 — loops & arrays", course_id: cs.id, grade: 8.4, weight: 15, date: inDays(-6), type: "assignment" },
    { name: "Quiz — classic studies", course_id: psych.id, grade: 7.9, weight: 20, date: inDays(-4), type: "quiz" },
    { name: "Short essay — thesis statements", course_id: writing.id, grade: 8.7, weight: 20, date: inDays(-2), type: "assignment" },
  ]);

  await insert("notes", [
    { title: "Eigenvalues — quick recipe", content: "Steps: (1) det(A − λI) = 0, (2) solve for λ, (3) nullspace per λ. Watch out for repeated roots — algebraic vs geometric multiplicity.", course_id: math.id, tags: ["exam-prep"] },
    { title: "Essay structure that worked", content: "Hook → context → claim → 3 body paragraphs (evidence + analysis) → so-what conclusion. Prof. Okafor likes counterarguments addressed early.", course_id: writing.id },
  ]);

  await insert("sticky_notes", [
    { content: "ask Ferrer about repeated eigenvalues before the midterm!!", color: "amber", rotation: -1.4 },
    { content: "psych quiz is 20% of the grade — do NOT leave it for the night before", color: "rose", rotation: 1.2, pinned: true },
    { content: "group project: pick the terminal app, it's the least painful", color: "cyan", rotation: 0.8 },
    { content: "coffee before 9am lectures is non-negotiable ☕", color: "violet", rotation: -0.6 },
    { content: "start essay drafts earlier this time. earlier. EARLIER.", color: "emerald", rotation: 1.8 },
  ]);

  const habits = await insert("habits", [
    { name: "Read 30 minutes", frequency: "daily", target_per_week: 7, icon: "BookOpen", color: "cyan", archived: false },
    { name: "Gym", frequency: "weekly", target_per_week: 3, icon: "Dumbbell", color: "rose", archived: false },
  ]);
  if (!habits?.length) throw new Error('Seeding "habits" returned no rows');
  const [reading, gym] = habits;

  await insert("habit_logs", [
    { habit_id: reading.id, date: inDays(-1), completed: true },
    { habit_id: reading.id, date: inDays(-2), completed: true },
    { habit_id: reading.id, date: inDays(-3), completed: true },
    { habit_id: gym.id, date: inDays(-2), completed: true },
  ]);

  await insert("goals", [
    { name: "Finish the semester with an 8 average", category: "academic", target: 8, current: 7.4, unit: "/10", deadline: inDays(90) },
  ]);

  await insert("focus_sessions", [
    { course_id: math.id, duration: 50, date: inDays(-1), completed: true, mode: "50_10", label: "Problem set 4" },
    { course_id: psych.id, duration: 25, date: inDays(-2), completed: true, mode: "25_5", label: "Chapter 6 reading" },
    { course_id: writing.id, duration: 25, date: inDays(-2), completed: true, mode: "25_5" },
    { course_id: cs.id, duration: 50, date: inDays(-4), completed: true, mode: "50_10", label: "Calculator refactor" },
    { course_id: math.id, duration: 25, date: inDays(-5), completed: true, mode: "25_5" },
  ]);

  return { courses: courses.length, classes: 6, tasks: 5, exams: 3, grades: 4, notes: 2, stickies: 5, habits: habits.length };
};