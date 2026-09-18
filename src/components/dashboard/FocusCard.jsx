import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import { Timer, ArrowRight, Play } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { fmtDuration } from "@/lib/format";
import { focusToday, focusThisWeek, focusStreak } from "@/lib/workloadEngine";
import { useI18n } from "@/lib/i18n";

export default function FocusCard({ sessions }) {
  const navigate = useNavigate();
  const { t } = useI18n();
  const hasFocus = (sessions || []).some((s) => s.duration > 0);
  return (
    <Card className="p-5 h-full">
      <div className="flex items-center gap-2 mb-4">
        <Timer className="w-4 h-4 text-hud-violet" />
        <h2 className="um-label">{t("dash.focus")}</h2>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <div className="text-xs text-muted-foreground">{t("dash.today")}</div>
          <div className="font-display text-xl font-semibold mt-0.5">{fmtDuration(focusToday(sessions))}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">{t("dash.thisWeek")}</div>
          <div className="font-display text-xl font-semibold mt-0.5">{fmtDuration(focusThisWeek(sessions))}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">{t("dash.streak")}</div>
          <div className="font-display text-xl font-semibold mt-0.5">{focusStreak(sessions)}d</div>
        </div>
      </div>
      {!hasFocus && sessions?.length === 0 && (
        <div className="mt-4">
          <p className="text-xs text-muted-foreground mb-2">{t("dash.noSessions")}</p>
          <Button size="sm" onClick={() => navigate("/focus", { state: { autostart: true } })}>
            <Play className="w-3.5 h-3.5 mr-1.5" />{t("dash.startSession")}
          </Button>
        </div>
      )}
      <Link to="/focus" className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground transition-colors mt-4">
        {t("dash.startSession")} <ArrowRight className="w-3 h-3 ml-1" />
      </Link>
    </Card>
  );
}