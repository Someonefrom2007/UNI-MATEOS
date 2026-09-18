import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import { AlertTriangle, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { relativeDeadline, relativeExam } from "@/lib/format";
import { useI18n } from "@/lib/i18n";

const SEV = { danger: "border-l-rose-500", warn: "border-l-amber-500", info: "border-l-cyan-500" };

// Controlled chaos: urgency is expressed as visual weight, not as noise.
export default function AttentionCard({ urgent }) {
  const navigate = useNavigate();
  const { t } = useI18n();
  return (
    <Card className="p-5 h-full">
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle className="w-4 h-4 text-hud-amber" />
        <h2 className="um-label">{t("dash.needsAttention")}</h2>
      </div>
      {urgent.length === 0 ? (
        <div>
          <p className="text-sm text-muted-foreground">{t("dash.inGoodShape")}</p>
          <Button size="sm" variant="outline" className="mt-4" onClick={() => navigate("/tasks")}>
            <Plus className="w-3.5 h-3.5 mr-1.5" />{t("dash.planAhead")}
          </Button>
        </div>
      ) : (
        <div>
          {urgent.map((u, i) => {
            const sev = u.n <= 0 ? "danger" : u.n <= 1 ? "warn" : "info";
            return (
              <Link
                key={i}
                to={u.kind === "exam" ? `/exams/${u.item.id}` : "/tasks"}
                className={`flex items-start gap-3 py-2.5 pl-3 -ml-3 border-l-2 rounded-r-md hover:bg-muted/50 transition-colors ${SEV[sev]}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{u.item.name || u.item.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {u.course?.name || t("dash.noCourse")} · {u.kind === "exam" ? relativeExam(u.item.date) : relativeDeadline(u.item.due_date)}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </Card>
  );
}