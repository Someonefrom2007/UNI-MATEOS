// Offline heuristic fallback for the AI assistant. Pure and deterministic —
// every generator here reads the user's own data and does string work, so the
// assistant still answers something useful when the Edge Function is
// unreachable, erroring, or absent (local workspace, no Supabase env).
//
// This is deliberately not a language model and does not pretend to be one.
// The replies are derived from real rows and real date maths, and the UI labels
// them as heuristic so a user is never misled about what produced them.

import { daysBetween } from "@/lib/nextUrgent";
import { readinessBoard, planRevisionSchedule } from "@/lib/examReadiness";

/**
 * Assistant availability. ONLInE is a real model reply; everything else is a
 * locally-computed answer the UI must label honestly.
 */
export const AI_STATUS = Object.freeze({
  ONLINE: "ONLINE",
  DEGRADED: "DEGRADED",
  UNAVAILABLE: "UNAVAILABLE",
  OFFLINE_HEURISTIC: "OFFLINE MODE (HEURISTIC)",
});

/** True when a status means "the answer came from us, not a model". */
export const isHeuristic = (status) => status !== AI_STATUS.ONLINE;

/**
 * Classify what `supabase.functions.invoke("ai-assistant")` actually returned.
 *
 * The trap this exists to catch: the client does NOT throw on a non-2xx edge
 * response, it resolves with `{ data, error }`. Only transport failures throw.
 * So a server 500 used to fall through to `reply || "couldn't answer that"`
 * and the user was told to rephrase a question the server had crashed on.
 *
 * @param {{ data?: any, error?: any }} [res]
 * @returns {{ status: string, reply: string | null, reason: string | null }}
 */
export const classifyInvokeResult = (res) => {
  if (!res) return { status: AI_STATUS.UNAVAILABLE, reply: null, reason: "no-response" };
  if (res.error) return { status: AI_STATUS.UNAVAILABLE, reply: null, reason: res.error.message || "transport-error" };

  const data = res.data || {};
  if (typeof data.reply === "string" && data.reply.trim()) {
    return { status: AI_STATUS.ONLINE, reply: data.reply, reason: null };
  }
  // Reachable but useless: a plan lock, a validation 400, or an empty model
  // response. Distinct from UNAVAILABLE because retrying may well help.
  if (data.locked) return { status: AI_STATUS.DEGRADED, reply: null, reason: data.error || "plan-locked" };
  if (data.error) return { status: AI_STATUS.DEGRADED, reply: null, reason: data.error };
  return { status: AI_STATUS.DEGRADED, reply: null, reason: "empty-response" };
};

const PRIORITY_POINTS = { urgent: 40, high: 30, medium: 20, low: 10 };

/**
 * Rank open tasks by what will hurt soonest.
 *
 * The mission asked for "due date and weight", but `tasks` has no weight
 * column — urgency comes from the priority enum and `estimated_duration`
 * instead, so the ranking leans on due date first and effort second. Anything
 * already overdue is pushed to the top, hardest first.
 *
 * @param {object[]} tasks
 * @param {{ todayStr?: string, limit?: number, courseOf?: (id: string) => any }} [opts]
 * @returns {Array<{ task: object, score: number, reason: string, course: any }>}
 */
export const triageAssignments = (tasks = [], { todayStr, limit = 5, courseOf } = {}) => {
  const open = (tasks || []).filter((t) => t && t.status !== "completed");

  const scored = open.map((task) => {
    const days = daysBetween(task.due_date, todayStr);
    const overdue = days !== null && days < 0;
    const base = PRIORITY_POINTS[task.priority] ?? PRIORITY_POINTS.medium;

    // Overdue work dominates: each missed day is worth more than the whole
    // priority spread, which is what makes a low-priority missed deadline
    // outrank a high-priority one due in three weeks.
    const urgency = days === null ? 0 : (overdue ? 40 + Math.abs(days) * 3 : Math.max(0, 20 - days * 2));
    const effort = Math.min(15, (Number(task.estimated_duration) || 0) / 15);
    const score = Math.round(base + urgency + effort);

    const reason = overdue
      ? `overdue by ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"}`
      : days === 0 ? "due today"
      : days === 1 ? "due tomorrow"
      : days === null ? "no due date"
      : `due in ${days} days`;

    return { task, score, reason, course: courseOf ? courseOf(task.course_id) : undefined };
  });

  scored.sort((a, b) => b.score - a.score || String(a.task.title).localeCompare(String(b.task.title)));
  return scored.slice(0, Math.max(0, limit));
};

