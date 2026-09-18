import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RecordDialog, Field } from "@/components/RecordDialog";
import { courseColor, todayISO } from "@/lib/format";
import { gradeToForm, formToGradePatch, validateGradeForm, GRADE_TYPES } from "@/lib/recordForms";

const TYPE_LABEL = { exam: "Exam", quiz: "Quiz", assignment: "Assignment", project: "Project", participation: "Participation", other: "Other" };

export default function GradeEditor({ open, grade = null, courses = [], exams = [], onSave, onClose }) {
  const isEdit = Boolean(grade?.id);

  return (
    <RecordDialog
      open={open}
      title="Edit grade"
      createTitle="New grade"
      isEdit={isEdit}
      initial={{ ...gradeToForm(grade || {}), date: grade?.date || todayISO() }}
      validate={validateGradeForm}
      onSubmit={(form) => onSave(formToGradePatch(form))}
      onClose={onClose}
      submitLabel={isEdit ? "Save changes" : "Add grade"}
    >
      {({ form, set }) => {
        // Offer only exams from the chosen course — linking a grade to another
        // course's exam would double-count it in both averages.
        const courseExams = exams.filter((e) => e.course_id === form.course_id);
        return (
          <>
            <Field label="Assessment name">
              <Input autoFocus value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Assignment 1" />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Course">
                <Select value={form.course_id || ""} onValueChange={(v) => set("course_id", v)}>
                  <SelectTrigger aria-label="Course"><SelectValue placeholder="Select course" /></SelectTrigger>
                  <SelectContent>
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
              </Field>
              <Field label="Type">
                <Select value={form.type} onValueChange={(v) => set("type", v)}>
                  <SelectTrigger aria-label="Type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {GRADE_TYPES.map((t) => <SelectItem key={t} value={t}>{TYPE_LABEL[t] || t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Grade (0–10)">
                <Input type="number" min="0" max="10" step="0.1" value={form.grade} onChange={(e) => set("grade", e.target.value)} placeholder="7.5" />
              </Field>
              <Field label="Weight %" hint="Share of the final course grade.">
                <Input type="number" min="0" max="100" step="5" value={form.weight} onChange={(e) => set("weight", e.target.value)} placeholder="20" />
              </Field>
              <Field label="Date">
                <Input type="date" value={form.date} onChange={(e) => set("date", e.target.value)} />
              </Field>
              <Field label="Linked exam" hint="Optional — counts this instead of the exam's stored mark.">
                <Select
                  value={form.exam_id || "none"}
                  onValueChange={(v) => set("exam_id", v === "none" ? null : v)}
                  disabled={courseExams.length === 0}
                >
                  <SelectTrigger aria-label="Linked exam"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {courseExams.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}{e.date ? ` · ${e.date}` : ""}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </>
        );
      }}
    </RecordDialog>
  );
}