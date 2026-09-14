import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Hero({ authed }) {
  const reduceMotion = useReducedMotion();
  const fade = (delay) => ({
    initial: { opacity: 0, y: reduceMotion ? 0 : 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.7, delay, ease: [0.21, 0.47, 0.32, 0.98] },
  });

  return (
    <section className="relative">
      {/* Atmosphere */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden>
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[720px] h-[420px] rounded-full bg-primary/[0.08] blur-[130px]" />
        <div className="absolute top-40 -left-24 w-[380px] h-[380px] rounded-full bg-cyan-500/[0.05] blur-[120px]" />
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-20 sm:pt-28 text-center">
        <motion.div {...fade(0)} className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/5 text-xs text-primary">
          <span className="w-1.5 h-1.5 rounded-full bg-primary" />
          The personal academic operating system
        </motion.div>

        <motion.h1 {...fade(0.08)} className="font-display text-4xl sm:text-6xl lg:text-7xl font-semibold tracking-tight mt-6 leading-[1.05]">
          Your university,
          <br />
          <span className="text-primary">organized around you.</span>
        </motion.h1>

        <motion.p {...fade(0.16)} className="text-muted-foreground text-base sm:text-lg max-w-2xl mx-auto mt-6">
          UNI·MATE unifies your schedule, courses, tasks, exams, grades, notes and focus
          into one connected command center — so you always know what matters now.
        </motion.p>

        <motion.div {...fade(0.24)} className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-9">
          <Button asChild size="lg" className="px-8 h-12 text-base">
            <Link to={authed ? "/dashboard" : "/register"}>
              {authed ? "Open your dashboard" : "Start free"} <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </Button>
          {!authed && (
            <Button asChild variant="outline" size="lg" className="px-8 h-12 text-base">
              <Link to="/login">I already have an account</Link>
            </Button>
          )}
        </motion.div>

        {/* Product preview — the command center, in miniature */}
        <div className="relative mx-auto mt-16 sm:mt-20 max-w-4xl">
          <div className="pointer-events-none absolute -inset-x-10 -top-12 h-56 bg-primary/[0.09] blur-[100px] rounded-full" aria-hidden />
          <motion.div
            initial={{ opacity: 0, y: reduceMotion ? 0 : 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.8, ease: [0.21, 0.47, 0.32, 0.98] }}
            className="relative rounded-2xl border border-border bg-card/80 backdrop-blur p-4 sm:p-5 shadow-2xl shadow-black/50"
          >
            <div className="um-label mb-3">Command center</div>
            <div className="grid sm:grid-cols-3 gap-3 text-left">
              <div className="sm:col-span-2 rounded-xl border border-border bg-background/60 p-4">
                <div className="um-label">What matters now</div>
                <div className="mt-2 font-medium">Linear Algebra — Midterm</div>
                <div className="text-xs text-muted-foreground mt-0.5">Exam in 3 days · focus on eigenvectors</div>
                <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full w-2/3 bg-primary rounded-full" />
                </div>
              </div>
              <div className="rounded-xl border border-border bg-background/60 p-4">
                <div className="um-label">Today</div>
                <div className="mt-2 space-y-2 text-xs">
                  <div className="flex items-center gap-2"><span className="text-primary font-mono">09:00</span> Lecture · Hall B2</div>
                  <div className="flex items-center gap-2"><span className="text-cyan-400 font-mono">15:00</span> Lab session</div>
                  <div className="flex items-center gap-2"><span className="text-emerald-400 font-mono">18:30</span> Study group</div>
                </div>
              </div>
              <div className="sm:col-span-3 grid grid-cols-3 gap-3">
                {[
                  ["Grade average", "7.8 / 10"],
                  ["ECTS", "6 this sem"],
                  ["Focus streak", "12 days"],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-border bg-background/60 px-4 py-3">
                    <div className="um-label">{label}</div>
                    <div className="text-sm font-semibold mt-1">{value}</div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}