import { useEffect, useState, useCallback } from "react";
import PageHeader from "@/components/PageHeader";
import PlanLocked from "@/components/PlanLocked";
import { Card } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n";
import { usePlan } from "@/lib/usePlan";
import { getAppRepo } from "@/lib/repo/select";
import { todayISO, fmtDuration } from "@/lib/format";
import {
  studyStreaks,
  weeklyFocus,
  completionStats,
  gradeTrajectory,
  focusVelocity,
} from "@/lib/analytics";
import { Flame, Timer, CheckSquare, TrendingUp, BarChart3, ArrowUpRight, ArrowDownRight } from "lucide-react";

const repo = getAppRepo();

const listOrZero = async (table) => {
  try {
    return (await repo.list(table)) || [];
  } catch {
    return [];
  }
};

const fmtWeek = (iso) => {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

const Sparkline = ({ points, width = 180, height = 44 }) => {
  if (!points || points.length === 0) {
    return <div className="text-xs text-muted-foreground">No graded assessments yet.</div>;
  }
  const values = points.map((p) => p.avg);
  const max = Math.max(...values, 10);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const toX = (i) => (points.length === 1 ? width / 2 : (i / (points.length - 1)) * width);
  const toY = (v) => height - ((v - min) / span) * (height - 8) - 4;
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${toX(i).toFixed(1)},${toY(p.avg).toFixed(1)}`).join(" ");
  const last = points[points.length - 1];
  return (
    <svg width={width} height={height} className="mx-auto" aria-label="Grade trajectory">
      {values.slice(0, -1).map((v, i) => (
        <rect
          key={i}
          x={toX(i)}
          y={toY(Math.min(values[i], values[i + 1]))}
          width={Math.max(1, Math.abs(toX(i + 1) - toX(i)))}
          height={Math.abs(toY(values[i]) - toY(values[i + 1])) + 0.5}
          fill="rgba(16,185,129,0.12)"
        />
      ))}
      <path d={line} fill="none" stroke="rgb(16,185,129)" strokeWidth="2" strokeLinecap="round" />
      <circle cx={toX(points.length - 1)} cy={toY(last.avg)} r="3" fill="rgb(16,185,129)" />
    </svg>
  );
};

export default function Analytics() {
  const { t } = useI18n();
  const { can } = usePlan();
  const allowed = can("advanced_analytics");

  const [data, setData] = useState({ sessions: [], tasks: [], grades: [], courses: [] });

  const load = useCallback(async () => {
    const [sessions, tasks, grades, courses] = await Promise.all([
      listOrZero("focus_sessions"),
      listOrZero("tasks"),
      listOrZero("grades"),
      listOrZero("courses"),
    ]);
    setData({ sessions, tasks, grades, courses });
  }, []);

  useEffect(() => {
    // Skip the raw-table reads unless entitled. This gates the fetch, not the
    // tables: focus_sessions/tasks/grades/courses are also free-tier data, and
    // their RLS is deliberately unchanged so Grades/Focus/Courses keep working
    // for free users. `allowed` is a stable boolean dep; `can` must not be one.
    if (!allowed) return;
    load();
  }, [load, allowed]);

  if (!can("advanced_analytics")) {
    return (
      <>
        <PageHeader title={t("title.analytics")} subtitle={t("title.analytics.subtitle")} />
        <PlanLocked
          feature="advanced_analytics"
          description="Long-range numbers on the habits that move your marks: streaks, focus velocity, completion rates and grade trajectory. A Pro feature computed from your real data."
        />
      </>
    );
  }

  const today = todayISO();
  const streaks = studyStreaks(data.tasks, data.sessions, { today });
  const velocity = focusVelocity(data.sessions, { today });
  const weeks = weeklyFocus(data.sessions, { today, weeks: 8 });
  const completion = completionStats(data.tasks, { today });
  const trajectory = gradeTrajectory(data.grades, data.courses);
  const maxWeek = Math.max(...weeks.map((w) => w.minutes), 1);

  const statCard = (icon, label, value, sub, accent) => (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <span className={`w-7 h-7 rounded-lg flex items-center justify-center ${accent || "bg-muted"}`}>
          <span className="text-foreground">{icon}</span>
        </span>
        <span className="text-xs um-label">{label}</span>
      </div>
      <div className="text-2xl font-semibold mt-2">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </Card>
  );

  return (
    <>
      <PageHeader title={t("title.analytics")} subtitle={t("title.analytics.subtitle")} />
      <div className="max-w-5xl space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {statCard(<Flame className="w-4 h-4" />, "Study streak", `${streaks.current} days`, `Best: ${streaks.best}`, "bg-hud-amber/10 text-hud-amber")}
          {statCard(<Timer className="w-4 h-4" />, "Focus this week", fmtDuration(velocity.weekMinutes), `Last week ${fmtDuration(velocity.lastWeekMinutes)}`, "bg-hud-violet/10 text-hud-violet")}
          {statCard(<CheckSquare className="w-4 h-4" />, "Completion", `${completion.pct}%`, `${completion.done} of ${completion.total} done · ${completion.overdue} overdue`, "bg-hud-cyan/10 text-hud-cyan")}
          {statCard(<TrendingUp className="w-4 h-4" />, "Grade avg", trajectory.current == null ? "—" : Number(trajectory.current).toFixed(2), `${trajectory.count} assessments`, "bg-hud-emerald/10 text-hud-emerald")}
        </div>

        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="w-4 h-4 text-hud-violet" />
            <h2 className="um-label">Weekly focus minutes</h2>
            <div className="ml-auto flex items-center gap-2 text-xs">
              <span className={velocity.changePct >= 0 ? "text-hud-emerald" : "text-hud-rose"}>
                {velocity.changePct >= 0 ? <ArrowUpRight className="w-3.5 h-3.5 inline" /> : <ArrowDownRight className="w-3.5 h-3.5 inline" />}
                {Math.abs(velocity.changePct)}% vs last week
              </span>
            </div>
          </div>
          <div className="flex items-end gap-1.5 h-32">
            {weeks.map((w) => (
              <div key={w.week} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                <span className="text-[10px] text-muted-foreground">{w.minutes > 0 ? fmtDuration(w.minutes) : ""}</span>
                <div
                  className={`w-full rounded-t-md ${w.week === weeks[weeks.length - 1].week ? "bg-hud-violet/70" : "bg-violet-500/30"}`}
                  style={{ height: `${Math.max(4, (w.minutes / maxWeek) * 104)}px` }}
                />
                <span className="text-[10px] text-muted-foreground truncate w-full text-center">{fmtWeek(w.week)}</span>
              </div>
            ))}
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="p-5">
            <h2 className="um-label mb-3">Grade trajectory</h2>
            <div className="text-center">
              <Sparkline points={trajectory.points} />
            </div>
            <div className="grid grid-cols-2 gap-2 mt-4">
              <div className="rounded-xl border border-border/70 p-3">
                <div className="text-xs text-muted-foreground">Strongest course</div>
                <div className="font-semibold truncate">{trajectory.best ? `${trajectory.best.name} · ${trajectory.best.avg}` : "—"}</div>
              </div>
              <div className="rounded-xl border border-border/70 p-3">
                <div className="text-xs text-muted-foreground">Needs attention</div>
                <div className="font-semibold truncate">{trajectory.worst ? `${trajectory.worst.name} · ${trajectory.worst.avg}` : "—"}</div>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="um-label mb-3">Backlog pulse</h2>
            <div className="h-2 rounded-full bg-muted overflow-hidden mb-3">
              <div className="h-full rounded-full bg-hud-cyan transition-all" style={{ width: `${completion.pct}%` }} />
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {[
                ["Done", completion.done],
                ["In progress", completion.inProgress],
                ["Open", completion.open],
                ["Overdue", completion.overdue],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between rounded-xl border border-border/70 px-3 py-2">
                  <span className="text-muted-foreground text-xs">{label}</span>
                  <span className="font-semibold">{value}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}