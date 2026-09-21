import { useEffect, useState, useCallback, useMemo } from "react";
import { useAuth } from "@/lib/AuthContext";
import PageHeader from "@/components/PageHeader";
import PostComposer from "@/components/community/PostComposer";
import PostCard from "@/components/community/PostCard";
import ScopeManager from "@/components/community/ScopeManager";
import { supabase } from "@/lib/supabase";
import { isLocalWorkspace, getAppRepo } from "@/lib/repo/select";
import { CONTENT_TYPES, feedFilter, applyFilters, sortPosts, decoratePosts, reportReasons, scopeFeed, scopesFromPosts, createCommunity, createStudyGroup, createMembership, isMember, myScopes } from "@/lib/communityData";
import { Users, MessagesSquare, Bookmark } from "lucide-react";
import { useI18n } from "@/lib/i18n";

const LOCAL = isLocalWorkspace();
const repo = getAppRepo();

// A table read that can't happen (e.g. a group/community not yet migrated in
// the hosted project) degrades to an empty list instead of failing the feed.
const listOrZero = async (table) => {
  try {
    return (await repo.list(table)) || [];
  } catch {
    return [];
  }
};

const FEEDS = [
  { value: "discover", label: "Discover", icon: MessagesSquare },
  { value: "mine", label: "My posts", icon: Users },
  { value: "saved", label: "Saved", icon: Bookmark },
];

const SORTS = [
  { value: "new", label: "Newest" },
  { value: "top", label: "Top" },
];

