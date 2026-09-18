import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Play, Sparkles, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fmtDuration, daysUntil, courseColor } from "@/lib/format";
import { useI18n } from "@/lib/i18n";

// The dashboard's focal point — one clear, explainable answer to
// "what matters now". Never fabricates: falls back to the next class,
// or an honest all-clear.
export default function SpotlightCard({ rec, nc, courses, exams, className = "" }) {
  const navigate = useNavigate();
  const { t } = useI18n();
  const exam = rec?.kind === "exam" ? exams.find((e) => e.id === rec.examId) : null;
  const days = exam ? daysUntil(exam.date) : null;
  const fill = days !== null ? Math.min(100, Math.max(3, ((14 - days) / 14) * 100)) : 0;
  const course = rec?.course || (nc ? courses.find((c) => c.id === nc.course_id) : null);
  const cc = course ? courseColor(course.color) : null;
  const label = rec ? t("dash.whatMattersNow") : nc ? t("dash.nextUp") : t("dash.allClear");
  const Icon = rec ? Sparkles : CalendarDays;

  return (
    <div className={`relative overflow-hidden rounded-2xl void-surface p-6 sm:p-8 flex flex-col h-full ${className}`}>
      <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.05] via-transparent to-transparent" aria-hidden />
      <div className="pointer-events-none absolute -right-20 -top-24 w-72 h-72 rounded-full bg-foreground/[0.03] blur-[90px]" aria-hidden />
      <div className="relative flex items-center gap-2">
        <Icon className="w-4 h-4 text-primary" />
        <span className="um-label">{label}</span>
      </div>

      {rec ? (
        <>
          <h2 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight mt-4 leading-tight">{rec.title}</h2>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            {cc && course && (
              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md font-medium ${cc.soft} ${cc.text}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${cc.dot}`} />{course.code || course.name}
              </span>
            )}
            <span className="px-2 py-0.5 rounded-md bg-muted text-muted-foreground">≈ {fmtDuration(rec.estimate)}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-3">{rec.reason}</p>

          {exam && days !== null && days >= 0 && (
            <div className="mt-5">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1.5">
                <span>{days === 0 ? t("dash.examToday") : days === 1 ? t("dash.examTomorrow") : t("dash.examInDays", { n: days })}</span>
                <span>{t("dash.prepWindow")}</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-primary"
                  initial={{ width: 0 }}
                  animate={{ width: `${fill}%` }}
                  transition={{ duration: 0.9, ease: "easeOut", delay: 0.35 }}
                />
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2 mt-6 pt-5 border-t border-border/60 mt-auto">
            <Button size="sm" onClick={() => navigate("/focus")}><Play className="w-3.5 h-3.5 mr-1.5" />{t("dash.startFocus")}</Button>
            {rec.kind === "exam" && <Button size="sm" variant="outline" onClick={() => navigate(`/exams/${rec.examId}`)}>{t("dash.viewExam")}</Button>}
            {rec.kind === "task" && <Button size="sm" variant="outline" onClick={() => navigate("/tasks")}>{t("dash.viewTask")}</Button>}
          </div>
        </>
      ) : nc ? (
        <>
          <h2 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight mt-4 leading-tight">{nc.title}</h2>
          {nc.room && <p className="text-sm text-muted-foreground mt-2">{t("dash.room", { room: nc.room })}</p>}
          <div className="mt-5 flex items-baseline gap-3">
            <span className="font-mono text-3xl font-semibold">{nc.start_time?.slice(0, 5)}</span>
            <span className="text-sm text-primary">{nc.when === "today" ? t("dash.today").toLowerCase() : nc.when}</span>
          </div>
          <div className="flex gap-2 mt-6 pt-5 border-t border-border/60 mt-auto">
            <Button size="sm" onClick={() => navigate("/schedule")}>{t("dash.viewSchedule")}</Button>
            <Button size="sm" variant="outline" onClick={() => navigate("/focus")}><Play className="w-3.5 h-3.5 mr-1.5" />Start focus</Button>
          </div>
        </>
      ) : (
        <>
          <h2 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight mt-4 leading-tight">{t("dash.nothingNeedsYou")}</h2>
          <p className="text-sm text-muted-foreground mt-3">{t("dash.nothingNeedsYou.body")}</p>
          <div className="flex gap-2 mt-6 pt-5 border-t border-border/60 mt-auto">
            <Button size="sm" onClick={() => navigate("/focus")}><Play className="w-3.5 h-3.5 mr-1.5" />{t("dash.startSession")}</Button>
          </div>
        </>
      )}
    </div>
  );
}