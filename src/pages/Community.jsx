import { useEffect, useState, useCallback } from "react";

import { useAuth } from "@/lib/AuthContext";
import PageHeader from "@/components/PageHeader";
import PostComposer from "@/components/community/PostComposer";
import PostCard from "@/components/community/PostCard";
import { supabase } from "@/lib/supabase";
import { isLocalWorkspace } from "@/lib/repo/select";
import { createLocalRepo } from "@/lib/repo/localRepo";
import { Users } from "lucide-react";
import { useI18n } from "@/lib/i18n";

const LOCAL = isLocalWorkspace();
const localRepo = LOCAL ? createLocalRepo() : null;

const byDateDesc = (a, b) => String(b.created_at || "").localeCompare(String(a.created_at || ""));

const mapRow = (row, authUser) => row && { ...row, created_by: authUser?.email, created_by_id: authUser?.id, created_date: row.created_at };

export default function Community() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [posts, setPosts] = useState(null);
  const [replies, setReplies] = useState([]);
  const [likes, setLikes] = useState([]);
  const [courses, setCourses] = useState([]);

  const load = useCallback(async () => {
    try {
      if (LOCAL) {
        setPosts(localRepo.list("community_posts").slice().sort(byDateDesc).slice(0, 50).map((row) => mapRow(row, user)));
        setReplies(localRepo.list("community_replies").slice().sort(byDateDesc).slice(0, 250).map((row) => mapRow(row, user)));
        setLikes(localRepo.list("community_likes").map((row) => mapRow(row, user)));
        setCourses(localRepo.list("courses"));
        return;
      }
      const [p, r, l, c] = await Promise.all([
        supabase.from("community_posts").select("*").order("created_at", { ascending: false }).limit(50),
        supabase.from("community_replies").select("*").order("created_at", { ascending: false }).limit(250),
        supabase.from("community_likes").select("*"),
        supabase.from("courses").select("*"),
      ]);
      setPosts((p.data || []).map((row) => mapRow(row, user)));
      setReplies((r.data || []).map((row) => mapRow(row, user)));
      setLikes((l.data || []).map((row) => mapRow(row, user)));
      setCourses(c.data || []);
    } catch {
      setPosts([]);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const addPost = async (payload) => {
    if (LOCAL) {
      localRepo.create("community_posts", payload);
      setPosts(localRepo.list("community_posts").slice().sort(byDateDesc).slice(0, 50).map((row) => mapRow(row, user)));
      return;
    }
    await supabase.from("community_posts").insert(payload);
    const { data } = await supabase.from("community_posts").select("*").order("created_at", { ascending: false }).limit(50);
    setPosts(data.map((row) => mapRow(row, user)));
  };

  const addReply = async (postId, content) => {
    if (LOCAL) {
      localRepo.create("community_replies", { post_id: postId, content });
      setReplies(localRepo.list("community_replies").slice().sort(byDateDesc).slice(0, 250).map((row) => mapRow(row, user)));
      return;
    }
    await supabase.from("community_replies").insert({ post_id: postId, content });
    const { data } = await supabase.from("community_replies").select("*").order("created_at", { ascending: false }).limit(250);
    setReplies(data.map((row) => mapRow(row, user)));
  };

  const toggleLike = async (post) => {
    const mine = likes.find((l) => l.post_id === post.id && l.created_by_id === user?.id);
    try {
      if (mine) {
        if (LOCAL) localRepo.delete("community_likes", mine.id);
        else await supabase.from("community_likes").delete().eq("id", mine.id);
        setLikes((ls) => ls.filter((l) => l.id !== mine.id));
      } else if (LOCAL) {
        const created = localRepo.create("community_likes", { post_id: post.id });
        setLikes((ls) => [...ls, mapRow(created, user)]);
      } else {
        const { data: created } = await supabase.from("community_likes").insert({ post_id: post.id }).select().single();
        setLikes((ls) => [...ls, mapRow(created, user)]);
      }
    } catch { /* optimistic state stays as-is */ }
  };

  const deletePost = async (post) => {
    if (LOCAL) {
      localRepo.delete("community_posts", post.id);
      localRepo.deleteWhere("community_replies", (r) => r.post_id === post.id);
      localRepo.deleteWhere("community_likes", (l) => l.post_id === post.id);
    } else {
      await supabase.from("community_posts").delete().eq("id", post.id);
      try {
        await supabase.from("community_replies").delete().eq("post_id", post.id);
      } catch { /* others' replies are simply orphaned and never rendered */ }
      try {
        await supabase.from("community_likes").delete().eq("post_id", post.id);
      } catch { /* likes are cleaned up best-effort */ }
    }
    setPosts((ps) => ps.filter((p) => p.id !== post.id));
    setReplies((rs) => rs.filter((r) => r.post_id !== post.id));
    setLikes((ls) => ls.filter((l) => l.post_id !== post.id));
  };

  const postIds = new Set((posts || []).map((p) => p.id));

  return (
    <>
      <PageHeader title={t("title.community")} subtitle={t("title.community.subtitle")} />
      <div className="max-w-3xl space-y-4">
        <PostComposer courses={courses} onPost={addPost} />

        {posts === null && [0, 1, 2].map((i) => <div key={i} className="h-28 bg-muted rounded-xl animate-pulse" />)}

        {posts !== null && posts.length === 0 && (
          <div className="text-center py-16 border border-dashed border-border rounded-xl">
            <Users className="w-10 h-10 text-muted-foreground mx-auto" />
            <p className="font-medium mt-3">Nothing here yet</p>
            <p className="text-sm text-muted-foreground mt-1">Be the first to share a question, tip or win.</p>
          </div>
        )}

        {posts !== null && posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            replies={replies.filter((r) => r.post_id === post.id && postIds.has(r.post_id))}
            likes={likes.filter((l) => l.post_id === post.id)}
            userId={user?.id}
            courseName={post.course_id ? courses.find((c) => c.id === post.course_id)?.name : null}
            onToggleLike={toggleLike}
            onReply={addReply}
            onDelete={deletePost}
          />
        ))}
      </div>
    </>
  );
}