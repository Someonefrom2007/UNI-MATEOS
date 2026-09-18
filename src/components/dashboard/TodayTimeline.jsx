import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarPlus, CalendarDays } from "lucide-react";
import { courseColor } from "@/lib/format";
import { useI18n } from "@/lib/i18n";

const TYPE_STYLE = {
  class: { dot: "bg-cyan-500", label: "dash.type.class" },
  exam: { dot: "bg-rose-500", label: "dash.type.exam" },
  task: { dot: "bg-amber-500", label: "dash.type.task" },
  study: { dot: "bg-violet-500", label: "dash.type.study" },
  personal: { dot: "bg-emerald-500", label: "dash.type.personal" },
  deadline: { dot: "bg-rose-500", label: "dash.type.deadline" },
};

// Time unfolding: today as a living timeline — the "now" marker
// moves by itself, the present is spotlit, the past recedes. Class and exam
// items from an imported ICS feed carry a small badge.
export default function TodayTimeline({ timeline, courses }) {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [now, setNow] = useState(() => new Date().toTimeString().slice(0, 5));

  useEffect(() => {
    const t = setInterval(() => setNow(new Date().toTimeString().slice(0, 5)), 60000);
    return () => clearInterval(t);
  }, []);

  const stateOf = (item) => {
    if (item.end) return item.end <= now ? "past" : item.start <= now ? "now" : "upcoming";
    return item.start <= now ? "past" : "upcoming";
  };

  return (
    <Card className="p-5 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="um-label">{t("dash.today")}</h2>
        <Link to="/schedule" className="text-xs text-muted-foreground hover:text-foreground transition-colors">{t("dash.scheduleLink")}</Link>
      </div>
      {timeline.length === 0 ? (
        <div className="flex-1 flex flex-col justify-center">
          <p className="text-sm text-muted-foreground">{t("dash.nothingToday")}</p>
          <div className="flex flex-wrap gap-2 mt-4">
            <Button size="sm" variant="outline" onClick={() => navigate("/schedule")}>
              <CalendarPlus className="w-3.5 h-3.5 mr-1.5" />{t("dash.addClass")}
            </Button>
            <Button size="sm" variant="outline" onClick={() => navigate("/schedule")}>
              <CalendarDays className="w-3.5 h-3.5 mr-1.5" />{t("dash.importIcs")}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-0.5 flex-1">
          {timeline.map((item) => {
            const st = stateOf(item);
            const ts = TYPE_STYLE[item.type] || TYPE_STYLE.personal;
            const course = courses.find((c) => c.id === item.course_id);
            const cc = course ? courseColor(course.color) : null;
            return (
              <div
                key={item.id}
                className={`flex items-center gap-3 py-2 rounded-md border-l-2 -ml-1 pl-2.5 transition-opacity ${
                  st === "now" ? "border-l-primary bg-primary/[0.06]" : "border-l-transparent"
                } ${st === "past" ? "opacity-40" : ""}`}
              >
                <div className="w-12 text-xs text-muted-foreground font-mono shrink-0">{item.start?.slice(0, 5)}</div>
                <div className={`w-2 h-2 rounded-full shrink-0 ${cc ? cc.dot : ts.dot}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-sm font-medium truncate">{item.title}</span>
                    {item.ics && (
                      <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border border-border bg-muted/40 text-muted-foreground">
                        ICS
                      </span>
                    )}
                  </div>
                  {item.room && <div className="text-xs text-muted-foreground">{item.room}</div>}
                </div>
                {st === "now" && <span className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary text-primary-foreground">{t("dash.now")}</span>}
                {st !== "now" && <span className="text-[10px] uppercase tracking-wider text-muted-foreground hidden sm:block">{t(ts.label)}</span>}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}