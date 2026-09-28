import { Link } from "react-router-dom";
import { CalendarClock, CheckCircle2, GraduationCap } from "lucide-react";
import { Card } from "@/components/ui/card";
import { relativeExam } from "@/lib/format";

// Readiness is a bar you can act on, not a number: each row pairs the score
// with the countdown, and the component breakdown says *which* part is weak.
const BAND = {
  ready: { text: "text-emerald-500", bar: "bg-emerald-500" },
  "getting-there": { text: "text-cyan-500", bar: "bg-cyan-500" },
  behind: { text: "text-hud-amber", bar: "bg-hud-amber" },
  "at-risk": { text: "text-rose-500", bar: "bg-rose-500" },
};

const PART = { mastery: "Confidence", coverage: "Study time", pace: "Pace" };

// Exams in the next 7 days with a live readiness bar and countdown badge.
export default function ExamReadinessCard({ board = [] }) {
  const atRisk = board.filter((r) => r.priority.level !== "normal").length;

  return (
    <Card className="p-5 h-full">
      <div className="flex items-center gap-2 mb-1">
        <GraduationCap className="w-4 h-4 text-hud-cyan" />
        <h2 className="um-label">Upcoming exams &amp; readiness</h2>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        {board.length === 0
          ? "Nothing due in the next 7 days."
          : `${board.length} in the next 7 days${atRisk ? ` · ${atRisk} need attention` : " · all on track"}`}
      </p>

      {board.length === 0 ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          Clear week — good time to get ahead.
        </div>
      ) : (
        <div className="space-y-3.5">
          {board.map(({ exam, course, readiness, priority, countdown }) => {
            const band = BAND[readiness.band] || BAND["at-risk"];
            const parts = Object.entries(readiness.components).filter(([, v]) => v !== null);
            return (
              <Link
                key={exam.id}
                to={`/exams/${exam.id}`}
                className="block py-1 pl-3 -ml-3 border-l-2 border-l-current rounded-r-md hover:bg-muted/50 transition-colors"
                style={{ color: undefined }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{exam.name}</span>
                      {countdown <= 1 && (
                        <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-500">
                          {countdown === 0 ? "TODAY" : "TOMORROW"}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {course?.name || "No course"} · {relativeExam(exam.date)}
                    </div>
                  </div>
                  <span className={`shrink-0 text-sm font-semibold tabular-nums ${band.text}`}>
                    {readiness.score}%
                  </span>
                </div>

                <div
                  className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden"
                  role="progressbar"
                  aria-valuenow={readiness.score}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${exam.name} readiness`}
                >
                  <div className={`h-full rounded-full transition-all ${band.bar}`} style={{ width: `${readiness.score}%` }} />
                </div>

                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                  {parts.map(([k, v]) => (
                    <span key={k} className={v < 40 ? "text-rose-500" : ""}>
                      {PART[k]} {v}%
                    </span>
                  ))}
                </div>

                {priority.reasons.length > 0 && (
                  <ul className="mt-1.5 space-y-0.5">
                    {priority.reasons.map((r) => (
                      <li
                        key={r.key}
                        className={`text-[11px] flex items-center gap-1 ${priority.level === "critical" ? "text-rose-500" : "text-hud-amber"}`}
                      >
                        <CalendarClock className="w-3 h-3 shrink-0" />
                        {r.label}
                      </li>
                    ))}
                  </ul>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </Card>
  );
}
