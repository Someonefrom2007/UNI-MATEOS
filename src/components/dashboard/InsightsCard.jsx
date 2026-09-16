import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import { Sparkles, ArrowRight, Play } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const CAT_STYLE = {
  Risk: "chip-hud-rose",
  Productivity: "chip-hud-violet",
  Planning: "chip-hud-cyan",
  Academic: "chip-hud-emerald",
};

// Discovering something about yourself — observations surface progressively.
export default function InsightsCard({ insights }) {
  const navigate = useNavigate();
  return (
    <Card className="p-5 h-full">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-4 h-4 text-hud-cyan" />
        <h2 className="um-label">Insights</h2>
      </div>
      {insights.length === 0 ? (
        <div>
          <p className="text-sm text-muted-foreground">Not enough data yet — as you complete tasks, focus, and grade, patterns will appear here.</p>
          <Button size="sm" variant="outline" className="mt-4" onClick={() => navigate("/focus")}>
            <Play className="w-3.5 h-3.5 mr-1.5" />Start with a focus session
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {insights.slice(0, 3).map((ins, i) => (
            <div key={ins.id} className="flex items-start gap-3">
              <span className={`shrink-0 mt-0.5 text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${CAT_STYLE[ins.category] || CAT_STYLE.Productivity}`}>
                {ins.category}
              </span>
              <p className="text-sm leading-relaxed">{ins.text}</p>
            </div>
          ))}
        </div>
      )}
      <Link to="/insights" className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground transition-colors mt-4">
        All insights <ArrowRight className="w-3 h-3 ml-1" />
      </Link>
    </Card>
  );
}