import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RecordDialog, Field } from "@/components/RecordDialog";
import { courseColor, todayISO } from "@/lib/format";
import {
  attendanceToForm,
  formToAttendancePatch,
  validateAttendanceForm,
  ATTENDANCE_STATUSES,
  ATTENDANCE_META,
} from "@/lib/attendance";

// Attendance is recorded per course session. This editor is deliberately small:
// course, date, status. Anything more would be inventing university rules.
export default function AttendanceEditor({ open, record = null, courses = [], presetCourseId = null, onSave, onClose }) {
  const isEdit = Boolean(record?.id);
  // The course workspace logs against a known course, so that case must not ask
  // the student to re-pick it — and must not silently drop the preset either.
  const lockedCourse = courses.length === 1 ? courses[0] : null;
  const initialCourseId = record?.course_id || lockedCourse?.id || presetCourseId || null;

  return (
    <RecordDialog
      open={open}
      title="Edit session"
      createTitle="Log attendance"
      isEdit={isEdit}
      initial={{ ...attendanceToForm(record || {}), course_id: initialCourseId, date: record?.date || todayISO() }}
      validate={validateAttendanceForm}
      onSubmit={(form) => onSave(formToAttendancePatch(form))}
      onClose={onClose}
      submitLabel={isEdit ? "Save changes" : "Log session"}
    >
      {({ form, set }) => (
        <>
          {lockedCourse ? (
            <div className="space-y-1.5">
              <Label className="text-xs">Course</Label>
              <div className="flex items-center gap-2 h-9 px-3 rounded-md border border-border bg-muted/40 text-sm">
                <span className={`w-1.5 h-1.5 rounded-full ${courseColor(lockedCourse.color).dot}`} />
                {lockedCourse.code ? `${lockedCourse.code} · ${lockedCourse.name}` : lockedCourse.name}
              </div>
            </div>
          ) : (
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
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Date">
              <Input type="date" value={form.date} onChange={(e) => set("date", e.target.value)} />
            </Field>
            <Field label="Status" hint="Excused sessions are left out of the rate.">
              <Select value={form.status} onValueChange={(v) => set("status", v)}>
                <SelectTrigger aria-label="Status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ATTENDANCE_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{ATTENDANCE_META[s].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
        </>
      )}
    </RecordDialog>
  );
}