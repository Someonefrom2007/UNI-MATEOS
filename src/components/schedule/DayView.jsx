import { eventsForDate, durationMin, detectConflicts } from "@/lib/scheduleEngine";
import { courseColor, fmtTimeShort, PRIORITY_META } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { AlertTriangle, GraduationCap, CheckSquare } from "lucide-react";

const HOURS = Array.from({ length: 14 }, (_, i) => i + 8); // 8:00 - 21:00
const ROW_H = 56; // px per hour

export default function DayView({ date, events, courses, tasks, exams, todayStr }) {
  const ds = date.toISOString().slice(0, 10);
  const dayEvents = eventsForDate(events, ds)
    .filter((e) => e.start_time)
    .sort((a, b) => a.start_time.localeCompare(b.start_time));
  const conflicts = detectConflicts(events, ds);
  const dueTasks = tasks.filter((t) => t.due_date === ds);
  const dayExams = exams.filter((e) => e.date === ds);

  const topFor = (t) => {
    const [h, m] = t.split(":").map(Number);
    return (h - 8) * ROW_H + (m / 60) * ROW_H;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Timeline */}
      <div className="lg:col-span-2 rounded-xl border border-border overflow-hidden">
        <div className="relative timeline-grid-56 bg-card/40" style={{ height: HOURS.length * ROW_H }}>
          {HOURS.map((h, i) => (
            <div key={h} className="absolute inset-x-0 flex items-start" style={{ top: i * ROW_H }}>
              <div className="w-14 shrink-0 text-[10px] font-mono text-muted-foreground pl-2 pt-1">{h}:00</div>
              <div className="flex-1 border-t border-border/40" />
            </div>
          ))}
          {dayEvents.map((e) => {
            const course = courses.find((c) => c.id === e.course_id);
            const cc = course ? courseColor(course.color) : null;
            const dur = e.end_time ? durationMin(e.start_time, e.end_time) : 60;
            const heightPx = Math.max(30, (dur / 60) * ROW_H - 4);
            return (
              <div
                key={e.id}
                className={`absolute rounded-lg px-2.5 py-1.5 border overflow-hidden ${cc ? `${cc.soft} ${cc.text} ${cc.ring}` : "bg-muted text-foreground border-border"}`}
                style={{ top: topFor(e.start_time) + 2, height: `${heightPx}px`, left: "3.75rem", right: "0.25rem" }}
              >
                <div className="text-sm font-semibold truncate">{e.title}</div>
                <div className="text-[11px] opacity-70 truncate">
                  {fmtTimeShort(e.start_time)} – {fmtTimeShort(e.end_time)}{e.room ? ` · ${e.room}` : ""}
                </div>
                {course && heightPx > 60 && <div className="text-[11px] opacity-70 truncate">{course.name}</div>}
              </div>
            );
          })}
          {dayEvents.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
              Nothing scheduled — a free day.
            </div>
          )}
        </div>
      </div>

      {/* Side panels */}
      <div className="space-y-4">
        {conflicts.length > 0 && (
          <Card aria-live="polite" className="p-4 border-amber-500/30 bg-amber-500/5">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span className="um-label">Conflict on this day</span>
            </div>
            {conflicts.map((c, i) => (
              <div key={i} className="text-xs">
                <span className="font-medium">{c.a.title}</span> overlaps with <span className="font-medium">{c.b.title}</span> ({c.a.start_time}–{c.a.end_time}).
              </div>
            ))}
          </Card>
        )}

        {dayExams.length > 0 && (
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <GraduationCap className="w-4 h-4 text-rose-400" />
              <span className="um-label">Exams</span>
            </div>
            {dayExams.map((e) => (
              <div key={e.id} className="text-sm font-medium">{e.name}{e.time ? ` — ${fmtTimeShort(e.time)}` : ""}</div>
            ))}
          </Card>
        )}

        {dueTasks.length > 0 && (
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckSquare className="w-4 h-4 text-amber-400" />
              <span className="um-label">Due this day</span>
            </div>
            <div className="space-y-1.5">
              {dueTasks.map((t) => {
                const pm = PRIORITY_META[t.priority];
                return (
                  <div key={t.id} className="flex items-center justify-between gap-2">
                    <span className="text-sm truncate">{t.title}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded border shrink-0 ${pm.cls}`}>{pm.label}</span>
                  </div>
                );
              })}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}