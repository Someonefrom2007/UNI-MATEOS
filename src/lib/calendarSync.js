// Calendar sync — ICS feed parser + subscriber module.
// Accepts .ics feed URLs (Google / Apple / LMS public calendars) or uploaded
// .ics files and normalizes them into schedule_events rows that render on the
// HUD timeline. Pure functions are unit-testable with no browser APIs.

const pad = (n) => String(n).padStart(2, "0");

export const toLocalDateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const toLocalTimeStr = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

const hashStr = (s) => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
};

// Unfold RFC 5545 line folding (CRLF + single space continuation).
const unfoldLines = (text) =>
  text
    .replace(/\r\n[ \t]/g, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

// Strip parameters from a property line ("DTSTART;TZID=...:..." -> key, params, value).
const splitProp = (line) => {
  const idx = line.indexOf(":");
  if (idx === -1) return null;
  const head = line.slice(0, idx).split(";");
  const key = (head[0] || "").toUpperCase();
  const params = {};
  head.slice(1).forEach((p) => {
    const eq = p.indexOf("=");
    if (eq !== -1) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1);
  });
  return { key, params, value: line.slice(idx + 1) };
};

const monthDayToNum = (c) => {
  const n = Number(c);
  return Number.isNaN(n) ? 0 : n;
};

// Parse an ICS date/date-time token into a { kind, date } descriptor.
const parseDateToken = (raw) => {
  const s = (raw || "").trim();
  if (!s) return null;
  const dateMatch = s.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (dateMatch) {
    return { kind: "allDay", date: new Date(Number(dateMatch[1]), Number(dateMatch[2]) - 1, Number(dateMatch[3])) };
  }
  const dt = s.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/);
  if (dt) {
    const [, y, mo, d, h, mi, se, z] = dt;
    if (z) {
      return { kind: "utc", date: new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(se))) };
    }
    return { kind: "local", date: new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(se)) };
  }
  return null;
};

const parseDuration = (s) => {
  const m = (s || "").match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  if (!m) return null;
  const days = monthDayToNum(m[1]);
  const hours = monthDayToNum(m[2]);
  const mins = monthDayToNum(m[3]);
  const secs = monthDayToNum(m[4]);
  return ((days * 24 + hours) * 60 + mins) * 60 + secs;
};

const EOL_PATTERNS = {
  ALL: /(ALL|GENERAL|FREE)/i,
  BUSY: /(BUSY|BLOCKED)/i,
  TENTATIVE: /TENTATIVE/i,
};

// Parse a full .ics document into normalized { uid, summary, description,
// location, start, end, allDay, recurring } events. Non-VEVENT components and
// malformed entries are collected into `warnings` instead of aborting.
export const parseICS = (text) => {
  const events = [];
  const warnings = [];
  const lines = unfoldLines(text);
  let current = null;
  const flush = () => {
    if (!current) return;
    const start = parseDateToken(current.DTSTART);
    if (!start) {
      warnings.push("Skipped a VEVENT without a parseable DTSTART.");
      current = null;
      return;
    }
    let end = current.DTEND ? parseDateToken(current.DTEND) : null;
    if (!end && current.DURATION) {
      const secs = parseDuration(current.DURATION);
      if (secs !== null) end = { kind: start.kind, date: new Date(start.date.getTime() + secs * 1000) };
    }
    if (!end) {
      const ms = start.kind === "allDay" ? 1000 * 60 * 60 * 24 : 1000 * 60 * 60;
      end = { kind: start.kind, date: new Date(start.date.getTime() + ms) };
    }
    const uid = current.UID || hashStr(`${current.SUMMARY || "event"}-${current.DTSTART}`);
    events.push({
      uid,
      summary: current.SUMMARY || "External event",
      description: current.DESCRIPTION || "",
      location: current.LOCATION || "",
      start: start.date,
      end: end.date,
      allDay: start.kind === "allDay",
      recurring: Boolean(current.RRULE),
      rrule: current.RRULE || "",
    });
    current = null;
  };

  lines.forEach((line) => {
    const prop = splitProp(line);
    if (!prop) return;
    if (prop.key === "BEGIN") {
      if (current) flush();
      if (String(prop.value).toUpperCase() === "VEVENT") current = {};
      return;
    }
    if (prop.key === "END") {
      if (String(prop.value).toUpperCase() === "VEVENT") flush();
      return;
    }
    if (current && current[prop.key] === undefined) current[prop.key] = prop.value;
  });
  flush();

  return { events, warnings };
};

// Subscribe key for one imported occurrence in schedule_events.google_event_id.
export const icsKey = (feedUrl, uid) => `ics:${feedUrl}:${uid}`;

// Map parsed events to schedule_events insert payloads. All-day events have no
// wall-clock slot, so they're excluded from the timeline and reported as skipped.
export const toScheduleEventRows = (events, feedUrl) => {
  const rows = [];
  let skippedAllDay = 0;
  events.forEach((ev) => {
    if (ev.allDay) {
      skippedAllDay++;
      return;
    }
    let start = ev.start;
    let end = ev.end;
    // UTC events surface on their local calendar day; floating/local stay as typed.
    if (ev.end.getTime() < ev.start.getTime()) end = new Date(start.getTime() + 1000 * 60 * 60);
    rows.push({
      title: ev.summary,
      type: "personal",
      date: toLocalDateStr(start),
      start_time: toLocalTimeStr(start),
      end_time: toLocalTimeStr(end),
      room: ev.location,
      description: ev.description,
      recurring: false,
      google_event_id: icsKey(feedUrl, ev.uid),
    });
  });
  return { rows, skippedAllDay };
};

