// Schedule Engine — handles classes, events, conflicts, free time.

export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// All schedule items for a specific date: recurring classes (by day_of_week) + dated events.
export const eventsForDate = (events, dateStr) => {
  const d = new Date(dateStr + "T00:00:00");
  const dow = d.getDay();
  return [
    ...events.filter((e) => e.date === dateStr),
    ...events.filter((e) => !e.date && e.day_of_week === dow && e.recurring !== false),
  ].sort((a, b) => (a.start_time || "").localeCompare(b.start_time || ""));
};

// Today's timeline: classes + tasks due today + focus sessions + exams today
export const todayTimeline = (events, tasks, exams, dateStr) => {
  const items = [];
  eventsForDate(events, dateStr).forEach((e) => {
    items.push({
      id: `evt-${e.id}`,
      type: e.type,
      title: e.title,
      start: e.start_time,
      end: e.end_time,
      room: e.room,
      course_id: e.course_id,
    });
  });
  tasks
    .filter((t) => t.status !== "completed" && t.due_date === dateStr)
    .forEach((t) => {
      items.push({ id: `task-${t.id}`, type: "task", title: t.title, start: t.due_time || "23:59", course_id: t.course_id });
    });
  exams
    .filter((e) => e.date === dateStr)
    .forEach((e) => {
      items.push({ id: `exam-${e.id}`, type: "exam", title: e.name, start: e.time || "09:00", course_id: e.course_id });
    });
  return items.sort((a, b) => (a.start || "").localeCompare(b.start || ""));
};

// Next upcoming class from now.
export const nextClass = (events, from = new Date()) => {
  const now = from;
  const todayStr = now.toISOString().slice(0, 10);
  const todays = eventsForDate(events, todayStr).filter((e) => e.type === "class" && e.start_time && now < new Date(`${todayStr}T${e.start_time}`));
  if (todays.length) {
    const e = todays[0];
    return { ...e, when: "today", dateStr: todayStr };
  }
  for (let i = 1; i <= 7; i++) {
    const d = new Date(now); d.setDate(now.getDate() + i);
    const ds = d.toISOString().slice(0, 10);
    const list = eventsForDate(events, ds).filter((e) => e.type === "class").sort((a, b) => a.start_time.localeCompare(b.start_time));
    if (list.length) return { ...list[0], when: i === 1 ? "tomorrow" : `in ${i}d`, dateStr: ds };
  }
  return null;
};

// Detect overlapping events on a date.
export const detectConflicts = (events, dateStr) => {
  const list = eventsForDate(events, dateStr);
  const conflicts = [];
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j];
      if (!a.start_time || !b.start_time) continue;
      const aS = a.start_time, aE = a.end_time || a.start_time;
      const bS = b.start_time, bE = b.end_time || b.start_time;
      if (aS < bE && bS < aE) {
        conflicts.push({ a, b, dateStr });
      }
    }
  }
  return conflicts;
};

// Free blocks between scheduled items on a date.
export const freeBlocks = (events, dateStr) => {
  const list = eventsForDate(events, dateStr).filter((e) => e.start_time && e.end_time).sort((a, b) => a.start_time.localeCompare(b.start_time));
  const blocks = [];
  let cursor = "08:00";
  list.forEach((e) => {
    if (e.start_time > cursor) blocks.push({ start: cursor, end: e.start_time });
    cursor = e.end_time > cursor ? e.end_time : cursor;
  });
  if (cursor < "20:00") blocks.push({ start: cursor, end: "20:00" });
  return blocks.filter((b) => durationMin(b.start, b.end) >= 30);
};

export const durationMin = (start, end) => {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return eh * 60 + em - (sh * 60 + sm);
};

export const minutesUntil = (timeStr, from = new Date()) => {
  const todayStr = from.toISOString().slice(0, 10);
  const t = new Date(`${todayStr}T${timeStr}`);
  return Math.round((t.getTime() - from.getTime()) / 60000);
};