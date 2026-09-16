import { useMemo } from "react";
import { eventsForDate, DAY_SHORT, durationMin, detectConflicts } from "@/lib/scheduleEngine";
import { courseColor, fmtTimeShort } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

const HOURS = Array.from({ length: 14 }, (_, i) => i + 8); // 8:00 - 21:00

export default function WeekView({ anchor, events, courses, todayStr }) {
  const weekStart = useMemo(() => {
    const d = new Date(anchor);
    d.setDate(d.getDate() - d.getDay());
    d.setHours(0, 0, 0, 0);
    return d;
  }, [anchor]);

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  }), [weekStart]);

  const conflicts = useMemo(() => {
    const all = [];
    weekDays.forEach((d) => {
      const ds = d.toISOString().slice(0, 10);
      detectConflicts(events, ds).forEach((c) => all.push(c));
    });
    return all;
  }, [events, weekDays]);

  return (
    <>
      {conflicts.length > 0 && (
        <Card aria-live="polite" className="p-4 mb-4 border-hud-amber/30 bg-hud-amber/5">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-hud-amber" />
            <span className="um-label">Schedule conflict</span>
          </div>
          {conflicts.map((c, i) => (
            <div key={i} className="text-sm">
              <span className="font-medium">{c.a.title}</span> ({c.a.start_time}–{c.a.end_time}) overlaps with <span className="font-medium">{c.b.title}</span> ({c.b.start_time}–{c.b.end_time}) on {new Date(c.dateStr + "T00:00:00").toLocaleDateString(undefined, { weekday: "long" })}.
            </div>
          ))}
        </Card>
      )}

      <div className="grid grid-cols-[60px_repeat(7,1fr)] gap-1 overflow-x-auto timeline-grid-44">
        <div />
        {weekDays.map((d, i) => {
          const ds = d.toISOString().slice(0, 10);
          const isToday = ds === todayStr;
          return (
            <div key={i} className={`text-center py-2 rounded-lg ${isToday ? "bg-primary/10 ring-1 ring-hud-cyan/40 shadow-[0_0_12px_rgba(34,211,238,0.15)]" : ""}`}>
              <div className={`text-[10px] uppercase tracking-wider ${isToday ? "text-hud-cyan" : "text-muted-foreground"}`}>{DAY_SHORT[d.getDay()]}</div>
              <div className={`text-sm font-medium ${isToday ? "text-hud-cyan" : ""}`}>{d.getDate()}</div>
            </div>
          );
        })}

        {HOURS.map((h) => (
          <DayRow key={h} hour={h} weekDays={weekDays} events={events} courses={courses} todayStr={todayStr} />
        ))}
      </div>
    </>
  );
}

function DayRow({ hour, weekDays, events, courses, todayStr }) {
  return (
    <>
      <div className="text-[10px] text-muted-foreground text-right pr-1 pt-1 font-mono">{hour}:00</div>
      {weekDays.map((d, i) => {
        const ds = d.toISOString().slice(0, 10);
        const isToday = ds === todayStr;
        const dayEvents = eventsForDate(events, ds).filter((e) => {
          if (!e.start_time) return false;
          const sh = parseInt(e.start_time.split(":")[0], 10);
          return sh === hour;
        });
        return (
          <div key={i} className={`min-h-[44px] border border-border/50 rounded relative ${isToday ? "bg-primary/5 shadow-[inset_0_0_18px_rgba(34,211,238,0.06)]" : ""}`}>
            {dayEvents.map((e) => {
              const course = courses.find((c) => c.id === e.course_id);
              const cc = course ? courseColor(course.color) : null;
              const dur = e.end_time ? durationMin(e.start_time, e.end_time) : 30;
              const heightPx = Math.max(44, (dur / 60) * 44);
              return (
                <div key={e.id} className={`absolute inset-x-0.5 top-0.5 rounded px-1.5 py-1 text-[10px] leading-tight overflow-hidden ${cc ? `${cc.soft} ${cc.text} border ${cc.ring}` : "bg-muted border border-border"}`} style={{ height: `${heightPx}px` }}>
                  <div className="font-medium truncate">{e.title}</div>
                  <div className="opacity-70 truncate">{fmtTimeShort(e.start_time)}</div>
                </div>
              );
            })}
          </div>
        );
      })}
    </>
  );
}