/**
 * Revision plan ordered by exam urgency, using the same readiness maths the
 * dashboard renders so the two never disagree.
 *
 * @param {{ exams?: object[], courses?: object[], focusSessions?: object[],
 *           todayStr?: string, limit?: number }} [opts]
 * @returns {Array<{ exam: object, course: any, readiness: object, blocks: object[] }>}
 */
export const studyPlanPrompt = ({ exams = [], courses = [], focusSessions = [], todayStr, limit = 3 } = {}) => {
  const courseOf = (id) => (courses || []).find((c) => c.id === id);
  const board = readinessBoard({ exams, courses, focusSessions, todayStr, withinDays: 30 });

  return board
    .sort((a, b) => (a.readiness.score - b.readiness.score) || (a.daysLeft - b.daysLeft))
    .slice(0, Math.max(0, limit))
    .map(({ exam, course, readiness }) => ({
      exam, course, readiness,
      blocks: planRevisionSchedule({ exam, todayStr }),
    }));
};

// --- Local text heuristics -------------------------------------------------

const DEFINITION = [
  // /pattern/ captures the term on the left of the definition.
  { re: /^(.{2,60}?)\s+(?:=|:)\s+(.{8,})$/, q: (t) => `What is ${t}?` },
  { re: /^(.{2,60}?)\s+(?:is|are)\s+(.{8,})$/i, q: (t) => `What is ${t}?` },
  { re: /^(?:what is|what are|define)\s+(.{2,60}?)\s*\?$/i, q: (t) => `What is ${t}?` },
  { re: /^(.{2,60}?)\s+means\s+(.{8,})$/i, q: (t) => `What does ${t} mean?` },
  { re: /^(.{2,60}?)\s+stands for\s+(.{8,})$/i, q: (t) => `What does ${t} stand for?` },
  { re: /^(.{2,60}?)\s*[—–-]\s+(.{8,})$/, q: (t) => `What is ${t}?` },
];

const FILLER = /^(?:note|notes|important|key|todo|summary|overview|example|e\.g\.|i\.e\.|also|finally)\b[:\s]*/i;
const QUESTION_LINE = /^(?:q(?:uestion)?|a(?:nswer)?)\s*[:.\-]\s*(.+)$/i;
const BULLET = /^\s*(?:[-*•·]|\d+[.)])\s+(.+)$/;

/**
 * Strip a leading callout label and surrounding punctuation.
 *
 * The trailing period is only removed when it looks like sentence punctuation
 * rather than an abbreviation — otherwise "U.S." becomes "U.S" and "etc."
 * becomes "etc", which quietly corrupts the flashcard being built from it.
 */
const clean = (s) => {
  const trimmed = s.replace(FILLER, "").replace(/^[\s:—–-]+/, "").trim();
  // Keep the dot when the token before it ends in a capital or a single letter
  // (U.S., Ph.D., etc.).
  return /[A-Z]\.$|^[a-z]\.$/.test(trimmed) ? trimmed : trimmed.replace(/[\s.]+$/, "");
};

/**
 * The useful half of a "Q: ... A: ..." line: the answer if there is one, else
 * the question. A single alternation regex got this subtly wrong (a non-greedy
 * branch swallowed the first character), so it is split explicitly.
 */
const qaContent = (line) => {
  const pair = line.match(/^q(?:uestion)?\s*[:.\-]\s*(.+?)\s*a(?:nswer)?\s*[:.\-]\s*(.+)$/i);
  if (pair) return clean(pair[2]);
  const single = line.match(QUESTION_LINE);
  return single ? clean(single[1]) : null;
};

/**
 * Split prose into candidate keypoints. Prefers explicit question/answer and
 * bullet lines, then definitional sentences, then falls back to the longest
 * sentences so a paragraph of prose still yields something usable.
 */