// Realtime is a hosted-only feature: the community feed subscribes to its own
// tables so new posts, replies, likes, memberships and scopes appear live.
// Handlers must attach BEFORE .subscribe() (see useUserData notes).
const REALTIME_COMMUNITY_TABLES = ["community_posts", "community_replies", "community_likes", "community_saves", "community_members", "communities", "study_groups"];
let communityChannelSeq = 0;
const realtimeCommunityChannel = () => `unimate-community-${Date.now()}-${communityChannelSeq++}`;

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
  const [members, setMembers] = useState([]);
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
      const [p, r, l, s, c] = await Promise.all([
        listOrZero("community_posts"),
        listOrZero("community_replies"),
        listOrZero("community_likes"),
        listOrZero("community_saves"),
        listOrZero("courses"),
      ]);
      setPosts(p.slice().sort(byDateDesc).slice(0, 50).map((row) => enrich(row, authorName)));
      setReplies(r.map((row) => enrich(row, authorName)));
      setLikes(l.map((row) => enrich(row, authorName)));
      setSaves(s.map((row) => enrich(row, authorName)));
      setCourses(c);
      const [cm, g, m] = await Promise.all([listOrZero("communities"), listOrZero("study_groups"), listOrZero("community_members")]);
      setCommunities(cm);
      setGroups(g);
      setMembers(m);
    } catch {
      setPosts([]);
    }
  }, [authorName]);

  useEffect(() => {
    load();
  }, [load]);

  const loaded = posts !== null;
  useEffect(() => {
    if (LOCAL || !loaded) return;
    const channel = supabase.channel(realtimeCommunityChannel());
    REALTIME_COMMUNITY_TABLES.forEach((table) => {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, () => load());
    });
    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [loaded, load]);

  const addPost = async (payload) => {
    const postDefaults = LOCAL ? { status: "active", author_name: authorName } : {};
    await repo.create("community_posts", { ...payload, ...postDefaults });
    await load();
  };

  const addReply = async (postId, content) => {
    const reply = { post_id: postId, content };
    if (LOCAL) reply.author_name = authorName;
    await repo.create("community_replies", reply);
    await load();
  };

  const toggleLike = async (post) => {
    const mine = likes.find((l) => l.post_id === post.id && (l.user_id ?? l.created_by_id) === userId);
    try {
      if (mine) {
        await repo.delete("community_likes", mine.id);
      } else {
        await repo.create("community_likes", { post_id: post.id });
      }
      await load();
    } catch { /* optimistic state stays as-is */ }
  };

  const toggleSave = async (post) => {
    const mine = saves.find((s) => s.post_id === post.id && (s.user_id ?? s.created_by_id) === userId);
    try {
      if (mine) {
        await repo.delete("community_saves", mine.id);
      } else {
        await repo.create("community_saves", { post_id: post.id });
      }
      await load();
    } catch { /* optimistic state stays as-is */ }
  };

  const handleReport = async (post, reason) => {
    const why = reportReasons.includes(reason) ? reason : "other";
    try {
      const report = { post_id: post.id, reason: why };
      if (LOCAL) report.status = "open";
      await repo.create("community_reports", report);
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
    await repo.delete("community_posts", post.id);
    for (const table of ["community_replies", "community_likes", "community_saves"]) {
      try {
        await repo.deleteWhere(table, (r) => r.post_id === post.id);
      } catch { /* hosted FK cascades remove children; other orphans are best-effort */ }
    }
    await load();
  };

  const savedIds = useMemo(() => new Set((saves || []).map((s) => s.post_id)), [saves]);

  const createScope = async (kind, payload) => {
    try {
      if (kind === "community") {
        const course = courses.find((c) => c.id === payload.courseId);
        const row = createCommunity({ kind: payload.kind, name: payload.name, courseId: payload.courseId, courseName: course?.name });
        delete row.id;
        delete row.created_by;
        await repo.create("communities", row);
      } else {
        const row = createStudyGroup({ name: payload.name, communityId: payload.communityId, courseId: payload.courseId });
        delete row.id;
        delete row.created_by;
        await repo.create("study_groups", row);
      }
      await load();
    } catch { /* a failed create leaves state as-is */ }
  };

  const toggleMember = async (scope, kind) => {
    if (!userId) return;
    try {
      if (isMember(members, kind, scope.id, userId)) {
        const mine = (members || []).find(
          (m) => m.user_id === userId && (kind === "community" ? String(m.community_id) === String(scope.id) : String(m.group_id) === String(scope.id))
        );
        if (mine) await repo.delete("community_members", mine.id);
      } else {
        const row = createMembership({
          communityId: kind === "community" ? scope.id : "",
          groupId: kind === "group" ? scope.id : "",
        });
        await repo.create("community_members", row);
      }
      await load();
    } catch { /* membership change is best-effort */ }
  };

  const deleteScope = async (scope, kind) => {
    try {
      await repo.delete(kind === "community" ? "communities" : "study_groups", scope.id);
      await load();
    } catch { /* FK-restrained delete is best-effort */ }
  };

  const myCommunities = useMemo(() => myScopes(communities, members, "community", userId), [communities, members, userId]);
  const myGroups = useMemo(() => myScopes(groups, members, "group", userId), [groups, members, userId]);

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
            className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${type === "all" ? "border-primary/50 text-hud-cyan bg-primary/10" : "border-border/70 text-muted-foreground hover:border-accent/40"}`}
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
              className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${!communityId && !groupId ? "border-primary/50 text-hud-cyan bg-primary/10" : "border-border/70 text-muted-foreground hover:border-accent/40 cursor-pointer"}`}
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
                className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${communityId === c.id ? "border-primary/50 text-hud-cyan bg-primary/10" : "border-border/70 text-muted-foreground hover:border-accent/40"}`}
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
                className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${groupId === g.id ? "border-primary/50 text-hud-cyan bg-primary/10" : "border-border/70 text-muted-foreground hover:border-accent/40"}`}
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

        <PostComposer courses={courses} communities={myCommunities} groups={myGroups} onPost={addPost} />

        <ScopeManager
          communities={communities}
          groups={groups}
          members={members}
          courses={courses}
          userId={userId}
          onCreateCommunity={(p) => createScope("community", p)}
          onCreateGroup={(p) => createScope("group", p)}
          onToggleMember={toggleMember}
          onDeleteScope={deleteScope}
        />

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