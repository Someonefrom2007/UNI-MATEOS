// Workload Engine — estimates study work from real data, no double-counting.
// Durations in minutes.

import { daysUntil } from "./format";

// Workload for a given date range from tasks (estimated_duration) + exams (prep).
export const weekWorkload = (tasks, exams, focusSessions, courses, weekStart) => {
  const byCourse = {};
  const add = (cid, mins) => {
    const key = cid || "other";
    byCourse[key] = (byCourse[key] || 0) + mins;
  };

  // Tasks due within the week (not completed)
  tasks.forEach((t) => {
    if (t.status === "completed") return;
    if (!t.due_date) return;
    const n = daysUntil(t.due_date);
    if (n === null) return;
    // within next 7 days from weekStart
    const due = new Date(t.due_date + "T00:00:00");
    const ws = new Date(weekStart + "T00:00:00");
    const diff = (due.getTime() - ws.getTime()) / 86400000;
    if (diff >= 0 && diff < 7) {
      add(t.course_id, t.estimated_duration || 30);
    }
  });

  // Exam prep: estimate remaining prep time based on topic mastery
  exams.forEach((e) => {
    if (e.status === "completed") return;
    if (!e.date) return;
    const n = daysUntil(e.date);
    if (n === null || n < 0 || n > 14) return;
    const topics = e.topics || [];
    const reviewed = topics.filter((tp) => tp.reviewed).length;
    const total = topics.length || 1;
    const masteryPct = topics.length ? topics.reduce((s, tp) => s + (tp.mastery || 0), 0) / (total * 100) : 0;
    const remaining = Math.max(0, 1 - masteryPct);
    const prep = Math.round(remaining * 180); // up to 3h per exam remaining
    add(e.course_id, prep);
  });

  const total = Object.values(byCourse).reduce((s, v) => s + v, 0);
  const breakdown = Object.entries(byCourse)
    .map(([cid, mins]) => ({
      course_id: cid,
      course: courses.find((c) => c.id === cid),
      minutes: mins,
    }))
    .sort((a, b) => b.minutes - a.minutes);

  return { total, breakdown };
};

// Today's workload
export const todayWorkload = (tasks) => {
  const t = new Date().toISOString().slice(0, 10);
  return tasks
    .filter((task) => task.status !== "completed" && task.due_date === t)
    .reduce((s, task) => s + (task.estimated_duration || 30), 0);
};

export const focusToday = (sessions) => {
  const t = new Date().toISOString().slice(0, 10);
  return sessions.filter((s) => s.date === t).reduce((sum, s) => sum + (s.duration || 0), 0);
};

export const focusThisWeek = (sessions) => {
  const now = new Date();
  const ws = new Date(now); ws.setDate(now.getDate() - now.getDay()); ws.setHours(0, 0, 0, 0);
  const wsStr = ws.toISOString().slice(0, 10);
  return sessions.filter((s) => s.date >= wsStr).reduce((sum, s) => sum + (s.duration || 0), 0);
};

export const focusStreak = (sessions) => {
  if (!sessions.length) return 0;
  const days = new Set(sessions.map((s) => s.date));
  let streak = 0;
  const d = new Date(); d.setHours(0, 0, 0, 0);
  while (days.has(d.toISOString().slice(0, 10))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
};