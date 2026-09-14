import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckSquare, BookOpen, GraduationCap, CalendarDays, FileText, Target, Repeat, Award, Link2 } from "lucide-react";

import { todayISO } from "@/lib/format";
import { useToast } from "@/components/ui/use-toast";

const OPTIONS = [
  { key: "task", label: "Task", icon: CheckSquare, color: "text-cyan-400" },
  { key: "course", label: "Course", icon: BookOpen, color: "text-amber-400" },
  { key: "exam", label: "Exam", icon: GraduationCap, color: "text-rose-400" },
  { key: "event", label: "Event", icon: CalendarDays, color: "text-violet-400" },
  { key: "note", label: "Note", icon: FileText, color: "text-emerald-400" },
  { key: "goal", label: "Goal", icon: Target, color: "text-primary" },
  { key: "habit", label: "Habit", icon: Repeat, color: "text-blue-400" },
  { key: "grade", label: "Grade", icon: Award, color: "text-emerald-400" },
  { key: "resource", label: "Resource", icon: Link2, color: "text-sky-400" },
];

export default function QuickAdd({ open, onClose, preset = null }) {
  const [type, setType] = useState(null);
  const [courses, setCourses] = useState([]);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (open) {
      (async () => {
        const { data, error } = await supabase.from("courses").select("*").order("name");
        if (!error) setCourses(data || []);
      })();
      if (preset) {
        const opt = OPTIONS.find((o) => o.key === preset.typeKey);
        if (opt) setType(opt);
      }
    }
    if (!open) setType(null);
  }, [open, preset]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{type ? `New ${type.label}` : "Quick Add"}</DialogTitle>
        </DialogHeader>
        {!type ? (
          <div className="grid grid-cols-3 gap-2 py-2">
            {OPTIONS.map((opt) => {
              const Icon = opt.icon;
              return (
                <button
                  key={opt.key}
                  onClick={() => setType(opt)}
                  className="flex flex-col items-center gap-2 p-3 rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-accent/5 transition-colors"
                >
                  <Icon className={`w-5 h-5 ${opt.color}`} />
                  <span className="text-xs font-medium">{opt.label}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <QuickAddForm
            key={`${type.key}-${preset?.courseId || ""}`}
            type={type}
            courses={courses}
            presetCourseId={preset?.courseId || null}
            onDone={(msg, path) => {
              toast({ title: msg });
              onClose();
              if (path) navigate(path);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function QuickAddForm({ type, courses, presetCourseId = null, onDone }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(/** @type {Record<string, any>} */ ({ course_id: presetCourseId || null }));

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (type.key === "task") {
        await supabase.from("tasks").insert({
          title: form.title,
          course_id: form.course_id || null,
          due_date: form.due_date || null,
          priority: form.priority || "medium",
          estimated_duration: Number(form.estimated_duration) || 0,
          status: "todo",
        });
        onDone("Task created", "/tasks");
      } else if (type.key === "course") {
        await supabase.from("courses").insert({
          name: form.name,
          code: form.code || "",
          professor: form.professor || "",
          ects: Number(form.ects) || 0,
          target_grade: Number(form.target_grade) || 7,
          color: form.color || "amber",
          semester: "1",
          academic_year: "2025/26",
          archived: false,
        });
        onDone("Course added", "/courses");
      } else if (type.key === "exam") {
        await supabase.from("exams").insert({
          name: form.name,
          course_id: form.course_id,
          date: form.date,
          weight: Number(form.weight) || 0,
          type: form.type || "exam",
          status: "upcoming",
          topics: [],
        });
        onDone("Exam added", "/exams");
      } else if (type.key === "event") {
        await supabase.from("schedule_events").insert({
          title: form.title,
          type: form.eventType || "personal",
          date: form.date || todayISO(),
          start_time: form.start_time,
          end_time: form.end_time,
          room: form.room || "",
          recurring: false,
        });
        onDone("Event added", "/schedule");
      } else if (type.key === "note") {
        await supabase.from("notes").insert({
          title: form.title,
          content: "",
          course_id: form.course_id || null,
          pinned: false,
          archived: false,
        });
        onDone("Note created", "/notes");
      } else if (type.key === "goal") {
        await supabase.from("goals").insert({
          name: form.name,
          category: form.category || "academic",
          target: Number(form.target) || 0,
          current: 0,
          deadline: form.deadline || null,
          completed: false,
        });
        onDone("Goal created", "/goals");
      } else if (type.key === "habit") {
        await supabase.from("habits").insert({
          name: form.name,
          frequency: "daily",
          target_per_week: 7,
          archived: false,
        });
        onDone("Habit created", "/habits");
      } else if (type.key === "grade") {
        await supabase.from("grades").insert({
          name: form.name,
          course_id: form.course_id,
          grade: Number(form.grade),
          weight: Number(form.weight) || 0,
          date: form.date || todayISO(),
          type: form.type || "assignment",
        });
        onDone("Grade added", "/grades");
      } else if (type.key === "resource") {
        await supabase.from("resources").insert({
          name: form.name,
          type: form.type || "link",
          url: form.url || "",
          course_id: form.course_id || null,
        });
        onDone("Resource added", "/resources");
      }
    } catch (err) {
      onDone("Couldn't save. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      {type.key === "task" && (
        <>
          <Field label="Title"><Input autoFocus required value={form.title || ""} onChange={(e) => set("title", e.target.value)} placeholder="Finish Algorithms assignment" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Due"><Input type="date" value={form.due_date || ""} onChange={(e) => set("due_date", e.target.value)} /></Field>
            <Field label="Course">
              <Select value={form.course_id || "none"} onValueChange={(v) => set("course_id", v === "none" ? null : v)}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent><SelectItem value="none">—</SelectItem>{courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Priority">
              <Select value={form.priority || "medium"} onValueChange={(v) => set("priority", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["low", "medium", "high", "urgent"].map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Est. minutes"><Input type="number" value={form.estimated_duration || ""} onChange={(e) => set("estimated_duration", e.target.value)} placeholder="45" /></Field>
          </div>
        </>
      )}
      {type.key === "course" && (
        <>
          <Field label="Course name"><Input autoFocus required value={form.name || ""} onChange={(e) => set("name", e.target.value)} placeholder="Algorithms & Data Structures" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Code"><Input value={form.code || ""} onChange={(e) => set("code", e.target.value)} placeholder="CS201" /></Field>
            <Field label="Professor"><Input value={form.professor || ""} onChange={(e) => set("professor", e.target.value)} placeholder="Dr. Rivera" /></Field>
            <Field label="ECTS"><Input type="number" value={form.ects || ""} onChange={(e) => set("ects", e.target.value)} placeholder="6" /></Field>
            <Field label="Target grade"><Input type="number" step="0.1" max="10" value={form.target_grade || ""} onChange={(e) => set("target_grade", e.target.value)} placeholder="8.0" /></Field>
          </div>
          <Field label="Accent">
            <Select value={form.color || "amber"} onValueChange={(v) => set("color", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{["amber", "cyan", "purple", "green", "rose", "blue"].map((c) => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
        </>
      )}
      {type.key === "exam" && (
        <>
          <Field label="Exam name"><Input autoFocus required value={form.name || ""} onChange={(e) => set("name", e.target.value)} placeholder="Midterm" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Course">
              <Select required value={form.course_id || ""} onValueChange={(v) => set("course_id", v)}>
                <SelectTrigger><SelectValue placeholder="Select course" /></SelectTrigger>
                <SelectContent>{courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Date"><Input type="date" required value={form.date || ""} onChange={(e) => set("date", e.target.value)} /></Field>
            <Field label="Weight %"><Input type="number" max="100" value={form.weight || ""} onChange={(e) => set("weight", e.target.value)} placeholder="30" /></Field>
            <Field label="Type">
              <Select value={form.type || "exam"} onValueChange={(v) => set("type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["exam", "quiz", "midterm", "final", "assignment", "project", "lab", "oral", "presentation", "other"].map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
          </div>
        </>
      )}
      {type.key === "event" && (
        <>
          <Field label="Title"><Input autoFocus required value={form.title || ""} onChange={(e) => set("title", e.target.value)} placeholder="Study session" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date"><Input type="date" required value={form.date || todayISO()} onChange={(e) => set("date", e.target.value)} /></Field>
            <Field label="Type">
              <Select value={form.eventType || "personal"} onValueChange={(v) => set("eventType", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["class", "exam", "task", "study", "personal", "deadline"].map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Start"><Input type="time" value={form.start_time || ""} onChange={(e) => set("start_time", e.target.value)} /></Field>
            <Field label="End"><Input type="time" value={form.end_time || ""} onChange={(e) => set("end_time", e.target.value)} /></Field>
          </div>
          <Field label="Location"><Input value={form.room || ""} onChange={(e) => set("room", e.target.value)} placeholder="Library" /></Field>
        </>
      )}
      {type.key === "note" && (
        <>
          <Field label="Title"><Input autoFocus required value={form.title || ""} onChange={(e) => set("title", e.target.value)} placeholder="Binary Trees" /></Field>
          <Field label="Course">
            <Select value={form.course_id || "none"} onValueChange={(v) => set("course_id", v === "none" ? null : v)}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent><SelectItem value="none">—</SelectItem>{courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
        </>
      )}
      {type.key === "goal" && (
        <>
          <Field label="Goal"><Input autoFocus required value={form.name || ""} onChange={(e) => set("name", e.target.value)} placeholder="Finish semester with 8.0 GPA" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category">
              <Select value={form.category || "academic"} onValueChange={(v) => set("category", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["academic", "productivity", "study", "personal"].map((c) => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Target"><Input type="number" step="0.1" value={form.target || ""} onChange={(e) => set("target", e.target.value)} placeholder="8.0" /></Field>
          </div>
          <Field label="Deadline"><Input type="date" value={form.deadline || ""} onChange={(e) => set("deadline", e.target.value)} /></Field>
        </>
      )}
      {type.key === "habit" && (
        <Field label="Habit name"><Input autoFocus required value={form.name || ""} onChange={(e) => set("name", e.target.value)} placeholder="Study 1 hour" /></Field>
      )}
      {type.key === "grade" && (
        <>
          <Field label="Assessment name"><Input autoFocus required value={form.name || ""} onChange={(e) => set("name", e.target.value)} placeholder="Assignment 1" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Course">
              <Select required value={form.course_id || ""} onValueChange={(v) => set("course_id", v)}>
                <SelectTrigger><SelectValue placeholder="Select course" /></SelectTrigger>
                <SelectContent>{courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Grade (0–10)"><Input type="number" min="0" max="10" step="0.1" required value={form.grade ?? ""} onChange={(e) => set("grade", e.target.value)} placeholder="7.5" /></Field>
            <Field label="Weight %"><Input type="number" max="100" value={form.weight || ""} onChange={(e) => set("weight", e.target.value)} placeholder="20" /></Field>
            <Field label="Date"><Input type="date" value={form.date || ""} onChange={(e) => set("date", e.target.value)} /></Field>
          </div>
        </>
      )}
      {type.key === "resource" && (
        <>
          <Field label="Name"><Input autoFocus required value={form.name || ""} onChange={(e) => set("name", e.target.value)} placeholder="Lecture slides" /></Field>
          <Field label="URL"><Input type="url" value={form.url || ""} onChange={(e) => set("url", e.target.value)} placeholder="https://…" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type">
              <Select value={form.type || "link"} onValueChange={(v) => set("type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["link", "pdf", "doc", "video", "image", "presentation", "file"].map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Course">
              <Select value={form.course_id || "none"} onValueChange={(v) => set("course_id", v === "none" ? null : v)}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent><SelectItem value="none">—</SelectItem>{courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
          </div>
        </>
      )}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" disabled={saving}>{saving ? "Saving…" : `Create ${type.label}`}</Button>
      </div>
    </form>
  );
}