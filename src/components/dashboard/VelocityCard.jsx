import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Gauge, ArrowRight, Flame, Activity, CalendarCheck, Play } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { fmtDuration } from "@/lib/format";
import { INTENSITY } from "@/lib/burnout";

const INTENSITY_META = {
  low: {
    cls: "chip-hud-cyan",
    note: "Easy pace — space to push.",
  },
  balanced: {
    cls: "chip-hud-emerald",
    note: "Sustainable flow — keep it there.",
  },
  overdrive: {
    cls: "chip-hud-rose",
    note: "High output — protect recovery.",
  },
};

export default function VelocityCard({ velocity }) {
  const navigate = useNavigate();
  const meta = INTENSITY_META[velocity?.intensity] || INTENSITY_META.low;
  const { focusHoursWeek, completionsWeek, focus, completions, score } = velocity;
  const hasData = velocity.focusMinWeek > 0 || completionsWeek > 0;
  const maxFocus = Math.max(15, ...focus);
  return (
    <Card className="p-5 h-full">
      <div className="flex items-center gap-2 mb-4">
        <Gauge className="w-4 h-4 text-hud-cyan" />
        <h2 className="um-label">Velocity &amp; burnout risk</h2>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <div className="text-xs text-muted-foreground flex items-center gap-1"><Flame className="w-3 h-3" /> Focus this week</div>
          <div className="font-display text-xl font-semibold mt-0.5">{fmtDuration(Math.round(focusHoursWeek * 60))}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground flex items-center gap-1"><CalendarCheck className="w-3 h-3" /> Tasks completed</div>
          <div className="font-display text-xl font-semibold mt-0.5">{completionsWeek}</div>
        </div>
      </div>

      <div className="flex items-end gap-1 h-14 mb-1">
        {focus.map((m, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
            <div className="w-full rounded-t bg-gradient-to-t from-hud-cyan/30 to-hud-cyan" style={{ height: `${Math.max(4, (m / maxFocus) * 40)}px` }} />
            {completions[i] > 0 && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />}
          </div>
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground mb-4">
        <span>mon</span><span>wed</span><span>fri</span><span>today</span>
      </div>

      <div className="mb-3">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="text-muted-foreground">Load intensity</span>
          <span className="font-medium">{score}/100</span>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-rose-500"
            initial={{ width: 0 }}
            animate={{ width: `${score}%` }}
            transition={{ duration: 0.9, ease: "easeOut" }}
          />
        </div>
      </div>

      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold ${meta.cls}`}>
        <Activity className="w-3.5 h-3.5" /> {INTENSITY[velocity.intensity]?.label || "Balanced"}
        <span className="font-normal opacity-80 text-[11px]">{meta.note}</span>
      </div>

      {!hasData && (
        <Button size="sm" variant="outline" className="mt-4" onClick={() => navigate("/focus", { state: { autostart: true } })}>
          <Play className="w-3.5 h-3.5 mr-1.5" />Start a focus session
        </Button>
      )}

      <Link to="/workload" className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground transition-colors mt-4">
        Workload breakdown <ArrowRight className="w-3 h-3 ml-1" />
      </Link>
    </Card>
  );
}