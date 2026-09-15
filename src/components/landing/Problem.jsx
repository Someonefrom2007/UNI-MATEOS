import { motion } from "framer-motion";
import { Inbox, MessageSquare, CalendarClock, FileText, Table2, MoveRight } from "lucide-react";
import { PROBLEM } from "@/components/landing/sections";
import { SectionFrame, SectionHeading } from "@/components/landing/Section";

const SCRAPS = [
  { icon: Inbox, label: "email", rotate: -7, hang: "lg:-mt-2 lg:-ml-3" },
  { icon: MessageSquare, label: "group chat", rotate: -3, hang: "" },
  { icon: Table2, label: "spreadsheet", rotate: 2, hang: "lg:mt-3" },
  { icon: CalendarClock, label: "another calendar", rotate: 6, hang: "lg:-mr-2" },
  { icon: FileText, label: "pdf", rotate: 3, hang: "lg:-mb-3" },
];

export default function Problem() {
  return (
    <SectionFrame id="problem">
      <div className="grid items-center gap-14 lg:grid-cols-2">
        <SectionHeading kicker={PROBLEM.kicker} headline={PROBLEM.headline}>
          <ul className="mt-6 space-y-2.5 text-muted-foreground">
            {PROBLEM.points.map((pt) => (
              <li key={pt} className="flex items-start gap-2.5">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent/70" aria-hidden />
                {pt}
              </li>
            ))}
          </ul>
        </SectionHeading>

        {/* Chaos → order composition, pure CSS (no data claims). */}
        <div className="relative mx-auto w-full max-w-sm text-xs">
          <div className="flex flex-wrap items-center justify-center gap-3">
            {SCRAPS.map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.5, delay: i * 0.09 }}
                style={{ rotate: s.rotate }}
                className={`rounded-lg border border-border bg-card/90 px-3 py-2 shadow-lg ${s.hang}`}
              >
                <s.icon className="h-4 w-4 text-muted-foreground/70" />
                <div className="mt-1 opacity-75">{s.label}</div>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.6, delay: 0.45 }}
            className="mt-8 flex items-center justify-center gap-3"
          >
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent">UNI·MATE</span>
            <span className="grid h-14 w-14 place-items-center rounded-full border border-accent/30 bg-accent/10 text-accent">
              <MoveRight className="h-6 w-6" />
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">ordered</span>
          </motion.div>
        </div>
      </div>
    </SectionFrame>
  );
}