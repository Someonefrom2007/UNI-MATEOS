import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import BrandLogo from "@/components/Brand/BrandLogo";
import { CTA } from "@/components/landing/sections";

export default function ClosingCTA({ authed }) {
  const reduceMotion = useReducedMotion();
  return (
    <section id="cta" className="relative">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden>
        <div className="absolute left-1/2 top-1/2 h-[320px] w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/[0.09] blur-[120px]" />
      </div>
      <div className="mx-auto max-w-6xl px-4 py-24 text-center sm:px-6 sm:py-32">
        <motion.div
          initial={{ opacity: 0, y: reduceMotion ? 0 : 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="flex flex-col items-center"
        >
          <div className="mb-6 flex justify-center" aria-hidden>
            <BrandLogo variant="gradient" size={44} showText={false} />
          </div>
          <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-5xl">{CTA.headline}</h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">{CTA.sub}</p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="h-12 px-8 text-base">
              <Link to={authed ? "/dashboard" : "/register"}>
                {authed ? "Open your dashboard" : "Start free"} <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}