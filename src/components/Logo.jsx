// UNI·MATE brand mark — three translucent diamond layers, stacked.
export default function Logo({ size = 34, showText = true, subtext = true, className = "" }) {
  return (
    <span className={`inline-flex items-center ${showText ? "gap-2.5" : ""} ${className}`}>
      <svg width={size} height={size * 1.25} viewBox="0 0 32 40" fill="none" className="shrink-0" aria-hidden>
        <polygon points="16,1 30.5,9.8 16,18.6 1.5,9.8" fill="#22D3EE" fillOpacity="0.9" />
        <polygon points="16,11.5 30.5,20.3 16,29.1 1.5,20.3" fill="#3B82F6" fillOpacity="0.85" />
        <polygon points="16,22 30.5,30.8 16,39.6 1.5,30.8" fill="#6366F1" />
      </svg>
      {showText && (
        <span className="leading-none">
          <span className="font-display font-semibold tracking-tight" style={{ fontSize: Math.max(14, Math.round(size * 0.45)) }}>
            UNI·MATE
          </span>
          {subtext && (
            <span className="block text-[10px] uppercase tracking-[0.2em] text-muted-foreground mt-1">Academic OS</span>
          )}
        </span>
      )}
    </span>
  );
}