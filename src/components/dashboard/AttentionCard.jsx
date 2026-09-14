import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { relativeDeadline, relativeExam } from "@/lib/format";

const SEV = { danger: "border-l-rose-500", warn: "border-l-amber-500", info: "border-l-cyan-500" };

// Controlled chaos: urgency is expressed as visual weight, not as noise.
export default function AttentionCard({ urgent }) {
  return (
    <Card className="p-5 h-full">
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle className="w-4 h-4 text-amber-400" />
        <h2 className="um-label">Needs attention</h2>
      </div>
      {urgent.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">You're in good shape — nothing urgent right now. Enjoy it.</p>
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
                    {u.course?.name || "No course"} · {u.kind === "exam" ? relativeExam(u.item.date) : relativeDeadline(u.item.due_date)}
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