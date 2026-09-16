import { useState } from "react";
import { Heart, MessageCircle, Trash2, Bookmark, Flag } from "lucide-react";
import ReplyThread from "@/components/community/ReplyThread";
import { contentType, moderationMeta, reportReasons, timeAgo } from "@/lib/communityData";

export default function PostCard({ post, replies, likes, userId, courseName, onToggleLike, onReply, onDelete, onToggleSave, onReport, reportOpen }) {
  const [showReplies, setShowReplies] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const type = contentType(post.type);
  const status = moderationMeta(post.status);
  const liked = post.liked;
  const saved = post.saved;
  const mine = post.mine;

  return (
    <article className="surface-card p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${post.authorGradient} flex items-center justify-center text-xs font-semibold text-white shrink-0`}>
          {post.authorInitials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">{post.authorName}</span>
            <span className="text-[10px] text-muted-foreground">{timeAgo(post.created_date || post.created_at)}</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full border ${type.cls}`}>{type.label}</span>
            {post.status && post.status !== "active" && (
              <span className={`text-[10px] px-2 py-0.5 rounded-full border ${status.cls}`}>{status.label}</span>
            )}
            {courseName && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">{courseName}</span>
            )}
            {post.groupName && (
              <span className={`text-[10px] px-2 py-0.5 rounded-full bg-gradient-to-r ${post.groupGradient} text-white`}>{post.groupName}</span>
            )}
            {post.communityName && !post.groupName && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">{post.communityName}</span>
            )}
          </div>
          <h3 className="font-medium mt-2 leading-snug">{post.title}</h3>
          <p className="text-sm text-muted-foreground mt-1.5 whitespace-pre-wrap leading-relaxed">{post.content}</p>
          <div className="flex items-center gap-1 mt-3 -ml-1.5">
            <button
              onClick={() => onToggleLike(post)}
              aria-label={liked ? "Remove like" : "Like post"}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs transition-colors hover:bg-muted ${liked ? "text-hud-rose" : "text-muted-foreground"}`}
            >
              <Heart className={`w-4 h-4 ${liked ? "fill-current" : ""}`} />
              {post.like_count > 0 && post.like_count}
            </button>
            <button
              onClick={() => setShowReplies((v) => !v)}
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs text-muted-foreground transition-colors hover:bg-muted"
            >
              <MessageCircle className="w-4 h-4" />
              {post.reply_count > 0 ? post.reply_count : "Reply"}
            </button>
            <button
              onClick={() => onToggleSave(post)}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs transition-colors hover:bg-muted ${saved ? "text-hud-cyan" : "text-muted-foreground"}`}
              title={saved ? "Remove from saved" : "Save for later"}
            >
              <Bookmark className={`w-4 h-4 ${saved ? "fill-current" : ""}`} />
              {saved ? "Saved" : "Save"}
            </button>
            <button
              onClick={() => onReport(post)}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs transition-colors hover:bg-muted ${reportOpen ? "text-hud-amber" : "text-muted-foreground"}`}
              title="Report to moderators"
            >
              <Flag className="w-4 h-4" />
              Report
            </button>
            {mine && (
              <button
                onClick={() => (confirming ? onDelete(post) : setConfirming(true))}
                onBlur={() => setConfirming(false)}
                className={`ml-auto flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs transition-colors ${confirming ? "text-destructive font-medium" : "text-muted-foreground hover:bg-muted"}`}
              >
                <Trash2 className="w-4 h-4" />
                {confirming ? "Delete?" : ""}
              </button>
            )}
          </div>
          {reportOpen && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-muted-foreground">Why is this a problem?</span>
              {reportReasons.map((r) => (
                <button
                  key={r}
                  onClick={() => onReport(post, r)}
                  className="px-2.5 py-1 rounded-lg border border-border/70 text-muted-foreground hover:border-hud-amber/40 hover:text-hud-amber transition-colors capitalize"
                >
                  {r}
                </button>
              ))}
            </div>
          )}
          {showReplies && <ReplyThread replies={replies} onSubmit={(content) => onReply(post.id, content)} />}
        </div>
      </div>
    </article>
  );
}