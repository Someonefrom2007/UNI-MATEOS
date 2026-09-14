import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageSquarePlus } from "lucide-react";

const TYPES = [
  { value: "question", label: "Question" },
  { value: "tip", label: "Tip" },
  { value: "win", label: "Win" },
  { value: "resource", label: "Resource" },
];

export default function PostComposer({ courses, onPost }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("question");
  const [courseId, setCourseId] = useState("none");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!title.trim() || !content.trim() || busy) return;
    setBusy(true);
    try {
      const payload = { title: title.trim(), content: content.trim(), type };
      if (courseId !== "none") payload.course_id = courseId;
      await onPost(payload);
      setTitle("");
      setContent("");
      setType("question");
      setCourseId("none");
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-3 surface-card p-4 text-left text-muted-foreground hover:border-primary/40 transition-colors"
      >
        <MessageSquarePlus className="w-5 h-5 text-primary" />
        <span className="text-sm">Share a question, tip, win or resource…</span>
      </button>
    );
  }

  return (
    <div className="surface-card p-4 sm:p-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Type</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Course (optional)</Label>
          <Select value={courseId} onValueChange={setCourseId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No course</SelectItem>
              {courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5 mt-3">
        <Label>Title</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="How do you memorize formulas fast?" />
      </div>
      <div className="space-y-1.5 mt-3">
        <Label>What's on your mind?</Label>
        <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={4} placeholder="Give your classmates some context…" />
      </div>
      <div className="flex justify-end gap-2 mt-4">
        <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
        <Button onClick={submit} disabled={busy || !title.trim() || !content.trim()}>
          {busy ? "Posting…" : "Post"}
        </Button>
      </div>
    </div>
  );
}