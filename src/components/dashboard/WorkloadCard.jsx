import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Clock, Plus, CalendarDays } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { fmtDuration, courseColor } from "@/lib/format";

const LEVEL_STYLE = {
  low: { cls: "chip-hud-cyan", dot: "bg-hud-cyan" },
  balanced: { cls: "chip-hud-emerald", dot: "bg-hud-emerald" },
  overdrive: { cls: "chip-hud-rose", dot: "bg-hud-rose" },
};

// Workload as rhythm — bars grow into place so capacity is understood at a
// glance, and the adjacent radar classifies the pace (Low / Balanced /
// Overdrive) from the workloadEngine estimate + recorded focus.
export default function WorkloadCard({ wl, radar }) {
  const navigate = useNavigate();
  const hasRadar = radar && (radar.workloadMinutes > 0 || radar.focusMinutes > 0);
  const radarMeta = LEVEL_STYLE[radar?.level] || LEVEL_STYLE.low;

  return (
    <Card className="p-5 h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" />
          <h2 className="um-label">Workload this week</h2>
        </div>
        <button onClick={() => navigate("/workload")} className="text-xs text-muted-foreground hover:text-foreground transition-colors">Details →</button>
      </div>
      {wl.total === 0 && !hasRadar ? (
        <div>
          <p className="text-sm text-muted-foreground">No estimated work this week yet. Add a task or import your calendar to see your load.</p>
          <div className="flex flex-wrap gap-2 mt-4">
            <Button size="sm" variant="outline" onClick={() => navigate("/tasks")}>
              <Plus className="w-3.5 h-3.5 mr-1.5" />Add a task
            </Button>
            <Button size="sm" variant="outline" onClick={() => navigate("/schedule")}>
              <CalendarDays className="w-3.5 h-3.5 mr-1.5" />Import ICS
            </Button>
          </div>
        </div>
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

          {hasRadar && (
            <div className="mt-5 pt-4 border-t border-border/60">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="text-muted-foreground">Load radar</span>
                <span className="font-medium text-muted-foreground">{radar.totalHours}h estimated + focused</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {["low", "balanced", "overdrive"].map((lvl) => {
                  const st = LEVEL_STYLE[lvl];
                  const active = radar.level === lvl;
                  return (
                    <div
                      key={lvl}
                      className={`flex items-center justify-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider px-2 py-1.5 rounded-lg border transition-colors ${
                        active ? st.cls : "border-border bg-muted/30 text-muted-foreground/70"
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${active ? st.dot : "bg-muted-foreground/40"}`} />
                      {lvl}
                    </div>
                  );
                })}
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">{radar.note}</p>
            </div>
          )}
        </>
      )}
    </Card>
  );
}