export const keypoints = (text = "", { limit = 6, minLength = 24 } = {}) => {
  const raw = String(text || "").split(/\n+/).map((l) => l.trim()).filter(Boolean);
  if (!raw.length) return [];

  const out = [];
  const seen = new Set();
  const push = (s) => {
    const v = clean(s);
    if (v.length < minLength || seen.has(v.toLowerCase())) return;
    seen.add(v.toLowerCase());
    out.push(v);
  };

  // 1. Lines that are already Q/A pairs — the highest-signal material. Keep the
  // answer, not the "Q:"/"A:" scaffolding, since this feeds summaries.
  for (const line of raw) {
    const t = qaContent(line);
    if (t && t.length >= minLength) { out.push(t); seen.add(t.toLowerCase()); }
  }

  // 2. Bullets, which are usually the author's own idea of what matters.
  for (const line of raw) {
    const b = line.match(BULLET);
    if (b) push(b[1]);
  }

  // 3. Definitional sentences. The whole sentence is kept here (unlike the
  // flashcard path, which needs the term split off) because a summary bullet
  // reading "the process by which a cell divides..." has lost its subject.
  if (out.length < limit) {
    for (const block of raw) {
      for (const sentence of block.split(/(?<=[.!?])\s+/)) {
        for (const d of DEFINITION) {
          const m = sentence.match(d.re);
          if (m && m[2]) { push(sentence); break; }
        }
      }
    }
  }

  // 4. Last resort: the longest sentences, which carry the most content.
  if (!out.length) {
    raw
      .flatMap((b) => b.split(/(?<=[.!?])\s+/))
      .map(clean)
      .filter((s) => s.length >= minLength)
      .sort((a, b) => b.length - a.length)
      .slice(0, limit)
      .forEach(push);
  }

  return out.slice(0, limit);
};

/**
 * Build flashcard Q/A pairs from free text. Only emits a card when it can
 * recover both halves of the definition — a flashcard with an empty answer is
 * worse than no flashcard, so those candidates are dropped.
 *
 * @returns {Array<{ front: string, back: string }>}
 */
export const buildFlashcards = (text = "", { limit = 8 } = {}) => {
  const raw = String(text || "");
  const cards = [];
  const seen = new Set();

  for (const line of raw.split(/\n+/).map((l) => l.trim()).filter(Boolean)) {
    // "Q: ... / A: ..." pairs first.
    const qa = line.match(/^q(?:uestion)?\s*[:.\-]\s*(.+?)\s*(?:a(?:nswer)?\s*[:.\-]\s*(.+))?$/i);
    if (qa) {
      const front = clean(qa[1]);
      const back = qa[2] ? clean(qa[2]) : "";
      if (front && back && !seen.has(front.toLowerCase())) {
        cards.push({ front, back });
        seen.add(front.toLowerCase());
      }
      continue;
    }

    const body = (line.match(BULLET) || [null, line])[1];
    for (const d of DEFINITION) {
      const m = body.match(d.re);
      if (!m) continue;
      const term = clean(m[1]);
      const def = clean(m[2]);
      if (!term || !def) break;
      const front = d.q(term);
      if (seen.has(front.toLowerCase())) break;
      cards.push({ front, back: def });
      seen.add(front.toLowerCase());
      break;
    }
    if (cards.length >= limit) break;
  }

  return cards.slice(0, limit);
};

/** Multi-sentence summary: the top keypoints joined, plus a word count. */
export const summarizeNote = (text = "", { limit = 4 } = {}) => {
  const points = keypoints(text, { limit });
  const words = String(text || "").trim().split(/\s+/).filter(Boolean).length;
  if (!points.length) return { points: [], words, summary: "" };
  return {
    points,
    words,
    summary: points.map((p, i) => `${i + 1}. ${p}`).join("\n"),
  };
};

// --- Intent routing --------------------------------------------------------

const INTENTS = [
  { kind: "triage", re: /\b(triage|prioriti[sz]e|priorities|what should i do|what do i do|next|overdue|behind|to-?do|deadline)\b/i },
  { kind: "study", re: /\b(study plan|revision|revise|prepare|plan for|exam plan|schedule.*stud|study schedule)\b/i },
  { kind: "flashcards", re: /\b(flash ?cards?|quiz|test me|practice questions|cards)\b/i },
  { kind: "summary", re: /\b(summari[sz]e|summary|tl;?dr|key points?|keypoints?|gist|sticky|stickies|note)\b/i },
];

