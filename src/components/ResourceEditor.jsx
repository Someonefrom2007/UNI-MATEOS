import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RecordDialog, Field, TextArea } from "@/components/RecordDialog";
import { courseColor } from "@/lib/format";
import { resourceToForm, formToResourcePatch, validateResourceForm, RESOURCE_TYPES } from "@/lib/recordForms";

const TYPE_LABEL = { link: "Link", pdf: "PDF", doc: "Document", video: "Video", image: "Image", presentation: "Presentation", file: "File" };

export default function ResourceEditor({ open, resource = null, courses = [], onSave, onClose }) {
  const isEdit = Boolean(resource?.id);

  return (
    <RecordDialog
      open={open}
      title="Edit resource"
      createTitle="New resource"
      isEdit={isEdit}
      initial={resourceToForm(resource || {})}
      validate={validateResourceForm}
      onSubmit={(form) => onSave(formToResourcePatch(form))}
      onClose={onClose}
      submitLabel={isEdit ? "Save changes" : "Add resource"}
    >
      {({ form, set }) => (
        <>
          <Field label="Name">
            <Input autoFocus value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Lecture slides — week 3" />
          </Field>

          <Field label="URL" hint="Optional for files you already have; must start with http:// or https://.">
            <Input type="url" value={form.url} onChange={(e) => set("url", e.target.value)} placeholder="https://…" />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Type">
              <Select value={form.type} onValueChange={(v) => set("type", v)}>
                <SelectTrigger aria-label="Type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RESOURCE_TYPES.map((t) => <SelectItem key={t} value={t}>{TYPE_LABEL[t] || t}</SelectItem>)}
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

          <Field label="Description">
            <TextArea value={form.description} onChange={(v) => set("description", v)} placeholder="What this is and why you saved it" />
          </Field>
        </>
      )}
    </RecordDialog>
  );
}