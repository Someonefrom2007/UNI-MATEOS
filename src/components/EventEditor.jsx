import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RecordDialog, Field } from "@/components/RecordDialog";
import { courseColor, todayISO } from "@/lib/format";
import { eventToForm, formToEventPatch, validateEventForm, EVENT_TYPES, WEEKDAYS } from "@/lib/recordForms";

const TYPE_LABEL = { class: "Class", exam: "Exam", task: "Task", study: "Study", personal: "Personal", deadline: "Deadline" };

export default function EventEditor({ open, event = null, courses = [], onSave, onClose }) {
  const isEdit = Boolean(event?.id);

  return (
    <RecordDialog
      open={open}
      title="Edit event"
      createTitle="New event"
      isEdit={isEdit}
      initial={eventToForm(event || {})}
      validate={validateEventForm}
      onSubmit={(form) => onSave(formToEventPatch(form))}
      onClose={onClose}
      submitLabel={isEdit ? "Save changes" : "Add event"}
    >
      {({ form, set }) => (
        <>
          <Field label="Title">
            <Input autoFocus value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Algorithms — Lecture" />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Type">
              <Select value={form.type} onValueChange={(v) => set("type", v)}>
                <SelectTrigger aria-label="Type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map((t) => <SelectItem key={t} value={t}>{TYPE_LABEL[t] || t}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Course">
              <Select value={form.course_id || "none"} onValueChange={(v) => set("course_id", v === "none" ? null : v)}>
                <SelectTrigger aria-label="Course"><SelectValue placeholder="—" /></SelectTrigger>
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
            </Field>
          </div>

          <Field label="Repeats weekly">
            <Select value={form.recurring ? "yes" : "no"} onValueChange={(v) => set("recurring", v === "yes")}>
              <SelectTrigger aria-label="Repeats weekly"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="no">One-off event</SelectItem>
                <SelectItem value="yes">Repeats every week</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          {form.recurring ? (
            <Field label="Weekday" hint="Weekly classes appear on every matching day of the timetable.">
              <Select value={String(form.day_of_week)} onValueChange={(v) => set("day_of_week", Number(v))}>
                <SelectTrigger aria-label="Weekday"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {WEEKDAYS.map((d) => <SelectItem key={d.value} value={String(d.value)}>{d.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          ) : (
            <Field label="Date">
              <Input type="date" value={form.date || todayISO()} onChange={(e) => set("date", e.target.value)} />
            </Field>
          )}

          <div className="grid grid-cols-3 gap-3">
            <Field label="Start">
              <Input type="time" value={form.start_time} onChange={(e) => set("start_time", e.target.value)} />
            </Field>
            <Field label="End">
              <Input type="time" value={form.end_time} onChange={(e) => set("end_time", e.target.value)} />
            </Field>
            <Field label="Room">
              <Input value={form.room} onChange={(e) => set("room", e.target.value)} placeholder="A-101" />
            </Field>
          </div>
        </>
      )}
    </RecordDialog>
  );
}