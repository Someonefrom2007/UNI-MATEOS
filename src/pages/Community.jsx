import { useEffect, useState, useCallback, useMemo } from "react";
import { useAuth } from "@/lib/AuthContext";
import PageHeader from "@/components/PageHeader";
import PostComposer from "@/components/community/PostComposer";
import PostCard from "@/components/community/PostCard";
import { supabase } from "@/lib/supabase";
import { isLocalWorkspace } from "@/lib/repo/select";
import { createLocalRepo } from "@/lib/repo/localRepo";
import { CONTENT_TYPES, feedFilter, applyFilters, sortPosts, decoratePosts, reportReasons, scopeFeed, scopesFromPosts } from "@/lib/communityData";
import { Users, MessagesSquare, Bookmark } from "lucide-react";
import { useI18n } from "@/lib/i18n";

const LOCAL = isLocalWorkspace();
const localRepo = LOCAL ? createLocalRepo() : null;

const FEEDS = [
  { value: "discover", label: "Discover", icon: MessagesSquare },
  { value: "mine", label: "My posts", icon: Users },
  { value: "saved", label: "Saved", icon: Bookmark },
];

const SORTS = [
  { value: "new", label: "Newest" },
  { value: "top", label: "Top" },
];

const byDateDesc = (a, b) => String(b.created_at || "").localeCompare(String(a.created_at || ""));

// Merge display metadata onto raw rows without ever copying academic fields.
const enrich = (row, authorName) =>
  row && {
    ...row,
    author_name: row.author_name || authorName,
    created_by: row.created_by || row.author_email || authorName,
    created_date: row.created_at,
    status: row.status || "active",
  };

