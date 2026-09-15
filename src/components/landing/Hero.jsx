import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HERO } from "@/components/landing/sections";
import { PreviewChip } from "@/components/landing/Section";

const fade = (reduceMotion) => (delay) => ({
  initial: { opacity: 0, y: reduceMotion ? 0 : 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.7, delay, ease: [0.21, 0.47, 0.32, 0.98] },
});

const TODAY = [
  ["09:00", "Lecture · Hall B2"],
  ["15:00", "Lab session"],
  ["18:30", "Study group"],
];

const TILES = [
  ["Focus", "complete a session"],
  ["Tasks", "2 due soon"],
  ["Grade", "band + forecast"],
];

export default function Hero({ authed }) {
  const reduceMotion = useReducedMotion();
  const f = fade(reduceMotion);

  return (
    <section id="hero" className="relative">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden>
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[820px] h-[460px] rounded-full bg-primary/[0.1] blur-[130px]" />
        <div className="absolute top-40 -left-24 w-[380px] h-[380px] rounded-full bg-cyan-500/[0.06] blur-[120px]" />
        <div className="absolute inset-x-0 -bottom-10 h-40 bg-gradient-to-t from-background to-transparent" />
      </div>

      <div className="mx-auto max-w-6xl px-4 sm:px-6 pt-20 sm:pt-28 text-center">
        <motion.div {...f(0)} className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs text-primary">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          {HERO.kicker}
        </motion.div>

        <motion.h1 {...f(0.08)} className="mt-6 font-display font-semibold leading-[0.95] tracking-tight">
          <span className="block text-7xl sm:text-8xl lg:text-9xl">{HERO.headline}</span>
          <span className="mt-4 block text-3xl sm:text-5xl text-muted-foreground">
            {HERO.tagline}
          </span>
        </motion.h1>

        <motion.p {...f(0.16)} className="mx-auto mt-6 max-w-2xl text-base text-muted-foreground sm:text-lg">
          {HERO.sub}
        </motion.p>

        <motion.div {...f(0.24)} className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild size="lg" className="h-12 px-8 text-base">
            <Link to={authed ? "/dashboard" : "/register"}>
              {authed ? "Open your dashboard" : HERO.ctaPrimary} <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
          {!authed && (
            <Button asChild variant="outline" size="lg" className="h-12 px-8 text-base">
              <Link to="/login">{HERO.ctaSecondary}</Link>
            </Button>
          )}
        </motion.div>

        <motion.div
          {...f(0.34)}
          className="relative mx-auto mt-16 max-w-4xl sm:mt-20"
        >
          <div className="pointer-events-none absolute -inset-x-10 -top-12 h-56 rounded-full bg-primary/[0.09] blur-[100px]" aria-hidden />
          <div className="relative overflow-hidden rounded-2xl border border-border bg-card/80 p-4 text-left shadow-2xl shadow-black/50 backdrop-blur sm:p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5" aria-hidden>
                <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
                <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
                <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
              </div>
              <PreviewChip />
            </div>

            <div className="mt-4 grid gap-3 text-left sm:grid-cols-3">
              <div className="rounded-xl border border-border bg-background/60 p-4 sm:col-span-2">
                <div className="um-label">What matters now</div>
                <div className="mt-2 font-medium">Linear Algebra — Midterm</div>
                <div className="mt-0.5 text-xs text-muted-foreground">Exam in 3 days · focus on eigenvectors</div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full w-2/3 rounded-full bg-primary" />
                </div>

                <div className="mt-4 grid grid-cols-3 gap-3">
                  {TILES.map(([label, value]) => (
                    <div key={label} className="rounded-xl border border-border bg-background/60 px-3 py-3">
                      <div className="um-label">{label}</div>
                      <div className="mt-1 text-xs font-medium">{value}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-border bg-background/60 p-4">
                <div className="um-label">Today</div>
                <div className="mt-2 space-y-2.5 text-xs">
                  {TODAY.map(([time, label]) => (
                    <div key={time} className="flex items-center gap-2">
                      <span className="font-mono text-primary">{time}</span>
                      <span>{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}