// Diff: skip occurrences whose source key is already present locally. Returns
// the rows to create and how many were already on the calendar.
export const diffICS = (existingRows, incomingRows) => {
  const seen = new Set((existingRows || []).map((r) => r.google_event_id).filter(Boolean));
  const toCreate = [];
  let skipped = 0;
  (incomingRows || []).forEach((row) => {
    if (seen.has(row.google_event_id)) skipped++;
    else {
      seen.add(row.google_event_id);
      toCreate.push(row);
    }
  });
  return { toCreate, skipped };
};

// Fetch a remote .ics feed (CORS-permitting public calendars).
export const ICS_EXPAND_DAYS = 90;

export const fetchICSFeed = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Feed responded ${res.status} — double-check the .ics URL.`);
  const text = await res.text();
  return parseICS(text);
};

const DAY_KEY = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

// Parse an RRULE string into { freq, interval, count, until, byday }.
export const parseRRULE = (rule) => {
  const out = { freq: null, interval: 1, count: null, until: null, byday: null };
  (rule || "").split(";").forEach((part) => {
    const [k, v] = part.split("=");
    if (!k || !v) return;
    const key = k.toUpperCase();
    if (key === "FREQ") out.freq = v.toUpperCase();
    else if (key === "INTERVAL") out.interval = Math.max(1, parseInt(v, 10) || 1);
    else if (key === "COUNT") out.count = parseInt(v, 10) || null;
    else if (key === "UNTIL") out.until = parseDateToken(v)?.date || null;
    else if (key === "BYDAY") out.byday = v.split(",").map((d) => d.toUpperCase().trim());
  });
  return out;
};

// Expand recurring events into individual occurrences within a date window.
// Supports FREQ=WEEKLY|DAILY with INTERVAL, COUNT, UNTIL, BYDAY.
// Non-recurring events are emitted once if they fall inside the window.
export const expandICS = (events = [], { from = new Date(), to = null, maxEvents = 200 } = {}) => {
  const durMs = (a, b) => Math.max(0, (b?.getTime() || a.getTime()) - a.getTime());
  const fromMs = from.getTime();
  const toMs = to ? to.getTime() : null;
  const out = [];
  events.forEach((ev) => {
    if (!ev.start) return;
    const startMs = ev.start.getTime();
    if (Number.isNaN(startMs)) return;
    if (!ev.recurring) {
      if (startMs >= fromMs && (!toMs || startMs <= toMs)) out.push(ev);
      return;
    }
    const rule = parseRRULE(ev.rrule || "");
    const freq = rule.freq;
    if (freq !== "WEEKLY" && freq !== "DAILY") {
      // Unsupported frequency — keep the single base occurrence if in window.
      if (startMs >= fromMs && (!toMs || startMs <= toMs)) out.push(ev);
      return;
    }
    const startDow = ev.start.getDay();
    const byday = rule.byday && rule.byday.length ? new Set(rule.byday) : null;
    // Step by calendar days; weekly rules match on DTSTART's weekday (or BYDAY),
    // honouring INTERVAL as a week count.
    const MAX_STEPS = 4000;
    const dayMs = 86400000;
    let pt = new Date(ev.start);
    let occurrences = 0;
    let steps = 0;
    while (out.length < maxEvents && (rule.count == null || occurrences < rule.count) && steps < MAX_STEPS) {
      if (rule.until && pt > rule.until) break;
      if (toMs && pt.getTime() > toMs) break;
      const isCandidate =
        freq === "DAILY"
          ? true
          : byday
            ? byday.has(DAY_KEY[pt.getDay()])
            : pt.getDay() === startDow;
      const elapsedDays = Math.round((pt.getTime() - startMs) / dayMs);
      const weeksElapsed = Math.floor(elapsedDays / 7);
      const inInterval = freq === "DAILY" ? elapsedDays % rule.interval === 0 : weeksElapsed % rule.interval === 0;
      if (isCandidate && inInterval) {
        occurrences++;
        if (rule.count != null && occurrences > rule.count) break;
        const ms = pt.getTime();
        if (ms >= fromMs && (!toMs || ms <= toMs)) {
          out.push({
            ...ev,
            uid: `${ev.uid}#${occurrences}`,
            start: new Date(ms),
            end: new Date(ms + durMs(ev.start, ev.end)),
            occurrence: occurrences,
          });
        }
      }
      pt = new Date(pt.getTime() + dayMs);
      steps++;
    }
  });
  return out;
};

// Standard import window for recurring feeds: today .. today + ICS_EXPAND_DAYS.
export const expandForImport = (events = [], from = new Date()) => {
  const start = from ? new Date(from) : new Date();
  start.setHours(0, 0, 0, 0);
  const to = new Date(start);
  to.setDate(to.getDate() + ICS_EXPAND_DAYS);
  return expandICS(events, { from: start, to });
};