import { motion } from "framer-motion";
import { INTELLIGENCE } from "@/components/landing/sections";
import { SectionFrame, SectionHeading, PreviewChip } from "@/components/landing/Section";

const BAR_HEIGHTS = [22, 55, 78, 92, 100];

export default function Intelligence() {
  return (
    <SectionFrame id="intelligence">
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <SectionHeading kicker={INTELLIGENCE.kicker} headline={INTELLIGENCE.headline} body={INTELLIGENCE.body}>
          <div className="mt-6 flex flex-wrap gap-2">
            {INTELLIGENCE.bands.map(([range, label]) => (
              <span key={label} className="inline-flex items-center gap-2 rounded-lg border border-border bg-background/60 px-3 py-2">
                <span className="font-mono text-xs text-primary">{range}</span>
                <span className="text-xs text-muted-foreground">{label}</span>
              </span>
            ))}
          </div>
        </SectionHeading>

        <div className="relative mx-auto flex h-72 w-full max-w-xs items-end justify-center gap-3 pt-12">
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-full rounded-full bg-cyan-500/[0.07] blur-3xl" aria-hidden />
          {BAR_HEIGHTS.map((h, i) => (
            <motion.div
              key={h}
              initial={{ opacity: 0, scaleY: 0.6 }}
              whileInView={{ opacity: 1, scaleY: 1 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.6, delay: i * 0.08 }}
              className="w-10 rounded-t-lg bg-gradient-to-b from-cyan-400/40 to-indigo-500/50"
              style={{ height: `${h}%` }}
              aria-hidden
            />
          ))}
          <div className="absolute right-0 top-0 text-right">
            <PreviewChip />
          </div>
        </div>
      </div>
    </SectionFrame>
  );
}