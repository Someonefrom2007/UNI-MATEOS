import { motion } from "framer-motion";
import { BookOpen, CalendarDays, CheckSquare, GraduationCap } from "lucide-react";
import { PRODUCT } from "@/components/landing/sections";
import { SectionFrame, SectionHeading, PreviewChip } from "@/components/landing/Section";

const SURFACES = [
  {
    icon: BookOpen,
    label: "Course",
    title: "Linear Algebra",
    meta: "prof · MAT-201 · 6 ECTS",
    color: "text-cyan-400",
    bg: "bg-cyan-400/10",
  },
  {
    icon: CalendarDays,
    label: "Schedule",
    title: "Tue · 09:00, Hall B2",
    meta: "Mon/Wed · lab · seminar",
    color: "text-blue-500",
    bg: "bg-blue-500/10",
  },
  {
    icon: CheckSquare,
    label: "Task",
    title: "Problem set 7",
    meta: "due Fri · 2h · priority high",
    color: "text-indigo-500",
    bg: "bg-indigo-500/10",
  },
  {
    icon: GraduationCap,
    label: "Exam",
    title: "Midterm · 20%",
    meta: "countdown · topics · prep",
    color: "text-violet-500",
    bg: "bg-violet-500/10",
  },
];

export default function Product() {
  return (
    <SectionFrame id="product">
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <SectionHeading kicker={PRODUCT.kicker} headline={PRODUCT.headline} body={PRODUCT.body}>
          <ul className="mt-6 space-y-3">
            {PRODUCT.marks.map(([label, desc]) => (
              <li key={label} className="flex items-start gap-3">
                <span className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-accent">{label}</span>
                <span className="text-sm text-muted-foreground">{desc}</span>
              </li>
            ))}
          </ul>
        </SectionHeading>

        <div className="relative">
          <div className="pointer-events-none absolute -inset-6 rounded-full bg-indigo-500/[0.07] blur-3xl" aria-hidden />
          <div className="relative space-y-3">
            {SURFACES.map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, x: 24 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className="relative flex items-center gap-4 rounded-xl border border-border bg-card/80 p-4 backdrop-blur"
              >
                {i > 0 && (
                  <span className="absolute -top-4 left-7 h-3 w-px border-l border-dashed border-border" aria-hidden />
                )}
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${s.bg}`}>
                  <s.icon className={`h-5 w-5 ${s.color}`} />
                </span>
                <div className="min-w-0">
                  <div className="um-label mb-0.5">{s.label}</div>
                  <div className="truncate text-sm font-medium">{s.title}</div>
                  <div className="truncate text-xs text-muted-foreground">{s.meta}</div>
                </div>
                <span className="ml-auto text-muted-foreground/40" aria-hidden>›</span>
              </motion.div>
            ))}
            <div className="flex justify-end pt-2">
              <PreviewChip />
            </div>
          </div>
        </div>
      </div>
    </SectionFrame>
  );
}