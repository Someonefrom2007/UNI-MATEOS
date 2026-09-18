// Formatting helpers for UNI·MATE — consistent across the app.

export const fmtDuration = (minutes) => {
  if (!minutes || minutes <= 0) return "0m";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
};

export const fmtGrade = (g) => {
  if (g === null || g === undefined || Number.isNaN(g)) return "—";
  return `${Number(g).toFixed(2)}`;
};

export const fmtPct = (n, total) => {
  if (!total) return "0%";
  return `${Math.round((n / total) * 100)}%`;
};

export const toLocalISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const todayISO = (d = new Date()) => toLocalISO(d);

export const isSameDay = (a, b) => a && b && a.slice(0, 10) === b.slice(0, 10);

export const daysUntil = (dateStr) => {
  if (!dateStr) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + "T00:00:00"); d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86400000);
};

// How long ago something happened. Mirrors daysUntil so past-dated records
// ("last studied") never render with deadline wording.
export const daysSince = (dateStr) => {
  const n = daysUntil(dateStr);
  if (n === null) return null;
  // Negating zero yields -0, which is a different value to Object.is and
  // renders oddly through arithmetic downstream. Today is 0 days ago.
  return n === 0 ? 0 : -n;
};

export const relativeDeadline = (dateStr) => {
  const n = daysUntil(dateStr);
  if (n === null) return "";
  if (n < 0) return `Overdue ${Math.abs(n)}d`;
  if (n === 0) return "Due today";
  if (n === 1) return "Due tomorrow";
  if (n <= 7) return `Due in ${n}d`;
  return `Due ${new Date(dateStr + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
};

export const relativeExam = (dateStr) => {
  const n = daysUntil(dateStr);
  if (n === null) return "";
  if (n < 0) return "Past";
  if (n === 0) return "Today";
  if (n === 1) return "Tomorrow";
  return `In ${n}d`;
};

export const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 19) return "Good afternoon";
  return "Good evening";
};

export const longDate = () =>
  new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

export const fmtTime = (t) => {
  if (!t) return "";
  const [h, m] = t.split(":");
  const hh = parseInt(h, 10);
  const ampm = hh >= 12 ? "PM" : "AM";
  const h12 = hh % 12 || 12;
  return `${h12}:${m} ${ampm}`;
};

export const fmtTimeShort = (t) => {
  if (!t) return "";
  const [h, m] = t.split(":");
  const hh = parseInt(h, 10);
  const ampm = hh >= 12 ? "p" : "a";
  const h12 = hh % 12 || 12;
  return `${h12}:${m}${ampm}`;
};

export const COURSE_COLORS = {
  amber: { dot: "bg-amber-500", text: "text-hud-amber", ring: "ring-amber-500/30", soft: "bg-amber-500/10", hex: "#f59e0b" },
  cyan: { dot: "bg-cyan-500", text: "text-hud-cyan", ring: "ring-cyan-500/30", soft: "bg-cyan-500/10", hex: "#06b6d4" },
  purple: { dot: "bg-violet-500", text: "text-hud-violet", ring: "ring-violet-500/30", soft: "bg-violet-500/10", hex: "#8b5cf6" },
  green: { dot: "bg-emerald-500", text: "text-hud-emerald", ring: "ring-emerald-500/30", soft: "bg-emerald-500/10", hex: "#10b981" },
  rose: { dot: "bg-rose-500", text: "text-hud-rose", ring: "ring-rose-500/30", soft: "bg-rose-500/10", hex: "#f43f5e" },
  blue: { dot: "bg-blue-500", text: "text-hud-cyan", ring: "ring-blue-500/30", soft: "bg-blue-500/10", hex: "#3b82f6" },
};

export const courseColor = (key) => COURSE_COLORS[key] || COURSE_COLORS.amber;

export const PRIORITY_META = {
  urgent: { label: "Urgent", cls: "text-hud-rose bg-hud-rose/10 border-hud-rose/30" },
  high: { label: "High", cls: "text-hud-amber bg-hud-amber/10 border-hud-amber/30" },
  medium: { label: "Medium", cls: "text-hud-cyan bg-hud-cyan/10 border-hud-cyan/30" },
  low: { label: "Low", cls: "text-muted-foreground bg-muted border-border" },
};

// Notes are authored in a rich-text editor, so `content` holds HTML. Anything
// that shows a one-line preview (list cards, course workspace, search results)
// has to render readable text instead of tags and entities.
const ENTITIES = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
};

export const notePreview = (html, max = 140) => {
  if (!html) return "";
  const text = String(html)
    // Close tags become spaces so adjacent blocks don't fuse into one word.
    .replace(/<\/(p|div|li|h[1-6]|blockquote)>/gi, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&[a-z]+;/gi, (m) => ENTITIES[m.toLowerCase()] ?? m)
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
};