import { motion } from "framer-motion";
import { FOCUS } from "@/components/landing/sections";
import { SectionFrame, SectionHeading, PreviewChip } from "@/components/landing/Section";

const CIRCUMFERENCE = 2 * Math.PI * 68;

export default function FocusLanding() {
  return (
    <SectionFrame id="focus">
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <SectionHeading kicker={FOCUS.kicker} headline={FOCUS.headline} body={FOCUS.body} />

        <div className="relative mx-auto flex flex-col items-center gap-6">
          <div className="pointer-events-none absolute -inset-10 rounded-full bg-primary/[0.08] blur-3xl" aria-hidden />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.7 }}
            className="relative flex h-64 w-64 items-center justify-center"
          >
            <svg
              className="absolute inset-0 h-full w-full -rotate-90"
              viewBox="0 0 160 160"
              aria-hidden
            >
              <circle cx="80" cy="80" r="68" fill="none" stroke="currentColor" className="stroke-muted/70" strokeWidth="6" />
              <motion.circle
                cx="80"
                cy="80"
                r="68"
                fill="none"
                stroke="currentColor"
                className="stroke-primary"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={CIRCUMFERENCE}
                initial={{ strokeDashoffset: CIRCUMFERENCE }}
                whileInView={{ strokeDashoffset: CIRCUMFERENCE * 0.35 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 2.2, delay: 0.3, ease: "easeOut" }}
              />
            </svg>
            <div className="relative z-10 flex flex-col items-center gap-1 text-center">
              <div className="font-mono text-4xl font-light tracking-tight">15:00</div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">focus session</div>
            </div>
          </motion.div>
          <div className="relative z-10 text-sm text-muted-foreground">Linear Algebra · eigenvectors</div>
          <div className="absolute right-0 bottom-0">
            <PreviewChip />
          </div>
        </div>
      </div>
    </SectionFrame>
  );
}