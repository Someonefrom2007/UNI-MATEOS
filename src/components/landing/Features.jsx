import { motion, useReducedMotion } from "framer-motion";
import {
  LayoutDashboard, CalendarDays, CheckSquare, GraduationCap,
  Timer, StickyNote, Repeat, BrainCircuit,
} from "lucide-react";

const FEATURES = [
  { icon: LayoutDashboard, title: "Command center", body: "One dashboard that decides what matters now — urgency, deadlines, and the rhythm of your semester." },
  { icon: CalendarDays, title: "Day, week, month", body: "Your whole schedule in three views, with classes, exams and deadlines side by side." },
  { icon: CheckSquare, title: "Tasks that connect", body: "Assignments link to their course and exam, so finishing one moves everything forward." },
  { icon: GraduationCap, title: "Grade engine", body: "Weighted Grade Average, per-course targets, and exactly what you need on the final." },
  { icon: Timer, title: "Deep focus", body: "Pomodoro sessions with streaks, tied to the course you're actually studying." },
  { icon: StickyNote, title: "Sticky wall", body: "Quick thoughts on a wall of stickies that feels like paper, not like a database." },
  { icon: Repeat, title: "Goals & habits", body: "Weekly targets and streaks that keep the semester moving, one checkbox at a time." },
  { icon: BrainCircuit, title: "AI, grounded", body: "An assistant that knows your courses, exams and deadlines — not the whole internet's." },
];

export default function Features() {
  const reduceMotion = useReducedMotion();
  return (
    <section id="features" className="max-w-6xl mx-auto px-4 sm:px-6 py-24 sm:py-32">
      <motion.div
        initial={{ opacity: 0, y: reduceMotion ? 0 : 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.6 }}
        className="max-w-2xl"
      >
        <div className="um-label">What's inside</div>
        <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight mt-3">
          Everything your semester needs. Nothing it doesn't.
        </h2>
        <p className="text-muted-foreground mt-4">
          No scattered spreadsheets, no five apps that don't talk to each other.
          Every part of UNI·MATE is connected to the same semester.
        </p>
      </motion.div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-12">
        {FEATURES.map((f, i) => (
          <motion.div
            key={f.title}
            initial={{ opacity: 0, y: reduceMotion ? 0 : 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.5, delay: (i % 4) * 0.06 }}
            className="surface-card p-5 hover:border-primary/30 transition-colors"
          >
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <f.icon className="w-5 h-5 text-primary" />
            </div>
            <h3 className="font-medium mt-4">{f.title}</h3>
            <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{f.body}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}