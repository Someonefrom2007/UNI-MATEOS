import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

// One confirmation surface for destructive actions. Explains consequences
// before the user commits, never after. Callers that can offer a safer route
// (archive, keep-linked-work) pass extra choices instead of building their own
// dialog, so destructive flows look and read the same everywhere.
export default function ConfirmDialog({
  open,
  onClose,
  title,
  description = null,
  details = null,
  confirmLabel = "Delete",
  onConfirm,
  tone = "danger",
  alternatives = [],
  busy = false,
}) {
  const [pending, setPending] = useState(null);

  const run = async (choice) => {
    setPending(choice?.key ?? "confirm");
    try {
      await onConfirm(choice);
    } finally {
      setPending(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !pending && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className={`w-4 h-4 ${tone === "danger" ? "text-hud-rose" : "text-hud-amber"}`} />
            {title}
          </DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        {details && <div className="text-sm text-muted-foreground">{details}</div>}

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose} disabled={Boolean(pending)}>Cancel</Button>
          {alternatives.map((alt) => (
            <Button
              key={alt.key}
              variant={alt.variant || "outline"}
              onClick={() => run(alt)}
              disabled={busy || Boolean(pending)}
            >
              {pending === alt.key ? "Working…" : alt.label}
            </Button>
          ))}
          <Button
            variant={tone === "danger" ? "destructive" : "default"}
            onClick={() => run(null)}
            disabled={busy || Boolean(pending)}
          >
            {pending === "confirm" ? "Working…" : confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
