import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { GraduationCap, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { fmtGrade } from "@/lib/format";

// Sparkline of the last graded assessments — real data, no decoration.
function Sparkline({ grades }) {
  const pts = grades.filter((g) => g.grade !== null && g.grade !== undefined).slice(-8);
  if (pts.length < 2) return null;
  const step = 100 / (pts.length - 1);
  const y = (g) => (28 - (g / 10) * 24 - 2).toFixed(1);
  const path = pts.map((g, i) => `${(i * step).toFixed(1)},${y(g.grade)}`).join(" ");
  return (
    <svg viewBox="0 0 100 28" className="w-24 h-7 text-cyan-400 shrink-0" fill="none" aria-hidden>
      <polyline points={path} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="100" cy={y(pts[pts.length - 1].grade)} r="1.8" fill="currentColor" />
    </svg>
  );
}

// The academic pulse: where you stand, and the shape of your trajectory.
export default function PulseCard({ gpa, ects, grades = [] }) {
  const hasGpa = gpa !== null && gpa !== undefined;
  const ectsPct = Math.min(100, (ects / 60) * 100);
  return (
    <Card className="p-5 h-full">
      <div className="flex items-center gap-2 mb-4">
        <GraduationCap className="w-4 h-4 text-cyan-400" />
        <h2 className="um-label">Academic pulse</h2>
      </div>
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="flex items-baseline gap-2">
            <span className="font-display text-4xl font-semibold tracking-tight">{hasGpa ? fmtGrade(gpa) : "—"}</span>
            {hasGpa && <span className="text-sm text-muted-foreground">/ 10</span>}
          </div>
          <div className="text-xs text-muted-foreground mt-1">weighted grade average</div>
        </div>
        <Sparkline grades={grades} />
      </div>
      <div className="mt-5">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="text-muted-foreground">ECTS this semester</span>
          <span className="font-medium">{ects}</span>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-cyan-500"
            initial={{ width: 0 }}
            animate={{ width: `${ectsPct}%` }}
            transition={{ duration: 0.9, ease: "easeOut", delay: 0.3 }}
          />
        </div>
      </div>
      <Link to="/grades" className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground transition-colors mt-4">
        View grades <ArrowRight className="w-3 h-3 ml-1" />
      </Link>
    </Card>
  );
}