/**
 * Which generator a free-text question maps to. Returns null when nothing
 * matches so the caller can fall back to a workspace overview.
 */
export const detectIntent = (prompt = "") => {
  const text = String(prompt || "");
  for (const { kind, re } of INTENTS) if (re.test(text)) return kind;
  return null;
};

const list = (items) => items.map((s, i) => `${i + 1}. ${s}`).join("\n");

/**
 * Produce the heuristic answer for a question from real workspace data.
 * Returns null only when there is nothing at all to say.
 */
export const heuristicReply = (prompt, ctx = {}) => {
  const { tasks = [], courses = [], exams = [], notes = [], stickies = [], focusSessions = [], todayStr } = ctx;
  const intent = detectIntent(prompt);
  const courseOf = (id) => courses.find((c) => c.id === id);

  if (intent === "triage") {
    const ranked = triageAssignments(tasks, { todayStr, courseOf });
    if (!ranked.length) return "No open tasks — you're clear.";
    return `Priority order (computed on-device from due dates and priority):\n\n${list(
      ranked.map((r) => `${r.task.title} — ${r.reason}${r.course ? ` · ${r.course.name}` : ""}`)
    )}`;
  }

  if (intent === "study") {
    const plan = studyPlanPrompt({ exams, courses, focusSessions, todayStr });
    if (!plan.length) return "No exams scheduled in the next 30 days.";
    return `Revision plan, most urgent first:\n\n${list(
      plan.map(({ exam, course, readiness, blocks }) => {
        const head = `${exam.name}${course ? ` (${course.name})` : ""} — ${readiness.score}% ready, ${readiness.daysLeft}d left`;
        const detail = blocks.length
          ? `\n   ${blocks.map((b) => `${b.daysOut === 0 ? "today" : `in ${b.daysOut}d`}: ${b.focus} (${b.minutes}m)`).join(" · ")}`
          : "\n   exam is today or past — cram or rest";
        return head + detail;
      })
    )}`;
  }

  // Summarisation works off an explicit note, else any sticky. The title match
  // needs a non-empty title: `"anything".includes("")` is true, so an untitled
  // note would otherwise hijack every prompt and win over notes[0].
  const titled = String(prompt).toLowerCase();
  const source = notes.find((n) => {
    const t = String(n?.title || "").trim().toLowerCase();
    return t.length > 0 && titled.includes(t);
  })
    || notes[0]
    || { title: "Sticky notes", content: stickies.map((s) => s.content).join("\n") };

  const body = source?.content || "";
  if (!body.trim() && !stickies.length) return "I don't have any notes or stickies to work from yet.";

  if (intent === "flashcards") {
    const cards = buildFlashcards(body);
    if (!cards.length) return "I couldn't find clear definitions in that note to turn into flashcards.";
    return `${cards.length} flashcards:\n\n${list(cards.map((c) => `Q: ${c.front}\n   A: ${c.back}`))}`;
  }

  const { summary, words } = summarizeNote(body);
  if (!summary) return "That note is too short to summarise yet.";
  // An untitled note must not render as the literal string "undefined".
  const label = String(source.title || "").trim() || "your note";
  return `Key points from "${label}" (${words} words):\n\n${summary}`;
};

/**
 * Full offline response: the status the UI should show plus the message body.
 * Always returns a string for `text`, so the chat never renders an empty
 * bubble or leaves the composer spinning.
 */
export const offlineResponse = (prompt, ctx = {}) => {
  const status = ctx.status || AI_STATUS.OFFLINE_HEURISTIC;
  let body;
  try {
    body = heuristicReply(prompt, ctx);
  } catch (e) {
    // A heuristic generator must never be the reason the chat breaks.
    body = "I couldn't compute an answer from your data just now.";
  }
  if (!body) {
    body = ctx.hasData === false
      ? "Add a course or a couple of tasks and I can work something out on-device."
      : "I don't have enough data on this device to answer that yet.";
  }
  return { status, heuristic: isHeuristic(status), text: body };
};
