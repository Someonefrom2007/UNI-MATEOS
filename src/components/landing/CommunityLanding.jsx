import { motion } from "framer-motion";
import { COMMUNITY } from "@/components/landing/sections";
import { SectionFrame, SectionHeading, PreviewChip } from "@/components/landing/Section";

const THREAD = [
  {
    initials: "A",
    role: "Student · question",
    body: "Anyone sharing notes on calculus optimization past week 6? Happy to trade mine.",
    tint: "from-cyan-400/70 to-blue-500/70",
    own: false,
  },
  {
    initials: "M",
    role: "Student · reply",
    body: "Yes — I have the seminar slides, DM me. Mind if I share your summary too?",
    tint: "from-indigo-400/70 to-violet-500/70",
    own: false,
  },
  {
    initials: "S",
    role: "Student · reply",
    body: "There's also a study group Thursdays at the library, seats open.",
    tint: "from-emerald-400/70 to-cyan-500/70",
    own: false,
  },
];

export default function CommunityLanding() {
  return (
    <SectionFrame id="community">
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <SectionHeading kicker={COMMUNITY.kicker} headline={COMMUNITY.headline} body={COMMUNITY.body} />

        <div className="relative space-y-3">
          {THREAD.map((m, i) => (
            <motion.div
              key={m.initials}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className={`flex items-start gap-3 rounded-xl border border-border bg-card/80 p-4 backdrop-blur ${i === 0 ? "" : "ml-4"}`}
            >
              <span
                aria-hidden
                className={`grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br font-display text-sm font-semibold text-white ${m.tint}`}
              >
                {m.initials}
              </span>
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{m.role}</div>
                <p className="mt-1 text-sm leading-relaxed">{m.body}</p>
              </div>
            </motion.div>
          ))}
          <div className="flex justify-end pt-1">
            <PreviewChip />
          </div>
        </div>
      </div>
    </SectionFrame>
  );
}