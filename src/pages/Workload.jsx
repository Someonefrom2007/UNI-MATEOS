import { useMemo } from "react";
import { useUserData } from "@/lib/useUserData";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import { fmtDuration, courseColor, todayISO } from "@/lib/format";
import { weekWorkload } from "@/lib/workloadEngine";
import { activeTasks } from "@/lib/taskEdit";
import { Card } from "@/components/ui/card";
import { Gauge, AlertTriangle } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import ErrorState from "@/components/ErrorState";
import RescueWeekPanel from "@/components/RescueWeekPanel";

const DAY_KEYS = ["dow.mon", "dow.tue", "dow.wed", "dow.thu", "dow.fri", "dow.sat", "dow.sun"];

export default function Workload() {
  const { data, loading, error, refresh, mutate } = useUserData();
  const { t } = useI18n();

  const weekStart = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() - d.getDay()); d.setHours(0, 0, 0, 0);
    // Local date, not UTC — `toISOString` shifts the week by a day for students
    // west of UTC and put Monday's work in the previous week's bucket.
    return todayISO(d);
  }, []);

  const wl = useMemo(() => {
    if (!data) return { total: 0, breakdown: [] };
    return weekWorkload(activeTasks(data.Task), data.Exam, data.FocusSession, data.Course.filter((c) => !c.archived), weekStart);
  }, [data, weekStart]);

  const byDay = useMemo(() => {
    if (!data) return Array(7).fill(0);
    const days = Array(7).fill(0);
    activeTasks(data.Task).filter((t) => t.status !== "completed" && t.due_date).forEach((t) => {
      const due = new Date(t.due_date + "T00:00:00");
      const ws = new Date(weekStart + "T00:00:00");
      const diff = Math.floor((due.getTime() - ws.getTime()) / 86400000);
      if (diff >= 0 && diff < 7) days[diff] += t.estimated_duration || 30;
    });
    return days;
  }, [data, weekStart]);

  const maxDay = Math.max(...byDay, 1);
  const heavy = wl.total > 600; // >10h

  if (error) return <ErrorState onRetry={refresh} />;

  if (!loading && data && activeTasks(data.Task).length === 0) {
    return (
      <>
        <PageHeader title={t("title.workload")} subtitle={t("title.workload.subtitle")} />
        <EmptyState icon={Gauge} title={t("workload.empty.title")} description={t("workload.empty.body")} actionLabel={t("rescue.empty.action")} actionTo="/tasks" />
      </>
    );
  }

  return (
    <>
      <PageHeader title={t("title.workload")} subtitle={t("title.workload.subtitle")} />

      {heavy && (
        <Card className="p-4 mb-4 border-hud-amber/30 bg-hud-amber/5">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-hud-amber" />
            <span className="text-sm font-medium">{t("workload.high")}</span>
          </div>
          <p className="text-xs text-muted-foreground">{t("workload.high.hint", { duration: fmtDuration(wl.total), count: wl.breakdown.length })}</p>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="p-5">
          <div className="um-label mb-2">{t("workload.thisWeek")}</div>
          <div className="font-display text-4xl font-semibold">{fmtDuration(wl.total)}</div>
          <p className="text-xs text-muted-foreground mt-1">{t("workload.estimated")}</p>
        </Card>

        <Card className="lg:col-span-2 p-5">
          <div className="um-label mb-4">{t("workload.byDay")}</div>
          <div className="flex items-end justify-between gap-2 h-40">
            {byDay.map((mins, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full bg-muted rounded-t-lg flex items-end" style={{ height: "100%" }}>
                  <div className="w-full bg-gradient-to-t from-primary to-amber-400 rounded-t-lg transition-all" style={{ height: `${(mins / maxDay) * 100}%`, minHeight: mins > 0 ? "8px" : "0" }} title={fmtDuration(mins)} />
                </div>
                <span className="text-[10px] text-muted-foreground">{t(DAY_KEYS[i])}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="p-5 mt-5">
        <div className="um-label mb-4">{t("workload.byCourse")}</div>
        {wl.breakdown.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("workload.none")}</p>
        ) : (
          <div className="space-y-3">
            {wl.breakdown.map((b) => {
              const cc = b.course ? courseColor(b.course.color) : courseColor("amber");
              return (
                <div key={b.course_id}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="flex items-center gap-2"><span className={`w-2 h-2 rounded-full ${cc.dot}`} />{b.course?.name || t("workload.other")}</span>
                    <span className="text-muted-foreground">{fmtDuration(b.minutes)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className={`h-full rounded-full ${cc.dot}`} style={{ width: `${(b.minutes / wl.total) * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <div className="mt-6">
        <RescueWeekPanel data={data} mutate={mutate} todayStr={todayISO()} />
      </div>
    </>
  );
}