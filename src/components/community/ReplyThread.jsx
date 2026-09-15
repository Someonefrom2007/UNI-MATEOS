import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authorIdentity, timeAgo } from "@/lib/communityData";

export default function ReplyThread({ replies, onSubmit }) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);

  const send = async () => {
    const v = value.trim();
    if (!v || busy) return;
    setBusy(true);
    try {
      await onSubmit(v);
      setValue("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 space-y-3">
      {[...replies]
        .sort((a, b) => new Date(a.created_date || a.created_at).getTime() - new Date(b.created_date || b.created_at).getTime())
        .map((r) => {
          const id = authorIdentity(r.created_by || r.author_email, r.author_name);
          return (
            <div key={r.id} className="flex gap-3">
              <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${id.gradient} flex items-center justify-center text-[11px] font-semibold text-white shrink-0`}>
                {id.initials}
              </div>
              <div className="flex-1 rounded-xl bg-secondary/50 px-3 py-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-medium">{id.name}</span>
                  <span className="text-[10px] text-muted-foreground">{timeAgo(r.created_date || r.created_at)}</span>
                </div>
                <p className="text-sm mt-0.5 whitespace-pre-wrap">{r.content}</p>
              </div>
            </div>
          );
        })}
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Write a reply…"
          className="bg-background"
        />
        <Button size="sm" onClick={send} disabled={busy || !value.trim()}>
          {busy ? "…" : "Reply"}
        </Button>
      </div>
    </div>
  );
}