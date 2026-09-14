import { useState } from "react";
import { Heart, MessageCircle, Trash2 } from "lucide-react";
import ReplyThread from "@/components/community/ReplyThread";

const TYPE_META = {
  question: { label: "Question", cls: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20" },
  tip: { label: "Tip", cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  win: { label: "Win", cls: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  resource: { label: "Resource", cls: "bg-violet-500/10 text-violet-400 border-violet-500/20" },
};

const authorName = (email) => {
  const local = (email || "student").split("@")[0];
  return local.charAt(0).toUpperCase() + local.slice(1).replace(/[._-]+/g, " ");
};

const timeAgo = (iso) => {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

export default function PostCard({ post, replies, likes, userId, courseName, onToggleLike, onReply, onDelete }) {
  const [showReplies, setShowReplies] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const type = TYPE_META[post.type] || TYPE_META.question;
  const liked = likes.some((l) => l.created_by_id === userId);
  const mine = post.created_by_id === userId;

  return (
    <article className="surface-card p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-xs font-semibold text-white shrink-0">
          {(post.created_by || "s").charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">{authorName(post.created_by)}</span>
            <span className="text-[10px] text-muted-foreground">{timeAgo(post.created_date)}</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full border ${type.cls}`}>{type.label}</span>
            {courseName && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">{courseName}</span>
            )}
          </div>
          <h3 className="font-medium mt-2 leading-snug">{post.title}</h3>
          <p className="text-sm text-muted-foreground mt-1.5 whitespace-pre-wrap leading-relaxed">{post.content}</p>
          <div className="flex items-center gap-1 mt-3 -ml-1.5">
            <button
              onClick={() => onToggleLike(post)}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs transition-colors hover:bg-muted ${liked ? "text-rose-400" : "text-muted-foreground"}`}
            >
              <Heart className={`w-4 h-4 ${liked ? "fill-current" : ""}`} />
              {likes.length > 0 && likes.length}
            </button>
            <button
              onClick={() => setShowReplies((v) => !v)}
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs text-muted-foreground transition-colors hover:bg-muted"
            >
              <MessageCircle className="w-4 h-4" />
              {replies.length > 0 ? replies.length : "Reply"}
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
          {showReplies && <ReplyThread replies={replies} onSubmit={(content) => onReply(post.id, content)} />}
        </div>
      </div>
    </article>
  );
}