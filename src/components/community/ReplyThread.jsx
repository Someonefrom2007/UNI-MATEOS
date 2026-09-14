import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
        .sort((a, b) => new Date(a.created_date).getTime() - new Date(b.created_date).getTime())
        .map((r) => (
          <div key={r.id} className="flex gap-3">
            <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-[11px] font-semibold shrink-0">
              {(r.created_by || "s").charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 rounded-xl bg-secondary/50 px-3 py-2">
              <div className="flex items-baseline gap-2">
                <span className="text-xs font-medium">{authorName(r.created_by)}</span>
                <span className="text-[10px] text-muted-foreground">{timeAgo(r.created_date)}</span>
              </div>
              <p className="text-sm mt-0.5 whitespace-pre-wrap">{r.content}</p>
            </div>
          </div>
        ))}
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