import { Reveal } from "@/components/motion/Reveal";
import { ILLUSTRATIVE_LABEL } from "@/components/landing/sections";

// Section shell with the shared vertical rhythm: anchor id, constrained
// width, generous spacing. Visual composition stays per-section.
export function SectionFrame({ id, className = "", children }) {
  return (
    <section id={id} className={`relative mx-auto max-w-6xl px-4 sm:px-6 py-24 sm:py-28 ${className}`}>
      {children}
    </section>
  );
}

// Kicker + headline + body block used at the top of each story beat.
/**
 * @param {{ kicker?: string, headline?: string, body?: string, align?: string, className?: string, children?: import("react").ReactNode }} props
 */
export function SectionHeading({ kicker, headline, body, align = "left", className = "", children }) {
  return (
    <Reveal mode="inView" className={`${align === "center" ? "mx-auto text-center" : ""} max-w-2xl ${className}`}>
      <div className="um-label">{kicker}</div>
      <h2 className="mt-3 font-display text-3xl sm:text-4xl font-semibold tracking-tight leading-[1.1]">{headline}</h2>
      {body && <p className="mt-4 text-muted-foreground leading-relaxed">{body}</p>}
      {children}
    </Reveal>
  );
}

// Honest marker for decorative product mockups that show sample values —
// present so the page never implies fake live data.
export function PreviewChip({ className = "" }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md border border-accent/25 bg-accent/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-accent ${className}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-accent" aria-hidden />
      {ILLUSTRATIVE_LABEL}
    </span>
  );
}