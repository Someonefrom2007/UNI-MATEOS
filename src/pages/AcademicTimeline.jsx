// Academic Timeline — a semester-level, week-by-week view of the term. The
// term window and every week bucket come strictly from real user rows via
// buildWeeks in @/lib/academicTimeline: exams by `date`, task deadlines by
// `due_date`, scheduled classes by their event `date`. Weeks only exist where
// real dated rows put them (plus the current week); no week and no item is
// ever fabricated. Pure + node-safe helpers, thin page wrapper.
import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  CalendarRange,
  CalendarDays,
  ChevronRight,
  GraduationCap,
  CheckSquare,
  Sparkles,
} from "lucide-react";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import { Card } from "@/components/ui/card";
import { useUserData } from "@/lib/useUserData";
import { useI18n } from "@/lib/i18n";
import { todayISO, courseColor } from "@/lib/format";
import { buildWeeks } from "@/lib/academicTimeline";

const KIND_META = {
  exam: { Icon: GraduationCap, cls: "text-hud-rose", to: "/exams" },
  task: { Icon: CheckSquare, cls: "text-hud-amber", to: "/tasks" },
  class: { Icon: CalendarDays, cls: "text-hud-emerald", to: "/schedule" },
};

const itemISO = (kind, row) =>
  kind === "exam" ? row.date : kind === "task" ? row.due_date : row.date;

const itemTitle = (kind, row) => {
  if (kind === "exam") return row.name || row.title || "";
  if (kind === "task") return row.title || row.name || "";
  return row.title || row.name || "";
};

export default function AcademicTimeline() {
  const { data, loading, error, refresh } = useUserData();
  const { t } = useI18n();
  const today = todayISO();

  const weeks = useMemo(() => {
    if (!data) return [];
    const items = [];
    (data.Exam || []).forEach((e) => e.date && items.push({ iso: e.date, kind: "exam", row: e }));
    (data.Task || []).forEach((tk) => tk.due_date && items.push({ iso: tk.due_date, kind: "task", row: tk }));
    (data.ScheduleEvent || []).forEach((ev) => ev.date && items.push({ iso: ev.date, kind: "class", row: ev }));
    if (items.length === 0) return [];
    return buildWeeks({ items, nowISO: today }).map((w) => ({
      ...w,
      rows: items.filter((it) => it.iso >= w.start && it.iso <= w.end),
    }));
  }, [data, today]);

  const current = weeks.find((w) => w.isCurrent);
  const upcomingCount = weeks.filter((w) => w.isFuture).reduce((n, w) => n + w.rows.length, 0);

  return (
    <div className="p-6">
      <PageHeader title={t("timeline.title")} subtitle={t("timeline.subtitle")} />

      {loading && <p className="text-sm text-muted-foreground">{t("common.loading")}</p>}
      {error && (
        <EmptyState
          title={t("timeline.errorTitle")}
          description={t("timeline.errorDesc")}
          actionLabel={t("common.retry")}
          onAction={refresh}
        />
      )}

      {!loading && !error && weeks.length === 0 && (
        <EmptyState
          title={t("timeline.emptyTitle")}
          description={t("timeline.emptyDesc")}
          actionLabel={t("nav.schedule")}
          actionTo="/schedule"
        />
      )}

      {!loading && !error && weeks.length > 0 && (
        <>
          {current && current.rows.length > 0 && (
            <Card className="p-5 mb-6 ring-1 ring-hud-emerald/40 bg-hud-emerald/5">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-hud-emerald" />
                <span className="um-label text-hud-emerald">
                  {t("timeline.thisWeek")} · {current.label}
                </span>
              </div>
              <ul className="space-y-1.5">
                {current.rows.map((it, i) => {
                  const meta = KIND_META[it.kind];
                  const Icon = meta.Icon;
                  const title = itemTitle(it.kind, it.row);
                  return (
                    <li key={`${current.start}-${i}`}>
                      <Link
                        to={meta.to}
                        className="flex items-center gap-3 text-sm hover:bg-muted/50 rounded-lg px-2 py-1.5 transition-colors"
                      >
                        <Icon className={`w-4 h-4 shrink-0 ${meta.cls}`} />
                        <span className="truncate">{title}</span>
                        <span className="ml-auto text-xs hud-mono text-muted-foreground">{it.iso}</span>
                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}

          <div className="space-y-3">
            {weeks.map((w) => (
              <Card key={w.start} className={`p-4 ${w.isCurrent ? "ring-1 ring-hud-emerald/40 border-hud-emerald/40" : ""}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <CalendarDays className={`w-4 h-4 ${w.isCurrent ? "text-hud-emerald" : "text-muted-foreground"}`} />
                    <span className="font-display font-semibold text-sm">{w.label}</span>
                    {w.isCurrent && <span className="um-label text-hud-emerald">{t("timeline.now")}</span>}
                  </div>
                  <span className="text-xs hud-mono text-muted-foreground">
                    {w.start} → {w.end}
                  </span>
                </div>

                {w.rows.length === 0 ? (
                  <p className="text-xs text-muted-foreground pl-6">{t("timeline.quiet")}</p>
                ) : (
                  <ul className="space-y-1.5">
                    {w.rows.map((it, i) => {
                      const meta = KIND_META[it.kind];
                      const Icon = meta.Icon;
                      const title = itemTitle(it.kind, it.row);
                      const course = it.row.course_id
                        ? (data.Course || []).find((c) => c.id === it.row.course_id)
                        : null;
                      return (
                        <li key={`${w.start}-${i}`}>
                          <Link
                            to={meta.to}
                            className="flex items-center gap-3 text-sm rounded-lg px-2 py-1.5 hover:bg-muted/50 transition-colors group"
                          >
                            <Icon className={`w-4 h-4 shrink-0 ${meta.cls}`} />
                            <span className="min-w-0 flex-1 truncate">{title}</span>
                            {course && (
                              <span className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
                                <span className={`w-2 h-2 rounded-full ${courseColor(course.color)}`} />
                                {course.name}
                              </span>
                            )}
                            <span className="text-xs hud-mono text-muted-foreground shrink-0">{it.iso}</span>
                            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50 group-hover:text-foreground" />
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
