import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import { Timer, ArrowRight, Play } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { fmtDuration } from "@/lib/format";
import { focusToday, focusThisWeek, focusStreak } from "@/lib/workloadEngine";

export default function FocusCard({ sessions }) {
  const navigate = useNavigate();
  const hasFocus = (sessions || []).some((s) => s.duration > 0);
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
      {!hasFocus && sessions?.length === 0 && (
        <div className="mt-4">
          <p className="text-xs text-muted-foreground mb-2">No sessions yet — the timer is right there.</p>
          <Button size="sm" onClick={() => navigate("/focus", { state: { autostart: true } })}>
            <Play className="w-3.5 h-3.5 mr-1.5" />Start a session
          </Button>
        </div>
      )}
      <Link to="/focus" className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground transition-colors mt-4">
        Start a session <ArrowRight className="w-3 h-3 ml-1" />
      </Link>
    </Card>
  );
}