import { Link } from "react-router-dom";
import { Timer, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { fmtDuration } from "@/lib/format";
import { focusToday, focusThisWeek, focusStreak } from "@/lib/workloadEngine";

export default function FocusCard({ sessions }) {
  return (
    <Card className="p-5 h-full">
      <div className="flex items-center gap-2 mb-4">
        <Timer className="w-4 h-4 text-violet-400" />
        <h2 className="um-label">Focus</h2>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <div className="text-xs text-muted-foreground">Today</div>
          <div className="font-display text-xl font-semibold mt-0.5">{fmtDuration(focusToday(sessions))}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">This week</div>
          <div className="font-display text-xl font-semibold mt-0.5">{fmtDuration(focusThisWeek(sessions))}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Streak</div>
          <div className="font-display text-xl font-semibold mt-0.5">{focusStreak(sessions)}d</div>
        </div>
      </div>
      <Link to="/focus" className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground transition-colors mt-4">
        Start a session <ArrowRight className="w-3 h-3 ml-1" />
      </Link>
    </Card>
  );
}