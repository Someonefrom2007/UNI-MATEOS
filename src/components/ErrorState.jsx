import { AlertTriangle, RotateCcw } from "lucide-react";

// User-facing error copy (directive §29): what happened / what's preserved /
// what to do, always with an action. Never raw error text.
export default function ErrorState({
  title = "We couldn't load this",
  description = "Something went wrong reading your data. Nothing has been changed — everything you've saved is safe. Try again, or reload the page if it keeps happening.",
  onRetry = null,
  retryLabel = "Try again",
}) {
  return (
    <div role="alert" className="flex flex-col items-center justify-center text-center py-16 px-6 rounded-xl border border-destructive/20 bg-destructive/[0.03]">
      <div className="w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center mb-4">
        <AlertTriangle className="w-6 h-6 text-destructive" />
      </div>
      <h3 className="font-display text-lg font-medium">{title}</h3>
      <p className="text-sm text-muted-foreground mt-1.5 max-w-md">{description}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-5 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border bg-card text-sm font-medium hover:border-accent/40 transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          {retryLabel}
        </button>
      )}
    </div>
  );
}