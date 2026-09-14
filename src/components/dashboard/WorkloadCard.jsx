import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { fmtDuration, courseColor } from "@/lib/format";

// Workload as rhythm — bars grow into place so capacity is understood at a glance.
export default function WorkloadCard({ wl }) {
  return (
    <Card className="p-5 h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" />
          <h2 className="um-label">Workload this week</h2>
        </div>
        <Link to="/workload" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Details →</Link>
      </div>
      {wl.total === 0 ? (
        <p className="text-sm text-muted-foreground py-4">No estimated work this week. Add tasks with due dates and durations to see your workload.</p>
      ) : (
        <>
          <div className="font-display text-2xl font-semibold mb-4">
            {fmtDuration(wl.total)} <span className="text-sm font-normal text-muted-foreground">estimated</span>
          </div>
          <div className="space-y-3">
            {wl.breakdown.slice(0, 4).map((b, i) => {
              const cc = b.course ? courseColor(b.course.color) : courseColor("amber");
              const pct = (b.minutes / wl.total) * 100;
              return (
                <div key={b.course_id}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="flex items-center gap-2"><span className={`w-2 h-2 rounded-full ${cc.dot}`} />{b.course?.name || "Other"}</span>
                    <span className="text-muted-foreground">{fmtDuration(b.minutes)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full ${cc.dot}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 + i * 0.08 }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </Card>
  );
}