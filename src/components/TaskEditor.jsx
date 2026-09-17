import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, X, Check } from "lucide-react";
import { courseColor } from "@/lib/format";
import {
  taskToForm,
  formToTaskPatch,
  validateTaskForm,
  addSubtask,
  removeSubtask,
  toggleSubtask,
  subtaskProgress,
} from "@/lib/taskEdit";

const PRIORITIES = ["low", "medium", "high", "urgent"];
const STATUSES = [
  { value: "todo", label: "To do" },
  { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Completed" },
];

// Task editor. Creates when `task` is null, edits otherwise. Saving always
// returns the validated patch so the caller owns persistence — this component
// never writes directly.
export default function TaskEditor({ open, task = null, courses = [], onSave, onClose }) {
  const [form, setForm] = useState(() => taskToForm(task || {}));
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [newSub, setNewSub] = useState("");

  // Re-seed whenever the target task changes so opening a second task never
  // shows the previous one's values.
  useEffect(() => {
    if (open) {
      setForm(taskToForm(task || {}));
      setError(null);
      setNewSub("");
    }
  }, [open, task]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const progress = subtaskProgress(form.subtasks);

  const submit = async (e) => {
    e.preventDefault();
    const invalid = validateTaskForm(form);
    if (invalid) {
      setError(invalid);
      return;
    }
    setSaving(true);
    try {
      await onSave(formToTaskPatch(form));
      onClose();
    } catch {
      setError("Couldn't save this task. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const commitSubtask = () => {
    if (!newSub.trim()) return;
    set("subtasks", addSubtask(form.subtasks, newSub));
    setNewSub("");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !saving && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{task ? "Edit task" : "New task"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="task-title" className="text-xs">Title</Label>
            <Input
              id="task-title"
              autoFocus
              value={form.title}
              onChange={(e) => { set("title", e.target.value); if (error) setError(null); }}
              placeholder="Finish Algorithms assignment"
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="task-desc" className="text-xs">Notes</Label>
            <textarea
              id="task-desc"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              rows={2}
              placeholder="Anything you'll forget later"
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm resize-y focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Course</Label>
              <Select value={form.course_id || "none"} onValueChange={(v) => set("course_id", v === "none" ? null : v)}>
                <SelectTrigger aria-label="Course"><SelectValue placeholder="No course" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No course</SelectItem>
                  {courses.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="flex items-center gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full ${courseColor(c.color).dot}`} />
                        {c.code ? `${c.code} · ${c.name}` : c.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="task-due" className="text-xs">Due date</Label>
              <Input id="task-due" type="date" value={form.due_date} onChange={(e) => set("due_date", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Priority</Label>
              <Select value={form.priority} onValueChange={(v) => set("priority", v)}>
                <SelectTrigger aria-label="Priority"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Status</Label>
              <Select value={form.status} onValueChange={(v) => set("status", v)}>
                <SelectTrigger aria-label="Status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label htmlFor="task-est" className="text-xs">Estimated time (minutes)</Label>
              <Input
                id="task-est"
                type="number"
                min="0"
                step="5"
                value={form.estimated_duration}
                onChange={(e) => set("estimated_duration", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Subtasks</Label>
              {progress && (
                <span className="text-[11px] text-muted-foreground">{progress.done}/{progress.total} done</span>
              )}
            </div>

            {progress && (
              <div className="h-1 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-primary transition-all duration-200" style={{ width: `${progress.pct}%` }} />
              </div>
            )}

            <div className="space-y-1">
              {(form.subtasks || []).map((s) => (
                <div key={s.id} className="flex items-center gap-2 group">
                  <button
                    type="button"
                    onClick={() => set("subtasks", toggleSubtask(form.subtasks, s.id))}
                    aria-label={s.done ? `Mark ${s.title} as not done` : `Mark ${s.title} as done`}
                    aria-pressed={s.done}
                    className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${s.done ? "bg-emerald-500 border-emerald-500" : "border-border hover:border-primary"}`}
                  >
                    {s.done && <Check className="w-2.5 h-2.5 text-white" />}
                  </button>
                  <span className={`flex-1 text-sm ${s.done ? "line-through text-muted-foreground" : ""}`}>{s.title}</span>
                  <button
                    type="button"
                    onClick={() => set("subtasks", removeSubtask(form.subtasks, s.id))}
                    aria-label={`Remove ${s.title}`}
                    className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 p-1 rounded hover:bg-muted transition-opacity"
                  >
                    <X className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <Input
                value={newSub}
                onChange={(e) => setNewSub(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commitSubtask(); } }}
                placeholder="Add a step…"
                aria-label="New subtask"
              />
              <Button type="button" variant="outline" size="icon" onClick={commitSubtask} aria-label="Add subtask">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : task ? "Save changes" : "Create task"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}