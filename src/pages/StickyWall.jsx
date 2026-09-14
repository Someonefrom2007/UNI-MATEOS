import { useMemo, useState } from "react";
import { useUserData } from "@/lib/useUserData";
import PageHeader from "@/components/PageHeader";
import StickyNoteCard from "@/components/stickies/StickyNoteCard";
import { COLOR_KEYS, STICKY_DOT, randomRotation } from "@/components/stickies/stickyColors";
import { Plus, StickyNote as StickyNoteIcon } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export default function StickyWall() {
  const { data, loading, mutate } = useUserData();
  const { t } = useI18n();
  const [draft, setDraft] = useState("");
  const [color, setColor] = useState("amber");
  const [saving, setSaving] = useState(false);

  const notes = useMemo(() => {
    const list = data?.StickyNote || [];
    return [...list].sort((a, b) => (b.pinned - a.pinned) || (new Date(b.created_date).getTime() - new Date(a.created_date).getTime()));
  }, [data]);

  const addNote = async () => {
    const content = draft.trim();
    if (!content) return;
    setSaving(true);
    try {
      await mutate("StickyNote", "create", { content, color, pinned: false, rotation: randomRotation() });
      setDraft("");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader title={t("title.stickies")} subtitle={t("title.stickies.subtitle")} />

      {/* Composer */}
      <div className="relative rounded-xl border border-border bg-card/60 backdrop-blur-md p-4 mb-6 overflow-hidden">
        <div className="pointer-events-none absolute inset-0 cyber-grid opacity-40" />
        <div className="relative">
          <div className="hud-mono text-muted-foreground/70 mb-1">Memo input — <span className="text-cyan-400">cmd / ctrl + enter</span> to stick</div>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") addNote(); }}
            rows={2}
            placeholder="What's on your mind? (click a note to edit it later)"
            className="w-full bg-transparent resize-none outline-none font-sticky text-2xl placeholder:opacity-40"
          />
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-2">
              {COLOR_KEYS.map((k) => (
                <button
                  key={k}
                  onClick={() => setColor(k)}
                  title={k}
                  className={`w-5 h-5 rounded-full transition-transform hover:scale-110 ${STICKY_DOT[k]} ${color === k ? "ring-2 ring-ring ring-offset-2 ring-offset-card" : ""}`}
                />
              ))}
            </div>
            <button
              onClick={addNote}
              disabled={!draft.trim() || saving}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-40"
            >
              <Plus className="w-4 h-4" /> {saving ? "Sticking…" : "Stick it"}
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4">
          {[0, 1, 2, 3].map((i) => <div key={i} className="mb-4 break-inside-avoid h-32 rounded-lg bg-muted animate-pulse" />)}
        </div>
      ) : notes.length === 0 ? (
        <div className="relative flex flex-col items-center justify-center text-center py-16 rounded-xl border border-dashed border-border overflow-hidden">
          <div className="absolute inset-0 cyber-scanlines opacity-30" />
          <div className="relative">
            <StickyNoteIcon className="w-8 h-8 text-muted-foreground mb-3" />
            <p className="font-sticky text-2xl">nothing stuck yet…</p>
            <p className="text-sm text-muted-foreground mt-1">First thought goes up there ↑</p>
          </div>
        </div>
      ) : (
        <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4">
          {notes.map((n) => (
            <StickyNoteCard
              key={n.id}
              note={n}
              onSave={(note, content) => mutate("StickyNote", "update", note.id, { content })}
              onColor={(note, c) => mutate("StickyNote", "update", note.id, { color: c })}
              onTogglePin={(note) => mutate("StickyNote", "update", note.id, { pinned: !note.pinned })}
              onDelete={(id) => mutate("StickyNote", "delete", id)}
            />
          ))}
        </div>
      )}
    </>
  );
}