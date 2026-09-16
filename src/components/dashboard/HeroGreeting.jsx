import { greeting, longDate, fmtGrade } from "@/lib/format";
import { Reveal } from "@/components/motion/Reveal";

function Vital({ label, value, hint }) {
  return (
    <div className="min-w-0">
      <div className="um-label">{label}</div>
      <div className="font-display text-lg font-semibold mt-0.5 truncate">{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

// The establishing shot — a layered dark-void hero: who you are, when it is,
// and where you stand. Subtle hairlines and low-opacity white layers only.
export default function HeroGreeting({ user, gpa, ects, streak }) {
  const name = user?.full_name?.trim().split(/\s+/)[0] || user?.email?.split("@")[0] || "there";
  return (
    <Reveal>
      <div className="relative overflow-hidden rounded-2xl void-surface p-6 sm:p-8">
        <div className="absolute inset-0 bg-gradient-to-br from-foreground/[0.03] via-transparent to-transparent" aria-hidden />
        <div
          className="pointer-events-none absolute -bottom-16 right-1/4 w-96 h-48 rounded-full bg-foreground/[0.03] blur-[90px]"
          aria-hidden
        />
        {/* faint skyline silhouette along the bottom edge */}
        <svg
          className="absolute bottom-0 inset-x-0 w-full h-20 text-muted-foreground/20 pointer-events-none"
          viewBox="0 0 800 80"
          preserveAspectRatio="none"
          fill="currentColor"
          aria-hidden
        >
          <path d="M0 80 L0 52 h40 v-12 h20 v14 h30 v-24 h15 v-8 h15 v22 h45 v16 h35 v-24 h20 v12 h40 v-22 h25 v29 h35 v-13 h45 v20 h35 v-28 h25 v16 h45 v12 h35 v-18 h25 v14 h45 v-8 h30 v12 h45 v-14 h25 v20 h40 v-16 h35 v12 h40 v16 Z" />
        </svg>
        <div className="relative flex items-center gap-2 flex-wrap mb-4">
          <span className="cyber-tag"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />Online</span>
          <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">uni·mate // semester console</span>
        </div>
        <div className="relative flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl sm:text-5xl font-semibold tracking-tight leading-tight">
              {greeting()}, <span className="text-primary">{name}.</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-1.5">{longDate()} · your university, organized around you.</p>
          </div>
          <div className="flex items-center gap-6 sm:gap-8 pb-1">
            <Vital label="Grade average" value={gpa !== null && gpa !== undefined ? fmtGrade(gpa) : "—"} hint={gpa !== null && gpa !== undefined ? "out of 10" : "no grades yet"} />
            <Vital label="ECTS" value={ects} hint="this semester" />
            <Vital label="Focus streak" value={`${streak}d`} hint="keep it alive" />
          </div>
        </div>
      </div>
    </Reveal>
  );
}