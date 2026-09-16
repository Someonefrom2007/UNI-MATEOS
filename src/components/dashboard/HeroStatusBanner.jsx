import { Clock, AlertTriangle, Activity, CheckCircle2 } from "lucide-react";

const VARIANTS = {
  upcoming: { icon: Clock, text: "text-hud-cyan", chip: "chip-hud-cyan", dot: "bg-hud-cyan" },
  attention: { icon: AlertTriangle, text: "text-hud-amber", chip: "chip-hud-amber", dot: "bg-hud-amber" },
  steady: { icon: Activity, text: "text-hud-emerald", chip: "chip-hud-emerald", dot: "bg-hud-emerald" },
  clear: { icon: CheckCircle2, text: "text-muted-foreground", chip: "border-border bg-muted/30", dot: "bg-muted-foreground/50" },
};

// Layered dark-void status bar (#07080D + hairline highlight, no scanlines):
// one contextual line that answers "what is happening right now?" at a glance.
export default function HeroStatusBanner({ banner }) {
  const meta = VARIANTS[banner?.variant] || VARIANTS.clear;
  const Icon = meta.icon;
  return (
    <div
      aria-live="polite"
      className="relative overflow-hidden rounded-2xl void-surface"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-foreground/[0.03] via-transparent to-transparent" aria-hidden />
      <div className="relative flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 px-5 py-4">
        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border self-start sm:self-auto ${meta.chip}`}>
          <Icon className={`w-4 h-4 ${meta.text}`} />
          <span className={`text-xs font-semibold ${meta.text}`}>Live</span>
        </div>
        <div className="min-w-0">
          <p className="font-display text-sm sm:text-base font-semibold tracking-tight truncate">{banner?.title || "All clear for today"}</p>
          {banner?.detail && <p className="text-xs text-muted-foreground truncate mt-0.5">{banner.detail}</p>}
        </div>
        <span className={`hidden sm:block w-1.5 h-1.5 rounded-full ml-auto shrink-0 ${meta.dot}`} aria-hidden />
      </div>
    </div>
  );
}