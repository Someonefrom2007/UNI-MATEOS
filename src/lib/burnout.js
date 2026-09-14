// Burnout velocity — focus hours vs task completions per rolling 7-day window.
// Gives a weekly activity rhythm and a Low / Balanced / Overdrive intensity flag.
import { toLocalISO } from "@/lib/format";

const pad = (n) => String(n).padStart(2, "0");

export const INTENSITY = {
  low: { label: "Low", color: "#22d3ee" },
  balanced: { label: "Balanced", color: "#34d399" },
  overdrive: { label: "Overdrive", color: "#fb7185" },
};

export const classifyIntensity = (focusHours = 0, completions = 0) => {
  if (focusHours >= 30 || completions >= 25 || (focusHours >= 15 && completions >= 12)) return "overdrive";
  if (focusHours < 8 && completions < 5) return "low";
  return "balanced";
};

// 0-100 combined load for gauges. 30h focus = 50pts, 25 completions = 50pts.
export const burnoutScore = (focusHours = 0, completions = 0) =>
  Math.max(0, Math.min(100, Math.round((focusHours / 30) * 50 + (completions / 25) * 50)));

// Last 7 local calendar days (oldest -> today), inclusive.
export const last7Days = (today) => {
  const anchor = today ? new Date(today + "T00:00:00") : new Date();
  anchor.setHours(0, 0, 0, 0);
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(anchor);
    d.setDate(d.getDate() - i);
    days.push(toLocalISO(d));
  }
  return days;
};

// Daily focus minutes and completed-task counts across the rolling week.
// tasks: [{ status, completed_date }]  focusSessions: [{ date, duration, completed }]
export const weeklyVelocity = ({ tasks = [], focusSessions = [], todayStr }) => {
  const days = last7Days(todayStr);
  const entries = new Map(days.map((d) => [d, { focusMin: 0, completions: 0 }]));
  const dayKeys = new Set(days);

  focusSessions.forEach((s) => {
    const d = s.date ? String(s.date).slice(0, 10) : "";
    if (!dayKeys.has(d) || s.completed === false) return;
    const e = entries.get(d);
    e.focusMin += Number(s.duration) || 0;
  });

  tasks.forEach((t) => {
    const d = t.completed_date ? String(t.completed_date).slice(0, 10) : "";
    if (!dayKeys.has(d) || t.status !== "completed") return;
    entries.get(d).completions += 1;
  });

  const focus = days.map((d) => entries.get(d).focusMin);
  const completions = days.map((d) => entries.get(d).completions);
  const focusMinWeek = focus.reduce((s, n) => s + n, 0);
  const completionsWeek = completions.reduce((s, n) => s + n, 0);
  const focusHoursWeek = focusMinWeek / 60;
  return {
    days,
    focus,
    completions,
    focusMinWeek,
    completionsWeek,
    focusHoursWeek,
    intensity: classifyIntensity(focusHoursWeek, completionsWeek),
    score: burnoutScore(focusHoursWeek, completionsWeek),
  };
};