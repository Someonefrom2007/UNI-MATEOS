import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useUserData } from "@/lib/useUserData";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";
import { ArrowLeft, Pin, Trash2 } from "lucide-react";

import { useToast } from "@/components/ui/use-toast";
import ErrorState from "@/components/ErrorState";
import ConfirmDialog from "@/components/ConfirmDialog";

export default function NoteDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, error, mutate, refresh } = useUserData();
  const { toast } = useToast();

  const note = data?.Note.find((n) => n.id === id);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [courseId, setCourseId] = useState("none");
  const [pinned, setPinned] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("Saved");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const saveTimer = useRef(null);

  useEffect(() => {
    if (note) {
      setTitle(note.title);
      setContent(note.content || "");
      setCourseId(note.course_id || "none");
      setPinned(note.pinned);
    }
  }, [note?.id]);

  useEffect(() => {
    if (!note) return;
    if (title === note.title && content === (note.content || "") && courseId === (note.course_id || "none") && pinned === note.pinned) return;
    setStatus("Saving…");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      try {
        const patch = { title, content, course_id: courseId === "none" ? null : courseId, pinned };
        await mutate("Note", "update", id, patch);
        setStatus("Saved");
      } catch {
        setStatus("Save failed");
      } finally {
        setSaving(false);
      }
    }, 900);
    return () => clearTimeout(saveTimer.current);
  }, [title, content, courseId, pinned, note, id]);

  if (error) return <ErrorState onRetry={refresh} />;

  if (!data) return <div className="h-64 bg-muted rounded-xl animate-pulse" />;
  if (!note) return <div className="text-center py-20"><p className="text-muted-foreground">Note not found.</p><Link to="/notes" className="text-primary text-sm">Back to notes</Link></div>;

  const courses = data.Course || [];

  const del = async () => {
    await mutate("Note", "delete", id);
    toast({ title: "Note deleted" });
    navigate("/notes");
  };

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <Link to="/notes" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="w-4 h-4 mr-1.5" />Notes</Link>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{status}</span>
          <button onClick={() => setPinned(!pinned)} aria-label={pinned ? "Unpin note" : "Pin note"} className={`p-2 rounded-lg hover:bg-muted ${pinned ? "text-primary" : "text-muted-foreground"}`}><Pin className="w-4 h-4" /></button>
          <button onClick={() => setConfirmOpen(true)} aria-label="Delete note" className="p-2 rounded-lg hover:bg-muted text-destructive"><Trash2 className="w-4 h-4" /></button>
        </div>
      </div>

      <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Untitled" aria-label="Note title" className="text-2xl font-display font-semibold border-0 px-0 focus-visible:ring-0 h-auto bg-transparent" />

      <div className="w-48">
        <Select value={courseId} onValueChange={setCourseId}>
          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Link to course" /></SelectTrigger>
          <SelectContent><SelectItem value="none">No course</SelectItem>{courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <ReactQuill theme="snow" value={content} onChange={setContent} placeholder="Start writing…" className="um-quill" />
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Delete this note?"
        description="The note and its content will be removed. This can't be undone."
        confirmLabel="Delete note"
        onConfirm={del}
      />

      <style>{`
        .um-quill .ql-toolbar { border: none; border-bottom: 1px solid hsl(var(--border)); background: hsl(var(--muted)/0.3); }
        .um-quill .ql-container { border: none; min-height: 320px; font-family: var(--font-body); }
        .um-quill .ql-editor { min-height: 320px; color: hsl(var(--foreground)); }
        .um-quill .ql-snow .ql-stroke { stroke: hsl(var(--muted-foreground)); }
        .um-quill .ql-snow .ql-fill { fill: hsl(var(--muted-foreground)); }
        .um-quill .ql-snow .ql-picker { color: hsl(var(--muted-foreground)); }
      `}</style>
    </div>
  );
}