// Community data helpers — Discover-centric feed logic, content-type registry,
// moderation state machine, save/report helpers, and identity rendering.
// Pure and deterministic so Community.jsx stays thin and everything is testable
// without a database or browser.
//
// Identity rule (§22): initials/geometric only — never photos. Community rows
// never carry academic metrics: decoration exposes only a course NAME, never
// grades, ECTS, averages, or attendance.

export const CONTENT_TYPES = Object.freeze([
  { value: "question", label: "Question", en: "Question", cls: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20" },
  { value: "tip", label: "Tip", en: "Tip", cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  { value: "win", label: "Win", en: "Win", cls: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  { value: "resource", label: "Resource", en: "Resource", cls: "bg-violet-500/10 text-violet-400 border-violet-500/20" },
  { value: "event", label: "Event", en: "Event", cls: "bg-sky-500/10 text-sky-400 border-sky-500/20" },
  { value: "announcement", label: "Announcement", en: "Announcement", cls: "bg-rose-500/10 text-rose-400 border-rose-500/20" },
]);

export const contentType = (value) => CONTENT_TYPES.find((t) => t.value === value) || CONTENT_TYPES[0];

export const MODERATION = Object.freeze({
  ACTIVE: "active",
  PENDING: "pending",
  HIDDEN: "hidden",
  REMOVED: "removed",
});

export const MODERATION_META = Object.freeze({
  active: { label: "Active", cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  pending: { label: "Pending review", cls: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  hidden: { label: "Hidden by you", cls: "bg-muted text-muted-foreground border-border" },
  removed: { label: "Removed by moderators", cls: "bg-rose-500/10 text-rose-400 border-rose-500/20" },
});

export const moderationMeta = (status) => MODERATION_META[status] || MODERATION_META.active;

// Allowed moderation moves. Actions mimic the surface the current user can do:
// self-hide/restore their own content, and moderator resolve actions that the
// schema/RLS layer will gate server-side.
const MODERATION_TRANSITIONS = {
  active: ["self_hide", "mod_remove"],
  hidden: ["self_restore", "mod_remove"],
  pending: ["mod_approve", "mod_remove"],
  removed: ["mod_restore"],
};

export const canTransition = (status, action) => {
  if (status == null || !action) return false;
  const list = MODERATION_TRANSITIONS[status] || MODERATION_TRANSITIONS.active;
  return list.includes(action);
};

export const applyModeration = (status, action, overrides = {}) => {
  if (!canTransition(status, action)) return status;
  if (action === "self_hide") return MODERATION.HIDDEN;
  if (action === "self_restore" || action === "mod_approve") return MODERATION.ACTIVE;
  if (action === "mod_remove") return MODERATION.REMOVED;
  if (action === "mod_restore") return MODERATION.ACTIVE;
  return overrides.status || status;
};

// Legacy rows and pre-moderated writes default to "active".
export const effectiveStatus = (post) => (post && post.status) || MODERATION.ACTIVE;

export const reportReasons = Object.freeze(["spam", "inappropriate", "misinformation", "other"]);

export const newReport = ({ postId = "", reason = "other", userId = "", idFactory = null } = {}) => ({
  id: idFactory ? idFactory() : "report:new",
  post_id: postId,
  user_id: userId,
  reason,
  status: "open",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

// Pure toggle of a saved-post id set (immutable).
export const toggleSaved = (savedIds, postId) => {
  const next = new Set(savedIds || []);
  if (next.has(postId)) next.delete(postId);
  else next.add(postId);
  return next;
};

// A post is visible in discovery if its owner sees it always and everyone may
// see content marked active (own moderation hidden/removed posts stay private).
export const isVisible = (post, userId) => {
  if (!post) return false;
  const mine = post.user_id === userId;
  return mine || effectiveStatus(post) === MODERATION.ACTIVE;
};

const matches = (post, userId) => post && post.user_id === userId;

export const feedFilter = (posts = [], { feed = "discover", userId = "", savedIds = new Set() } = {}) => {
  const test =
    feed === "mine" ? (p) => matches(p, userId)
    : feed === "saved" ? (p) => savedIds.has(p.id)
    : (p) => isVisible(p, userId);
  return posts.filter(test);
};

export const applyFilters = (posts = [], { type = "all", courseId = "all", query = "" } = {}) =>
  posts.filter((p) => {
    if (type && type !== "all" && p.type !== type) return false;
    if (courseId && courseId !== "all" && p.course_id !== courseId) return false;
    if (query && query.trim()) {
      const q = query.trim().toLowerCase();
      const hay = `${p.title || ""} ${p.content || ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

export const sortPosts = (posts = [], mode = "new") => {
  const byDate = (a, b) => String(b.created_at || "").localeCompare(String(a.created_at || ""));
  if (mode === "top") {
    const score = (p) => (p.like_count || 0) + (p.reply_count || 0);
    return [...posts].sort((a, b) => score(b) - score(a) || byDate(a, b));
  }
  return [...posts].sort(byDate);
};

const likeAuthorId = (l) => l.user_id ?? l.created_by_id;

// One deterministic gradient per identity — no photos (§8/§22).
export const IDENTITY_GRADIENTS = Object.freeze([
  "from-amber-500 to-orange-600",
  "from-cyan-500 to-sky-600",
  "from-violet-500 to-fuchsia-600",
  "from-emerald-500 to-teal-600",
  "from-rose-500 to-pink-600",
  "from-blue-500 to-indigo-600",
]);

const hashStr = (s = "") => {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
};

export const identityGradient = (seed = "") => IDENTITY_GRADIENTS[hashStr(String(seed)) % IDENTITY_GRADIENTS.length];

export const authorIdentity = (email = "", fullName = "") => {
  const name = (fullName && fullName.trim()) || (email || "Student").split("@")[0];
  const words = name.replace(/[._-]+/g, " ").trim().split(/\s+/).filter(Boolean);
  const initials = words.slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join("") || "S";
  const display = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  return { name: display, initials, gradient: identityGradient(display) };
};

// Decoration turns raw rows into what the feed renders. Courses contribute a
// NAME only — academic data never leaks into the community (§22).
export const decoratePosts = (posts = [], { likes = [], replies = [], courses = [], userId = "", savedIds = new Set() } = {}) =>
  posts.map((post) => {
    const postLikes = likes.filter((l) => l.post_id === post.id);
    const postReplies = replies.filter((r) => r.post_id === post.id);
    const course = courses.find((c) => c.id === post.course_id);
    const identity = authorIdentity(post.created_by || post.author_email, post.author_name);
    return {
      ...post,
      status: effectiveStatus(post),
      like_count: postLikes.length,
      reply_count: postReplies.length,
      liked: postLikes.some((l) => likeAuthorId(l) === userId),
      saved: savedIds.has(post.id),
      mine: post.user_id === userId,
      authorName: identity.name,
      authorInitials: identity.initials,
      authorGradient: identity.gradient,
      courseName: course ? course.name : null,
    };
  });

export const timeAgo = (iso, now = Date.now()) => {
  if (!iso) return "";
  const s = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return `${Math.floor(s / 604800)}w ago`;
};