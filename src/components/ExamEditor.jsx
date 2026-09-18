import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RecordDialog, Field, TextArea } from "@/components/RecordDialog";
import { courseColor } from "@/lib/format";
import { examToForm, formToExamPatch, validateExamForm, EXAM_TYPES } from "@/lib/recordForms";

const TYPE_LABEL = { exam: "Exam", quiz: "Quiz", midterm: "Midterm", final: "Final", assignment: "Assignment", presentation: "Presentation", project: "Project", lab: "Lab", oral: "Oral", other: "Other" };

export default function ExamEditor({ open, exam = null, courses = [], onSave, onClose }) {
  const isEdit = Boolean(exam?.id);

  return (
    <RecordDialog
      open={open}
      title="Edit exam"
      createTitle="New exam"
      isEdit={isEdit}
      initial={examToForm(exam || {})}
      validate={validateExamForm}
      onSubmit={(form) => onSave(formToExamPatch(form))}
      onClose={onClose}
      submitLabel={isEdit ? "Save changes" : "Add exam"}
    >
      {({ form, set }) => (
        <>
          <Field label="Exam name">
            <Input autoFocus value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Midterm" />
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
                  {EXAM_TYPES.map((t) => <SelectItem key={t} value={t}>{TYPE_LABEL[t] || t}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Date">
              <Input type="date" value={form.date} onChange={(e) => set("date", e.target.value)} />
            </Field>
            <Field label="Time">
              <Input type="time" value={form.time} onChange={(e) => set("time", e.target.value)} />
            </Field>
            <Field label="Weight %" hint="Share of the final course grade.">
              <Input type="number" min="0" max="100" step="5" value={form.weight} onChange={(e) => set("weight", e.target.value)} placeholder="30" />
            </Field>
            <Field label="Location">
              <Input value={form.location} onChange={(e) => set("location", e.target.value)} placeholder="Hall B" />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Status">
              <Select value={form.status} onValueChange={(v) => set("status", v)}>
                <SelectTrigger aria-label="Status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="upcoming">Upcoming</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Grade (0–10)" hint="Leave empty until it's marked.">
              <Input type="number" min="0" max="10" step="0.1" value={form.grade} onChange={(e) => set("grade", e.target.value)} placeholder="7.5" />
            </Field>
          </div>

          <Field label="Notes">
            <TextArea value={form.notes} onChange={(v) => set("notes", v)} placeholder="Allowed materials, format, anything to remember" />
          </Field>
        </>
      )}
    </RecordDialog>
  );
}