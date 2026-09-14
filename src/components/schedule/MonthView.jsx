import { eventsForDate } from "@/lib/scheduleEngine";
import { courseColor } from "@/lib/format";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export default function MonthView({ anchor, events, courses, todayStr, onPickDay }) {
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const lead = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7) cells.push(null);

  return (
    <div>
      <div className="grid grid-cols-7 mb-1">
        {DAY_LABELS.map((d) => (
          <div key={d} className="text-center text-[10px] uppercase tracking-wider text-muted-foreground py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (!d) return <div key={i} className="min-h-[92px] rounded-lg bg-muted/20" />;
          const ds = iso(d);
          const isToday = ds === todayStr;
          const evts = eventsForDate(events, ds).filter((e) => e.start_time);
          return (
            <button
              key={i}
              onClick={() => onPickDay(d)}
              className={`min-h-[92px] rounded-lg border p-1.5 text-left hover:border-primary/40 transition-colors ${isToday ? "border-primary/60 bg-primary/5" : "border-border/50 hover:bg-muted/20"}`}
            >
              <div className={`text-xs font-medium mb-1 ${isToday ? "text-primary" : ""}`}>{d.getDate()}</div>
              <div className="space-y-0.5">
                {evts.slice(0, 3).map((e) => {
                  const course = courses.find((c) => c.id === e.course_id);
                  const cc = course ? courseColor(course.color) : null;
                  return (
                    <div key={e.id} className={`text-[10px] truncate rounded px-1 py-0.5 ${cc ? `${cc.soft} ${cc.text}` : "bg-muted text-muted-foreground"}`}>
                      {e.title}
                    </div>
                  );
                })}
                {evts.length > 3 && <div className="text-[10px] text-muted-foreground px-1">+{evts.length - 3} more</div>}
              </div>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground mt-3">Click any day to open it in the day view.</p>
    </div>
  );
}