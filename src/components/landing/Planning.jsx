import { motion } from "framer-motion";
import { PLANNING } from "@/components/landing/sections";
import { SectionFrame, SectionHeading, PreviewChip } from "@/components/landing/Section";

const TASKS = [
  { label: "Problem set 7", effort: "w-2/3", accent: "bg-primary", due: "Fri" },
  { label: "Essay outline", effort: "w-1/3", accent: "bg-cyan-400", due: "next Mon" },
  { label: "Lab report", effort: "w-1/2", accent: "bg-indigo-500", due: "Wed" },
];

export default function Planning() {
  return (
    <SectionFrame id="planning">
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <SectionHeading kicker={PLANNING.kicker} headline={PLANNING.headline} body={PLANNING.body} />

        <div className="relative">
          <div className="pointer-events-none absolute -inset-4 rounded-full bg-cyan-500/[0.06] blur-3xl" aria-hidden />
          <div className="relative rounded-xl border border-border bg-card/80 p-5 backdrop-blur">
            <div className="flex items-center justify-between">
              <div className="um-label">Workboard</div>
              <PreviewChip />
            </div>
            <div className="mt-4 space-y-4">
              {TASKS.map((t) => (
                <motion.div
                  key={t.label}
                  initial={{ opacity: 0, x: 16 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ duration: 0.5 }}
                  className="space-y-1.5"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium">{t.label}</span>
                    <span className="text-muted-foreground">due {t.due}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <motion.div
                      initial={{ width: 0 }}
                      whileInView={{ width: t.effort === "w-2/3" ? "66%" : t.effort === "w-1/2" ? "50%" : "33%" }}
                      viewport={{ once: true, margin: "-60px" }}
                      transition={{ duration: 1.2, delay: 0.2, ease: "easeOut" }}
                      className={`h-full rounded-full ${t.accent}`}
                    />
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </SectionFrame>
  );
}