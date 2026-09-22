// Mission 15 — Attendance page. Derived ONLY — this screen never owns, mutates
// or fabricates attendance data. It reads the one real derived engine
// (src/lib/attendance.js, committed) and renders exactly what that engine
// proves: a real attended/(total-excused) ratio per course, an honest "-"
// when there is no real history (never a fabricated 0% or 100%), and an
// atRisk flag that is literally the engine's strict rate-vs-required verdict.
import { useMemo } from "react";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { useUserData } from "@/lib/useUserData";
import { useI18n } from "@/lib/i18n";
import { todayISO } from "@/lib/format";
import { buildAttendanceSummary } from "@/lib/attendance";

const rateLabel = (rate) => (rate === null ? "–" : `${Math.round(rate * 100)}%`);

export default function Attendance() {
  const { t, lang } = useI18n();
  const { data, loading, error, refresh } = useUserData();
  const attRows = data?.attendance || [];

  const summary = useMemo(() => {
    if (loading || error) return null;
    const rows = attRows;
    const courses = (data?.courses || []).map((c) => ({ id: c.id, name: c.name }));
    const requiredByCourse = Object.fromEntries(
      (data?.courses || []).map((c) => [c.id, typeof c.attendance_required === "number" ? c.attendance_required : 80])
    );
    return buildAttendanceSummary({ rows, courses, requiredByCourse, today: todayISO() });
  }, [loading, error, attRows, data]);

  if (loading) return <PageHeader title={t("attendance.title")} subtitle={t("attendance.loading")} />;
  if (error) {
    return (
      <PageHeader title={t("attendance.errorTitle")} subtitle={t("attendance.errorDesc")}>
        <button onClick={() => refresh()} className="mt-2 text-sm underline">
          {t("common.retry")}
        </button>
      </PageHeader>
    );
  }

  const summaries = summary?.summaries || [];
  const anyData = summaries.some((s) => s.rate !== null);

  return (
    <div>
      <PageHeader title={t("attendance.title")} subtitle={t("attendance.subtitle")} />
      {!anyData && (
        <Card className="p-6">
          <h3 className="font-semibold">{t("attendance.emptyTitle")}</h3>
          <p className="text-sm text-muted-foreground">{t("attendance.emptyDesc")}</p>
        </Card>
      )}
      {anyData && (
        <div className="grid gap-4 sm:grid-cols-2">
          {summaries.map((s) => (
            <Card key={s.id} className="p-4">
              <div className="flex items-baseline justify-between">
                <h3 className="font-semibold">{s.name}</h3>
                <span className="text-lg font-bold">{rateLabel(s.rate)}</span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("attendance.attendedOf")}: {s.attended ?? 0}/{s.total ?? 0}
                {s.excused > 0 && ` (+${s.excused} excused)`}
              </p>
              {s.atRisk && (
                <p className="mt-2 text-sm font-semibold text-destructive">{t("attendance.atRisk")}</p>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

