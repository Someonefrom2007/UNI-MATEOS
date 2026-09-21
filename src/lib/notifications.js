// Notification engine — deterministic, derived entirely from real user data.
// Notifications are never stored as rows; each build produces dated items from
// actual entities (exams, tasks, schedule, focus sessions, community replies).
// Read-state (per-device) lives in localStorage so the center can separate
// read/unread without fabricating anything. Storage is injectable for tests.

import { toLocalISO } from "@/lib/format";
import { weekStartOf, minutesUntilStart } from "@/lib/dashboardRadar";
import { nextClass } from "@/lib/scheduleEngine";

const READ_KEY = "unimate:notif:read";
const HOUR = 60;
const OVERDUE_LOOKBACK_DAYS = 30;

const defaultStore = () => {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
};

const parseIds = (raw) => {
  try {
    const v = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
};

// --- persisted read-state (per device, never part of the data model) ---
export const loadReadIds = (store = defaultStore()) => {
  if (!store) return [];
  return parseIds(store.getItem(READ_KEY));
};

export const saveReadIds = (ids, store = defaultStore()) => {
  if (!store) return;
  try {
    store.setItem(READ_KEY, JSON.stringify([...new Set(ids)]));
  } catch {
    // storage unavailable — read state applies for this session only
  }
};

export const markRead = (id, store = defaultStore()) => {
  const ids = loadReadIds(store);
  if (!ids.includes(id)) saveReadIds([...ids, id], store);
  return loadReadIds(store);
};

export const markAllRead = (notifs, store = defaultStore()) => {
  saveReadIds(notifs.map((n) => n.id), store);
};

export const unreadCount = (notifs, readIds) =>
  notifs.filter((n) => !readIds.includes(n.id)).length;

// Whole days from a "YYYY-MM-DD" date to nowDate (negative = past).
const daysFrom = (dateStr, now) => {
  const a = new Date(dateStr + "T00:00:00");
  a.setHours(0, 0, 0, 0);
  const b = new Date(now);
  b.setHours(0, 0, 0, 0);
  return Math.round((a.getTime() - b.getTime()) / 86400000);
};

const dayKey = (d) => toLocalISO(d);

const fmtFree = (minutes) => {
  if (minutes >= HOUR) {
    const h = Math.floor(minutes / HOUR);
    const m = minutes % HOUR;
    return m > 0 ? `${h}h ${m}m` : `${h} hours`;
  }
  return `${minutes} minutes`;
};

/**
 * Build the full, ordered notification set from real rows.
 * @param {{ exams?: Array, tasks?: Array, events?: Array, courses?: Array, focusSessions?: Array, communityReplies?: Array, nowDate?: Date }} input
 * @returns {Array<{id:string, kind:string, group:string, date:string, title:string, body:string, to:string}>}
 */
export const buildNotifications = ({
  exams = [],
  tasks = [],
  events = [],
  courses = [],
  focusSessions = [],
  communityReplies = [],
  nowDate = new Date(),
} = {}) => {
  const out = [];
  const courseName = (id) => courses.find((c) => c.id === id)?.name || "";

  // IMPORTANT — exams within the next 3 days (skips completed/graded).
  exams
    .filter((e) => e.status !== "completed" && e.date)
    .forEach((e) => {
      const n = daysFrom(e.date, nowDate);
      if (n < 0 || n > 3) return;
      const when = n === 0 ? "today" : n === 1 ? "tomorrow" : `in ${n} days`;
      out.push({
        id: `important:exam:${e.id}`,
        kind: "important",
        group: "academic",
        date: e.date,
        title: `${e.name} ${when}.`,
        body: [courseName(e.course_id), e.weight ? `${e.weight}%` : null].filter(Boolean).join(" · "),
        to: `/exams/${e.id}`,
      });
    });

  // ACTION — tasks that are overdue (up to 30 days back) or due soon.
  tasks
    .filter((t) => t.status !== "completed" && t.due_date)
    .forEach((t) => {
      const n = daysFrom(t.due_date, nowDate);
      if (n < -OVERDUE_LOOKBACK_DAYS || n > 1) return;
      const title =
        n < 0 ? `${t.title} is overdue.` : n === 0 ? `${t.title} is due today.` : `${t.title} is due tomorrow.`;
      out.push({
        id: `action:task:${t.id}`,
        kind: "action",
        group: "academic",
        date: t.due_date,
        title,
        body: courseName(t.course_id) || "Task",
        to: "/tasks",
      });
    });

  // ACTION — real free time before today's next class.
  if (events.length) {
    const nc = nextClass(events, nowDate);
    if (nc && nc.when === "today" && nc.start_time) {
      const freeMin = minutesUntilStart(nc.start_time, nowDate);
      if (freeMin !== null && freeMin >= 30) {
        out.push({
          id: `action:free:${dayKey(nowDate)}`,
          kind: "action",
          group: "academic",
          date: dayKey(nowDate),
          title: `${fmtFree(freeMin)} free before your next class.`,
          body: [nc.title, nc.start_time, nc.room].filter(Boolean).join(" · "),
          to: "/schedule",
        });
      }
    }
  }

  // ACHIEVEMENT — at least two hours of focus so far this week (once per week).
  const ws = weekStartOf(dayKey(nowDate));
  const weekMin = focusSessions
    .filter((s) => s.date && s.date >= ws)
    .reduce((sum, s) => sum + (Number(s.duration) || 0), 0);
  if (weekMin >= 2 * HOUR) {
    out.push({
      id: `achievement:focus:${ws}`,
      kind: "achievement",
      group: "milestone",
      date: dayKey(nowDate),
      title: `${Math.floor(weekMin / HOUR)} hours focused this week.`,
      body: "That's study momentum — keep it going.",
      to: "/focus",
    });
  }

  // COMMUNITY — replies to the student's own posts within the last 7 days.
  const cutoff = new Date(nowDate);
  cutoff.setDate(cutoff.getDate() - 7);
  const byPost = {};
  communityReplies.forEach((r) => {
    const t = new Date(r.created_at);
    if (isNaN(t) || t < cutoff) return;
    byPost[r.post_id] = (byPost[r.post_id] || 0) + 1;
  });
  Object.entries(byPost).forEach(([postId, count]) => {
    out.push({
      id: `community:replies:${postId}`,
      kind: "community",
      group: "community",
      date: dayKey(nowDate),
      title: count === 1 ? "Someone answered your post." : `${count} answers to your post.`,
      body: "Open the conversation in Community.",
      to: "/community",
    });
  });

  return out.sort((a, b) => b.date.localeCompare(a.date) || a.kind.localeCompare(b.kind));
};