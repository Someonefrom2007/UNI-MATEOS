import { motion, useReducedMotion } from "framer-motion";
import BrandLogo from "@/components/Brand/BrandLogo";
import { BRAND_NAME, BRAND_TAGLINE } from "@/components/Brand/brand";

// Branded splash / loading screen — used for route transitions and the initial
// auth check. Calm, atmospheric, on-brand. Respects reduced motion.
export default function Splash({ label = "Loading" }) {
  const reduceMotion = useReducedMotion();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background space-bg" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-4">
        <motion.div
          animate={reduceMotion ? undefined : { opacity: [1, 0.55, 1], scale: [1, 1.02, 1] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        >
          <BrandLogo variant="gradient" size={44} showText={false} />
        </motion.div>
        <div className="flex flex-col items-center gap-1.5">
          <div className="font-display text-xl font-semibold tracking-tight text-foreground">{BRAND_NAME}</div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70">{BRAND_TAGLINE}</div>
        </div>
      </div>
    </div>
  );
}