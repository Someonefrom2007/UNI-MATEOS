import { motion, useReducedMotion } from "framer-motion";

// Shared motion primitive — every entrance answers "why is this moving":
// hierarchy (staggered reveals) and orientation (content rises into place).
// Honors the OS reduced-motion preference.
export function Reveal({ children, delay = 0, mode = "mount", className = "" }) {
  const reduce = useReducedMotion();
  const transition = { duration: 0.5, delay, ease: [0.21, 0.47, 0.32, 0.98] };

  if (reduce) {
    return (
      <motion.div className={className} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={transition}>
        {children}
      </motion.div>
    );
  }

  const animProps =
    mode === "inView"
      ? { initial: { opacity: 0, y: 16 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: "-40px" } }
      : { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 } };

  return (
    <motion.div className={className} transition={transition} {...animProps}>
      {children}
    </motion.div>
  );
}