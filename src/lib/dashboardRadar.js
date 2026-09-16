// Dashboard radar — pure display-lens over the pinned computation engines.
// Layers brand-new, fully testable summaries on top of workloadEngine and
// burnout outputs without touching the pinned engines themselves. Every value
// is derived from real rows; there are no fabricated fallbacks.

import { weekWorkload } from "@/lib/workloadEngine";
import { weeklyVelocity, classifyIntensity, INTENSITY } from "@/lib/burnout";
import { toLocalISO, fmtDuration, relativeDeadline } from "@/lib/format";

const HOUR = 60;

// Monday (YYYY-MM-DD) of the week containing todayStr.
export const weekStartOf = (todayStr) => {
  const d = new Date(todayStr + "T00:00:00");
  const back = d.getDay() === 0 ? 6 : d.getDay() - 1;
  d.setDate(d.getDate() - back);
  return toLocalISO(d);
};

// Whole minutes until a "HH:MM" wall-clock start today, measured from nowDate.
export const minutesUntilStart = (startTime, nowDate = new Date()) => {
  if (!startTime) return null;
  const [h, m] = String(startTime).split(":").map((n) => parseInt(n, 10) || 0);
  const start = new Date(nowDate);
  start.setHours(h, m, 0, 0);
  return Math.round((start.getTime() - nowDate.getTime()) / 60000);
};

const fmtMinsFuture = (m) => {
  if (m <= 1) return "Class starting now";
  if (m < 60) return `Next class in ${m} mins`;
  return `Next class in ${Math.floor(m / 60)}h ${m % 60}m`;
};

// The dynamic hero banner — one honest line answering "what's happening?",
// then urgent work, then planned load, then all-clear.
export const statusBanner = ({ nc, urgent = [], workloadMinutes = 0, nowDate = new Date() }) => {
  if (nc && nc.when === "today" && nc.start_time) {
    const m = minutesUntilStart(nc.start_time, nowDate);
    if (m !== null && m >= 0) {
      return {
        variant: "upcoming",
        title: fmtMinsFuture(m),
        detail: [nc.title, nc.room ? `Room ${nc.room}` : ""].filter(Boolean).join(" · "),
        minutes: m,
      };
    }
  }
  const exams = urgent.filter((u) => u && u.kind === "exam");
  if (exams.length) {
    return {
      variant: "attention",
      title: `${exams.length} pending high-priority exam${exams.length > 1 ? "s" : ""}`,
      detail: exams[0].course?.name || exams[0].item?.name || "Get preparing now.",
    };
  }
  const task = urgent.find((u) => u && u.kind === "task");
  if (task) {
    return {
      variant: "attention",
      title: task.item?.title || "A task is due right now",
      detail: `Priority ${task.item?.priority || "high"} · ${relativeDeadline(task.item?.due_date)}`,
    };
  }
  if (workloadMinutes > 0) {
    return {
      variant: "steady",
      title: `${fmtDuration(workloadMinutes)} of study planned this week`,
      detail: "Keep the pace — block it out before it blocks you.",
    };
  }
  return { variant: "clear", title: "All clear for today", detail: "Nothing urgent. A genuinely good moment to get ahead." };
};

// Pure classification of estimate + recorded effort into the existing
// Low / Balanced / Overdrive scale (burnout engine owns the thresholds).
export const radarClassify = ({ workloadMinutes = 0, focusMinutes = 0, completionsWeek = 0 } = {}) => {
  const totalHours = (workloadMinutes + focusMinutes) / HOUR;
  const level = classifyIntensity(totalHours, completionsWeek);
  const notes = {
    low: "Easy pace — space to push.",
    balanced: "Sustainable flow — keep it there.",
    overdrive: "High output — protect recovery.",
  };
  return {
    level,
    label: INTENSITY[level]?.label || "Balanced",
    note: notes[level] || "",
    workloadMinutes,
    focusMinutes,
    totalHours: Math.round(totalHours * 10) / 10,
    completionsWeek,
  };
};

// Velocity radar assembled from the engines: estimated workload (workloadEngine)
// + recorded focus/completions (burnout), classified with burnout thresholds.
export const studyVelocity = ({ tasks = [], exams = [], focusSessions = [], courses = [], todayStr }) => {
  const weekStart = weekStartOf(todayStr || toLocalISO(new Date()));
  const wl = weekWorkload(tasks, exams, focusSessions, courses, weekStart);
  const velo = weeklyVelocity({ tasks, focusSessions, todayStr });
  return radarClassify({
    workloadMinutes: wl.total,
    focusMinutes: velo.focusMinWeek,
    completionsWeek: velo.completionsWeek,
  });
};

// Annotate today-timeline items that originated from an imported ICS feed so the
// timeline can badge external calendar events directly.
export const markIcsTimeline = (timeline = [], events = []) => {
  const byId = new Map(events.map((e) => [String(e.id), e]));
  return timeline.map((item) => {
    if (!String(item.id || "").startsWith("evt-")) return item;
    const ev = byId.get(String(item.id).slice(4));
    if (!ev) return item;
    return { ...item, ics: String(ev.google_event_id || "").startsWith("ics:") };
  });
};