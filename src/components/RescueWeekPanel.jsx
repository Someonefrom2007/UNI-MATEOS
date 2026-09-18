import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import EmptyState from "@/components/EmptyState";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useToast } from "@/components/ui/use-toast";
import { buildRescuePlan } from "@/lib/rescuePlan";
import { fmtDuration, courseColor, longDate } from "@/lib/format";
import { activeTasks } from "@/lib/taskEdit";
import { DAY_SHORT } from "@/lib/scheduleEngine";
import { LifeBuoy, CalendarPlus, AlertTriangle, Clock, CheckCircle2 } from "lucide-react";

const dowOf = (dateStr) => new Date(dateStr + "T00:00:00").getDay();

/**
 * Rescue My Week — reads the student's real tasks, exams and schedule, then
 * shows the study sessions it would book and the work that will not fit.
 *
 * Nothing is written until the student presses Apply, and applying only ever
 * *adds* sessions: existing commitments are never moved or deleted.
 */
export default function RescueWeekPanel({ data, mutate, todayStr }) {
  const { toast } = useToast();
  const [applying, setApplying] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [applied, setApplied] = useState(0);

  const plan = useMemo(() => {
    if (!data) return null;
    return buildRescuePlan({
      tasks: activeTasks(data.Task),
      exams: data.Exam || [],
      events: data.ScheduleEvent || [],
      courses: (data.Course || []).filter((c) => !c.archived),
      todayStr,
      days: 7,
    });
  }, [data, todayStr]);

  const apply = async () => {
    setApplying(true);
    try {
      let count = 0;
      for (const s of plan.sessions) {
        const course = s.courseId ? plan.courseById[s.courseId] : null;
        await mutate("ScheduleEvent", "create", {
          title: s.title,
          type: "study",
          date: s.date,
          start_time: s.start,
          end_time: s.end,
          course_id: s.courseId || null,
          room: course ? course.name : "",
          recurring: false,
        });
        count++;
      }
      setApplied(count);
      toast({
        title: count > 0 ? `Added ${count} study session${count === 1 ? "" : "s"} to your week` : "Nothing to add",
      });
      setConfirming(false);
    } catch (err) {
      toast({ title: "Couldn't add the sessions", description: err?.message || "Please try again." });
    } finally {
      setApplying(false);
    }
  };

  if (!plan) return null;

  if (!plan.hasWork) {
    return (
      <EmptyState
        icon={LifeBuoy}
        title="Nothing to rescue"
        description="You have no outstanding work with a deadline. Add tasks or exams with dates and UNI·MATE can build you a study week."
        actionLabel="Add Task"
        actionTo="/tasks"
      />
    );
  }

  const byDay = plan.days
    .map((ds) => ({ ds, sessions: plan.sessions.filter((s) => s.date === ds) }))
    .filter((d) => d.sessions.length > 0);

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h3 className="um-label flex items-center gap-2">
              <LifeBuoy className="w-4 h-4" /> Rescue my week
            </h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-prose">
              Built from your {activeTasks(data.Task).length} open task{activeTasks(data.Task).length === 1 ? "" : "s"} and{" "}
              {(data.Exam || []).filter((e) => e.status !== "completed" && e.date).length} upcoming exam
              {(data.Exam || []).filter((e) => e.status !== "completed" && e.date).length === 1 ? "" : "s"},
              fitted into the free time your schedule actually has. Nothing is moved — sessions are only added.
            </p>
          </div>
          {plan.sessions.length > 0 && (
            <Button size="sm" onClick={() => setConfirming(true)} disabled={applying}>
              <CalendarPlus className="w-3.5 h-3.5 mr-1.5" />
              Add {plan.sessions.length} session{plan.sessions.length === 1 ? "" : "s"}
            </Button>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3 mt-5 pt-4 border-t border-border">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Work to place</div>
            <div className="font-display text-2xl font-medium tabular-nums mt-0.5">{fmtDuration(plan.demandTotal)}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Free this week</div>
            <div className="font-display text-2xl font-medium tabular-nums mt-0.5">{fmtDuration(plan.capacityTotal)}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Planned</div>
            <div className={`font-display text-2xl font-medium tabular-nums mt-0.5 ${plan.unplaced.length ? "text-hud-amber" : "text-hud-emerald"}`}>
              {fmtDuration(plan.placedTotal)}
            </div>
          </div>
        </div>

        {plan.unplaced.length > 0 ? (
          <div className="mt-4 p-3 rounded-lg border border-hud-amber/30 bg-hud-amber/5">
            <p className="flex items-start gap-2 text-sm">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-hud-amber" />
              <span>
                {fmtDuration(plan.unplaced.reduce((s, u) => s + u.remaining, 0))} of work does not fit in this week's free time.
                {" "}That is a real overload, not a scheduling problem — the options below show what moving a deadline would buy.
              </span>
            </p>
          </div>
        ) : (
          <p className="mt-4 flex items-center gap-2 text-sm text-hud-emerald">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            Everything fits inside your free time this week.
          </p>
        )}
      </Card>

      {applied > 0 && (
        <Card className="p-4 border-hud-emerald/30 bg-hud-emerald/5">
          <p className="text-sm">
            Added {applied} study session{applied === 1 ? "" : "s"} to your schedule.{" "}
            <Link to="/schedule" className="underline underline-offset-2">Open your week</Link> to adjust them.
          </p>
        </Card>
      )}

      {byDay.length > 0 && (
        <Card className="p-5">
          <div className="um-label mb-3">Proposed week</div>
          <div className="space-y-4">
            {byDay.map(({ ds, sessions }) => (
              <div key={ds}>
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-medium">{DAY_SHORT[dowOf(ds)]} · {ds}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {fmtDuration(sessions.reduce((s, x) => s + x.minutes, 0))}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {sessions.map((s, i) => {
                    const course = s.courseId ? plan.courseById[s.courseId] : null;
                    const cc = courseColor(course?.color || "amber");
                    return (
                      <div key={`${s.date}-${s.start}-${i}`} className="flex items-center gap-3 p-2 rounded-lg border border-border bg-card">
                        <span className={`w-1.5 h-6 rounded-full shrink-0 ${cc.dot}`} />
                        <span className="text-xs tabular-nums text-muted-foreground shrink-0 w-24">
                          {s.start}–{s.end}
                        </span>
                        <span className="text-sm flex-1 min-w-0 truncate">{s.title}</span>
                        {s.overdue && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded border border-hud-rose/30 bg-rose-500/10 text-hud-rose shrink-0">
                            overdue
                          </span>
                        )}
                        <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums">{fmtDuration(s.minutes)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {plan.unplaced.length > 0 && (
        <Card className="p-5">
          <div className="um-label mb-1">Won't fit</div>
          <p className="text-xs text-muted-foreground mb-3">
            Work with no room left before its deadline. Moving a deadline by the amount shown is what would make it fit —
            UNI·MATE will not change it for you.
          </p>
          <div className="space-y-2">
            {plan.unplaced.map((u) => {
              const course = u.courseId ? plan.courseById[u.courseId] : null;
              const deferral = plan.deferrals.find((d) => d.refId === u.refId && d.kind === u.kind);
              return (
                <div key={`${u.kind}-${u.refId}`} className="flex items-center gap-3 p-2.5 rounded-lg border border-border bg-card flex-wrap">
                  <Clock className="w-4 h-4 text-hud-amber shrink-0" />
                  <span className="text-sm flex-1 min-w-0 truncate">{u.title}</span>
                  {course && <span className="text-[10px] text-muted-foreground shrink-0">{course.code || course.name}</span>}
                  <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums">due {u.deadline}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded border border-hud-amber/30 bg-amber-500/10 text-hud-amber shrink-0 tabular-nums">
                    {fmtDuration(u.remaining)} short
                  </span>
                  {deferral && (
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      needs ~{deferral.extendByDays}d more → {deferral.suggestedDeadline}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title={`Add ${plan.sessions.length} study session${plan.sessions.length === 1 ? "" : "s"}?`}
        description={`This adds ${fmtDuration(plan.placedTotal)} of study time to your schedule, starting ${longDate().toLowerCase()}. Your existing classes and events are not moved.`}
        confirmLabel="Add sessions"
        tone="amber"
        busy={applying}
        onConfirm={apply}
      />
    </div>
  );
}