export default function Community() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [posts, setPosts] = useState(null);
  const [replies, setReplies] = useState([]);
  const [likes, setLikes] = useState([]);
  const [saves, setSaves] = useState([]);
  const [courses, setCourses] = useState([]);
  const [communities, setCommunities] = useState([]);
  const [groups, setGroups] = useState([]);
  const [reportingId, setReportingId] = useState(null);

  const [feed, setFeed] = useState("discover");
  const [type, setType] = useState("all");
  const [courseId, setCourseId] = useState("all");
  const [communityId, setCommunityId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("new");

  const userId = user?.id;
  const authorName = user?.full_name || (user?.email && user.email.split("@")[0].replace(/[._-]+/g, " ")) || "Local Student";

  const load = useCallback(async () => {
    try {
      if (LOCAL) {
        setPosts(localRepo.list("community_posts").slice().sort(byDateDesc).slice(0, 50).map((r) => enrich(r, authorName)));
        setReplies(localRepo.list("community_replies"));
        setLikes(localRepo.list("community_likes"));
        setSaves(localRepo.list("community_saves"));
        setCourses(localRepo.list("courses"));
        setCommunities(localRepo.list("communities"));
        setGroups(localRepo.list("study_groups"));
        return;
      }
      const [p, r, l, s, c] = await Promise.all([
        supabase.from("community_posts").select("*").order("created_at", { ascending: false }).limit(50),
        supabase.from("community_replies").select("*").order("created_at", { ascending: false }),
        supabase.from("community_likes").select("*"),
        supabase.from("community_saves").select("*"),
        supabase.from("courses").select("*"),
      ]);
      setPosts((p.data || []).map((row) => enrich(row, authorName)));
      setReplies((r.data || []).map((row) => enrich(row, authorName)));
      setLikes((l.data || []).map((row) => enrich(row, authorName)));
      setSaves((s.data || []).map((row) => enrich(row, authorName)));
      setCourses(c.data || []);
      try {
        const [cm, g] = await Promise.all([
          supabase.from("communities").select("*"),
          supabase.from("study_groups").select("*"),
        ]);
        setCommunities(cm.data || []);
        setGroups(g.data || []);
      } catch {
        // Hosted project predates the communities migration — scope stays off.
        setCommunities([]);
        setGroups([]);
      }
    } catch {
      setPosts([]);
    }
  }, [authorName]);

  useEffect(() => {
    load();
  }, [load]);

  const addPost = async (payload) => {
    const postDefaults = LOCAL ? { status: "active", author_name: authorName } : {};
    if (LOCAL) {
      localRepo.create("community_posts", { ...payload, ...postDefaults });
    } else {
      await supabase.from("community_posts").insert({ ...payload, ...postDefaults });
    }
    await load();
  };

  const addReply = async (postId, content) => {
    if (LOCAL) {
      localRepo.create("community_replies", { post_id: postId, content, author_name: authorName });
    } else {
      await supabase.from("community_replies").insert({ post_id: postId, content });
    }
    await load();
  };

  const toggleLike = async (post) => {
    const mine = likes.find((l) => l.post_id === post.id && (l.user_id ?? l.created_by_id) === userId);
    try {
      if (mine) {
        if (LOCAL) localRepo.delete("community_likes", mine.id);
        else await supabase.from("community_likes").delete().eq("id", mine.id);
      } else if (LOCAL) {
        localRepo.create("community_likes", { post_id: post.id });
      } else {
        await supabase.from("community_likes").insert({ post_id: post.id });
      }
      await load();
    } catch { /* optimistic state stays as-is */ }
  };

  const toggleSave = async (post) => {
    const mine = saves.find((s) => s.post_id === post.id && (s.user_id ?? s.created_by_id) === userId);
    try {
      if (mine) {
        if (LOCAL) localRepo.delete("community_saves", mine.id);
        else await supabase.from("community_saves").delete().eq("id", mine.id);
      } else if (LOCAL) {
        localRepo.create("community_saves", { post_id: post.id });
      } else {
        await supabase.from("community_saves").insert({ post_id: post.id });
      }
      await load();
    } catch { /* optimistic state stays as-is */ }
  };

  const handleReport = async (post, reason) => {
    const why = reportReasons.includes(reason) ? reason : "other";
    try {
      if (LOCAL) localRepo.create("community_reports", { post_id: post.id, reason: why, status: "open" });
      else await supabase.from("community_reports").insert({ post_id: post.id, reason: why });
    } catch { /* report is best-effort */ }
  };

  const onReport = (post, reason) => {
    if (reason) {
      handleReport(post, reason);
      setReportingId(null);
      return;
    }
    setReportingId((id) => (id === post.id ? null : post.id));
  };

  const deletePost = async (post) => {
    if (LOCAL) {
      localRepo.delete("community_posts", post.id);
      localRepo.deleteWhere("community_replies", (r) => r.post_id === post.id);
      localRepo.deleteWhere("community_likes", (l) => l.post_id === post.id);
      localRepo.deleteWhere("community_saves", (s) => s.post_id === post.id);
    } else {
      await supabase.from("community_posts").delete().eq("id", post.id);
      try {
        await supabase.from("community_replies").delete().eq("post_id", post.id);
      } catch { /* others' replies are simply orphaned and never rendered */ }
      try {
        await supabase.from("community_likes").delete().eq("post_id", post.id);
      } catch { /* likes are cleaned up best-effort */ }
      try {
        await supabase.from("community_saves").delete().eq("post_id", post.id);
      } catch { /* saves are cleaned up best-effort */ }
    }
    await load();
  };

  const savedIds = useMemo(() => new Set((saves || []).map((s) => s.post_id)), [saves]);

  const scopeOptions = useMemo(
    () => scopesFromPosts(posts || [], { communities, groups }),
    [posts, communities, groups]
  );

  const visible = useMemo(() => {
    const base = feedFilter(posts || [], { feed, userId, savedIds });
    const scoped = scopeFeed(base, { communityId, groupId });
    const filtered = applyFilters(scoped, { type, courseId, query });
    const decorated = decoratePosts(filtered, { likes, replies, courses, communities, groups, userId, savedIds });
    return sortPosts(decorated, sort);
  }, [posts, feed, userId, savedIds, type, courseId, query, sort, likes, replies, courses, communities, groups, communityId, groupId]);

  return (
    <>
      <PageHeader title={t("title.community")} subtitle={t("title.community.subtitle")} />

      <div className="max-w-3xl space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {FEEDS.map((f) => {
            const Icon = f.icon;
            const active = feed === f.value;
            return (
              <button
                key={f.value}
                onClick={() => setFeed(f.value)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
              >
                <Icon className="w-4 h-4" />
                {f.label}
              </button>
            );
          })}
          <div className="ml-auto flex items-center gap-1">
            {SORTS.map((s) => (
              <button
                key={s.value}
                onClick={() => setSort(s.value)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${sort === s.value ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/60"}`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setType("all")}
            className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${type === "all" ? "border-primary/50 text-cyan-300 bg-primary/10" : "border-border/70 text-muted-foreground hover:border-accent/40"}`}
          >
            All
          </button>
          {CONTENT_TYPES.map((t) => (
            <button
              key={t.value}
              onClick={() => setType(type === t.value ? "all" : t.value)}
              className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${type === t.value ? `${t.cls} border-current` : "border-border/70 text-muted-foreground hover:border-accent/40"}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {scopeOptions.communities.length > 0 || scopeOptions.groups.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${!communityId && !groupId ? "border-primary/50 text-cyan-300 bg-primary/10" : "border-border/70 text-muted-foreground hover:border-accent/40 cursor-pointer"}`}
              onClick={() => {
                setCommunityId("");
                setGroupId("");
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setCommunityId("");
                  setGroupId("");
                }
              }}
            >
              All scopes
            </span>
            {scopeOptions.communities.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  setCommunityId(communityId === c.id ? "" : c.id);
                  setGroupId("");
                }}
                className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${communityId === c.id ? "border-primary/50 text-cyan-300 bg-primary/10" : "border-border/70 text-muted-foreground hover:border-accent/40"}`}
                title={c.kind === "course" ? "Course community" : "University community"}
              >
                {c.name}{c.kind === "course" ? " · course" : ""}
              </button>
            ))}
            {scopeOptions.groups.map((g) => (
              <button
                key={g.id}
                onClick={() => {
                  setGroupId(groupId === g.id ? "" : g.id);
                  setCommunityId("");
                }}
                className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${groupId === g.id ? "border-primary/50 text-cyan-300 bg-primary/10" : "border-border/70 text-muted-foreground hover:border-accent/40"}`}
                title="Study group"
              >
                <Users className="w-3 h-3 inline-block mr-1 -mt-0.5" />
                {g.name}
              </button>
            ))}
          </div>
        ) : null}

        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the community…"
            aria-label="Search the community"
            className="flex-1 h-10 px-3 rounded-lg border border-border bg-background text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-accent/50"
          />
          <select
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
            className="h-10 px-3 rounded-lg border border-border bg-background text-sm text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent/50"
            aria-label="Filter by course"
          >
            <option value="all">All courses</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <PostComposer courses={courses} groups={LOCAL ? groups : []} onPost={addPost} />

        {posts === null && [0, 1, 2].map((i) => <div key={i} className="h-28 bg-muted rounded-xl animate-pulse" />)}

        {visible.length === 0 && posts !== null && (
          <div className="text-center py-16 border border-dashed border-border rounded-xl">
            <Users className="w-10 h-10 text-muted-foreground mx-auto" />
            <p className="font-medium mt-3">Nothing here yet</p>
            <p className="text-sm text-muted-foreground mt-1">{feed === "saved" ? "Posts you save will show up here." : feed === "mine" ? "Your posts will show up here." : "Be the first to share a question, tip, win or resource."}</p>
          </div>
        )}

        {visible.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            replies={replies.filter((r) => r.post_id === post.id)}
            likes={likes.filter((l) => l.post_id === post.id)}
            userId={userId}
            courseName={post.courseName}
            onToggleLike={toggleLike}
            onReply={addReply}
            onDelete={deletePost}
            onToggleSave={toggleSave}
            onReport={onReport}
            reportOpen={reportingId === post.id}
          />
        ))}
      </div>
    </>
  );
}