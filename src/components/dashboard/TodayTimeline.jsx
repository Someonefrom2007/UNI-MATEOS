import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { courseColor } from "@/lib/format";

const TYPE_STYLE = {
  class: { dot: "bg-cyan-500", label: "Class" },
  exam: { dot: "bg-rose-500", label: "Exam" },
  task: { dot: "bg-amber-500", label: "Task" },
  study: { dot: "bg-violet-500", label: "Study" },
  personal: { dot: "bg-emerald-500", label: "Personal" },
  deadline: { dot: "bg-rose-500", label: "Deadline" },
};

// Time unfolding: today as a living timeline — the "now" marker
// moves by itself, the present is spotlit, the past recedes.
export default function TodayTimeline({ timeline, courses }) {
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
        <h2 className="um-label">Today</h2>
        <Link to="/schedule" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Schedule →</Link>
      </div>
      {timeline.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6">Nothing scheduled today. A good time to get ahead.</p>
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
                  <div className="text-sm font-medium truncate">{item.title}</div>
                  {item.room && <div className="text-xs text-muted-foreground">{item.room}</div>}
                </div>
                {st === "now" && <span className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary text-primary-foreground">Now</span>}
                {st !== "now" && <span className="text-[10px] uppercase tracking-wider text-muted-foreground hidden sm:block">{ts.label}</span>}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}