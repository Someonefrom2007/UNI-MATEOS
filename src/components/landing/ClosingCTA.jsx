import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ClosingCTA({ authed }) {
  const reduceMotion = useReducedMotion();
  return (
    <section className="relative">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden>
        <div className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 w-[560px] h-[320px] rounded-full bg-primary/[0.09] blur-[120px]" />
      </div>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-24 sm:py-32 text-center">
        <motion.div
          initial={{ opacity: 0, y: reduceMotion ? 0 : 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="font-display text-3xl sm:text-5xl font-semibold tracking-tight">
            Your semester, in one place.
          </h2>
          <p className="text-muted-foreground mt-4 max-w-xl mx-auto">
            Set up your courses once, and the schedule, tasks, exams and grades
            build themselves around them.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-9">
            <Button asChild size="lg" className="px-8 h-12 text-base">
              <Link to={authed ? "/dashboard" : "/register"}>
                {authed ? "Open your dashboard" : "Start free"} <ArrowRight className="w-4 h-4 ml-1" />
              </Link>
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}