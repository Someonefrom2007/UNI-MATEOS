import { useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import PageSkeleton from "@/components/PageSkeleton";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { useI18n } from "@/lib/i18n";
import { useUserData } from "@/lib/useUserData";
import { buildRescuePlan } from "@/lib/rescuePlan";
import { freeBlocks, durationMin } from "@/lib/scheduleEngine";
import { addMinutes } from "@/lib/planner";
import { fmtDuration } from "@/lib/format";
import { LifeBuoy, CalendarPlus, AlertTriangle, Sparkles, Clock, CheckCircle2 } from "lucide-react";

const TONE_META = {
  clear: { label: "Clear", cls: "bg-hud-emerald/10 text-hud-emerald border-hud-emerald/30" },
  recovering: { label: "Recoverable", cls: "bg-hud-cyan/10 text-hud-cyan border-hud-cyan/30" },
  overloaded: { label: "Overloaded", cls: "bg-hud-amber/10 text-hud-amber border-hud-amber/30" },
};

const toneMeta = (tone) => TONE_META[tone] || TONE_META.recovering;

const dayLabel = (date) => {
  const d = new Date(`${String(date).slice(0, 10)}T00:00:00`);
  return d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
};

// Allocates the plan items of a day into real free blocks (front to back) so
// the scheduled events never overlap. Falls back to null when a block is gone.
const allocateDay = (events, date, items) => {
  const blocks = freeBlocks(events, date).map((b) => ({ start: b.start, end: b.end }));
  const slots = [];
  items.forEach((item) => {
    const idx = blocks.findIndex((b) => durationMin(b.start, b.end) >= item.minutes);
    if (idx === -1) return;
    const block = blocks[idx];
    slots.push({ item, start: block.start, end: addMinutes(block.start, item.minutes) });
    block.start = addMinutes(block.start, item.minutes);
  });
  return slots;
};

export default function RescueWeek() {
  const { t } = useI18n();
  const { toast } = useToast();
  const { data, loading, error, mutate } = useUserData();
  const [adopting, setAdopting] = useState(false);

  const events = data?.ScheduleEvent || [];
  const tasks = data?.Task || [];
  const exams = data?.Exam || [];
  const courses = data?.Course || [];

  const plan = useMemo(
    () => buildRescuePlan({ tasks, exams, events }),
    [tasks, exams, events]
  );

  if (loading || !data) return <PageSkeleton />;

  if (error) {
    return (
      <EmptyState
        title="Rescue unavailable"
        description="We couldn't load your courses right now. Check the console and try again."
        actionLabel="Retry"
        onAction={() => window.location.reload()}
        icon={AlertTriangle}
      />
    );
  }

  if (plan.summary.loadNeeded === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title={t("title.rescue")} subtitle={t("title.rescue.subtitle")} />
        <EmptyState
          title="Nothing to rescue"
          description="No open tasks or upcoming exams inside the window. Use the space to get ahead."
          actionLabel="Go to tasks"
          actionTo="/tasks"
          icon={CheckCircle2}
        />
      </div>
    );
  }

  const tone = toneMeta(plan.recommendation.tone);
  const pct = () => {
    if (!plan.summary.loadNeeded) return 0;
    return Math.round((plan.summary.plannedMinutes / plan.summary.loadNeeded) * 100);
  };

  const adopt = async () => {
    const total = plan.days.reduce((s, d) => s + d.items.length, 0);
    if (total === 0) return;
    if (!window.confirm(`Add ${total} study block${total === 1 ? "" : "s"} to your schedule?`)) return;
    setAdopting(true);
    try {
      let count = 0;
      for (const day of plan.days) {
        const slots = allocateDay(events, day.date, day.items);
        for (const s of slots) {
          const course = courses.find((c) => c.id === s.item.courseId);
          await mutate("ScheduleEvent", "create", {
            title: s.item.title,
            type: "study",
            date: day.date,
            start_time: s.start,
            end_time: s.end,
            course_id: s.item.courseId || null,
            room: course ? course.name : "",
            recurring: false,
          });
          count += 1;
        }
      }
      toast({ title: `Scheduled ${count} study blocks`, description: "They now live on your schedule like any other class." });
    } catch (err) {
      toast({ title: "Couldn't add the plan to your schedule", description: err.message || "Try again." });
    } finally {
      setAdopting(false);
    }
  };

  const stats = [
    { label: t("rescue.needed"), value: fmtDuration(plan.summary.loadNeeded), icon: Clock, cls: "text-foreground" },
    { label: t("rescue.available"), value: fmtDuration(plan.summary.availableTotal), icon: CalendarPlus, cls: "text-hud-cyan" },
    { label: t("rescue.planned"), value: fmtDuration(plan.summary.plannedMinutes), icon: Sparkles, cls: "text-hud-emerald" },
    { label: t("rescue.overload"), value: String(plan.summary.overloadedCount), icon: AlertTriangle, cls: plan.summary.feasible ? "text-foreground" : "text-hud-amber" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t("title.rescue")} subtitle={t("title.rescue.subtitle")}>
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium ${tone.cls}`}>
            <LifeBuoy className="w-4 h-4" />
            {tone.label}
          </span>
          <Button onClick={adopt} disabled={adopting || plan.summary.itemsPlanned === 0}>
            <CalendarPlus className="w-4 h-4 mr-1.5" />
            {adopting ? "Adding…" : t("rescue.adopt")}
          </Button>
        </div>
      </PageHeader>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label} className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider text-muted-foreground">{s.label}</span>
                <Icon className={`w-4 h-4 ${s.cls}`} />
              </div>
              <p className="font-display text-2xl font-semibold mt-1">{s.value}</p>
            </Card>
          );
        })}
      </div>

      <Card className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-primary" />
          <h2 className="font-display text-base font-semibold">{plan.recommendation.headline}</h2>
        </div>
        <ul className="space-y-1.5">
          {plan.recommendation.lines.map((line, i) => (
            <li key={i} className="text-sm text-muted-foreground">· {line}</li>
          ))}
        </ul>
        <div className="mt-4 h-2 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${plan.summary.feasible ? "bg-hud-emerald" : "bg-hud-amber"}`}
            style={{ width: `${Math.min(100, pct())}%` }}
          />
        </div>
      </Card>

      <div className="space-y-3">
        {plan.days.map((day) => (
          <Card key={day.date} className="p-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="font-medium">{dayLabel(day.date)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t("rescue.availableShort")}: {fmtDuration(day.available)}
                  {day.planned > 0 && ` · ${t("rescue.plannedShort")}: ${fmtDuration(day.planned)}`}
                </p>
              </div>
              <div className="w-32 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full ${day.planned > day.available ? "bg-hud-amber" : "bg-hud-cyan"}`}
                  style={{ width: `${day.available ? Math.min(100, (day.planned / day.available) * 100) : 0}%` }}
                />
              </div>
            </div>
            {day.items.length > 0 ? (
              <ul className="mt-3 space-y-2">
                {day.items.map((item) => (
                  <li key={`${day.date}-${item.id}`} className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-secondary/40 px-3 py-2">
                    <span className="text-sm truncate">{item.title}</span>
                    <span className="shrink-0 text-xs font-mono text-muted-foreground">{fmtDuration(item.minutes)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">{t("rescue.dayFree")}</p>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}