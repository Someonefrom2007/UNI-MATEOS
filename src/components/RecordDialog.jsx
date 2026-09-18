import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

// Small shared form primitives for record editors. They exist so exam, grade,
// resource and event editors stay visually identical without copy-pasting the
// same label/spacing markup into four files.

export function Field({ label, hint = null, children, className = "" }) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <Label className="text-xs">{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

export const inputCls =
  "w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

export function TextArea({ value, onChange, ...rest }) {
  return (
    <textarea
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      rows={2}
      className={`${inputCls} resize-y`}
      {...rest}
    />
  );
}

// Generic create/edit dialog. Fields are render props so each entity keeps its
// own inputs while sharing dialog chrome, validation display and submit
// behavior. `onSubmit` receives the raw form object and owns persistence.
export function RecordDialog({
  open,
  title,
  createTitle = null,
  isEdit = false,
  initial,
  validate = null,
  onSubmit,
  onClose,
  submitLabel = null,
  children,
  wide = false,
}) {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(initial);
      setError(null);
    }
    // `initial` is rebuilt by the caller per open; keying on `open` avoids
    // resetting mid-typing if the caller re-renders with a new object identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    const invalid = validate ? validate(form) : null;
    if (invalid) {
      setError(invalid);
      return;
    }
    setSaving(true);
    try {
      await onSubmit(form);
      onClose();
    } catch {
      setError("Couldn't save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !saving && onClose()}>
      <DialogContent className={`${wide ? "sm:max-w-2xl" : "sm:max-w-lg"} max-h-[90vh] overflow-y-auto`}>
        <DialogHeader>
          <DialogTitle>{isEdit ? title : createTitle || title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {children({ form, set, error })}
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : submitLabel || (isEdit ? "Save changes" : "Create")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}