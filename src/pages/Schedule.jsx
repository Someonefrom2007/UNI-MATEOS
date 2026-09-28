import { useEffect, useMemo, useState } from "react";
import { useUserData } from "@/lib/useUserData";
import { fetchICSFeed, toScheduleEventRows, diffICS, expandForImport } from "@/lib/calendarSync";
import { urgentExamsWithin, pickFreeBlock, addMinutes } from "@/lib/planner";
import { loadFeeds } from "@/lib/feedsStore";
import { getAppRepo } from "@/lib/repo/select";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarDays, CalendarPlus, ChevronLeft, ChevronRight, Plus, Zap, Clock } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useI18n } from "@/lib/i18n";
import { toLocalISO } from "@/lib/format";
import {
  EVENT_TYPES,
  TASK_STATUSES,
  courseFilterOptions,
  emptyFilters,
  toggleValue,
  hasActiveFilters,
  applyScheduleFilters,
} from "@/lib/scheduleFilters";
import QuickAdd from "@/components/QuickAdd";
import ErrorState from "@/components/ErrorState";
import CalendarSync from "@/components/schedule/CalendarSync";
import WeekView from "@/components/schedule/WeekView";
import DayView from "@/components/schedule/DayView";
import MonthView from "@/components/schedule/MonthView";
import ICSFeedDialog from "@/components/schedule/ICSFeedDialog";

const scheduleRepo = getAppRepo();

export default function Schedule() {
  const { data, loading, error, refresh, mutate } = useUserData();
  const { toast } = useToast();
  const { t } = useI18n();
  const [view, setView] = useState(() => localStorage.getItem("um-schedule-view") || "week");
  const [anchor, setAnchor] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [qaOpen, setQaOpen] = useState(false);
  const [icsOpen, setIcsOpen] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [filters, setFilters] = useState(emptyFilters);

  const events = data?.ScheduleEvent || [];
  const courses = data?.Course || [];
  const tasks = data?.Task || [];
  const exams = data?.Exam || [];
  const todayStr = toLocalISO(new Date());

  // Filters apply to what the calendar draws. Conflict banners are derived from
  // these same events, so hiding a course also hides the clashes it caused —
  // consistent with "I am not looking at that course right now".
  const filtered = useMemo(
    () => applyScheduleFilters({ events, tasks, exams }, filters),
    [events, tasks, exams, filters],
  );
  const courseOptions = useMemo(() => courseFilterOptions(courses), [courses]);
  const filtersActive = hasActiveFilters(filters);

  const toggleFacet = (facet, value) =>
    setFilters((f) => ({ ...f, [facet]: toggleValue(f[facet], value) }));

  useEffect(() => {
    if (!data) return;
    let cancelled = false;
    const syncFeeds = async () => {
      const feeds = loadFeeds();
      if (!feeds.length) return;
      let added = 0;
      for (const f of feeds) {
        try {
          const parsed = await fetchICSFeed(f.url);
          const expanded = expandForImport(parsed.events);
          const { rows } = toScheduleEventRows(expanded, f.url);
          const { toCreate } = diffICS(data.ScheduleEvent || [], rows);
          if (toCreate.length) {
            for (const row of toCreate) await scheduleRepo.create("schedule_events", row);
            added += toCreate.length;
          }
        } catch { /* offline or CORS — skip silently, keep previous imports */ }
      }
      if (!cancelled && added > 0) {
        refresh();
        toast({ title: `Calendar feeds refreshed — ${added} new events.` });
      }
    };
    syncFeeds();
    return () => { cancelled = true; };
  }, [data, refresh]);

  const urgentExams = useMemo(() => {
    if (!data) return [];
    return urgentExamsWithin(exams, { horizonDays: 3, todayStr });
  }, [exams, todayStr]);

  const autoScheduleStudy = async () => {
    if (!urgentExams.length) return;
    setScheduling(true);
    try {
      let count = 0;
      for (const exam of urgentExams) {
        const examDate = new Date(exam.date + "T00:00:00");
        const studyDays = Math.max(1, Math.ceil((examDate.getTime() - Date.now()) / 86400000));
        const estMin = exam.weight > 0 ? Math.max(60, exam.weight * 2) : 120;
        const blockMin = Math.min(60, Math.ceil(estMin / studyDays));
        for (let i = 0; i < studyDays; i++) {
          const d = new Date(examDate);
          d.setDate(d.getDate() - i);
          const dateStr = toLocalISO(d);
          const block = pickFreeBlock(events, dateStr, blockMin);
          if (block) {
            const endTime = addMinutes(block.start, blockMin);
            const course = courses.find((c) => c.id === exam.course_id);
            await mutate("ScheduleEvent", "create", {
              title: `Study: ${exam.name}`,
              type: "task",
              date: dateStr,
              start_time: block.start,
              end_time: endTime,
              course_id: exam.course_id,
              room: course ? course.name : "",
              recurring: false,
            });
            count++;
          }
        }
      }
      toast({ title: count > 0 ? `Scheduled ${count} study blocks for ${urgentExams.length} exams` : "No free slots found this week" });
    } catch (err) {
      toast({ title: "Auto-schedule failed", description: err.message || "Something went wrong." });
    } finally {
      setScheduling(false);
    }
  };

  const chooseView = (v) => {
    setView(v);
    localStorage.setItem("um-schedule-view", v);
  };

  const shift = (dir) => {
    const d = new Date(anchor);
    if (view === "day") d.setDate(d.getDate() + dir);
    else if (view === "week") d.setDate(d.getDate() + dir * 7);
    else d.setMonth(d.getMonth() + dir);
    setAnchor(d);
  };

  const label = () => {
    if (view === "day") return anchor.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
    if (view === "month") return anchor.toLocaleDateString(undefined, { month: "long", year: "numeric" });
    const ws = new Date(anchor);
    ws.setDate(ws.getDate() - ws.getDay());
    const end = new Date(ws);
    end.setDate(end.getDate() + 6);
    const sameMonth = ws.getMonth() === end.getMonth();
    return `${ws.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${end.toLocaleDateString(undefined, { month: sameMonth ? undefined : "short", day: "numeric" })}`;
  };

  if (error) return <ErrorState onRetry={refresh} />;

  return (
    <>
      <PageHeader title={t("title.schedule")} subtitle={t("title.schedule.subtitle")}>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-border p-0.5">
            {["day", "week", "month"].map((v) => (
              <button
                key={v}
                onClick={() => chooseView(v)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md capitalize transition-colors ${view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                {v}
              </button>
            ))}
          </div>
          <button onClick={() => shift(-1)} aria-label="Previous period" className="p-1.5 rounded-lg hover:bg-muted"><ChevronLeft className="w-4 h-4" /></button>
          <span className="text-sm font-medium w-32 sm:w-40 text-center truncate">{label()}</span>
          <button onClick={() => shift(1)} aria-label="Next period" className="p-1.5 rounded-lg hover:bg-muted"><ChevronRight className="w-4 h-4" /></button>
          <Button size="sm" variant="outline" onClick={() => setAnchor(new Date())}>Today</Button>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setQaOpen(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">
            <Plus className="w-4 h-4" /> Add Event
          </button>
          <Button size="sm" variant="outline" onClick={() => setIcsOpen(true)} className="border-hud-cyan/40 text-hud-cyan">
            <CalendarPlus className="w-4 h-4 mr-1" /> Import ICS
          </Button>
        </div>
      </PageHeader>

      <CalendarSync onSynced={refresh} />

      {(courseOptions.length > 0 || filtersActive) && (
        <Card className="p-3 flex flex-col gap-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="um-label">Filters</span>
            {filtersActive && (
              <button
                onClick={() => setFilters(emptyFilters())}
                className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
              >
                Clear all
              </button>
            )}
          </div>

          {courseOptions.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="um-label w-16 shrink-0">Course</span>
              {courseOptions.map((o) => {
                const on = filters.courseIds.includes(o.id);
                return (
                  <button
                    key={o.id}
                    onClick={() => toggleFacet("courseIds", o.id)}
                    aria-pressed={on}
                    className={`chip transition-colors ${on ? "border-primary bg-primary/15 text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    {o.code}
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            <span className="um-label w-16 shrink-0">Type</span>
            {EVENT_TYPES.map((ty) => {
              const on = filters.types.includes(ty);
              return (
                <button
                  key={ty}
                  onClick={() => toggleFacet("types", ty)}
                  aria-pressed={on}
                  className={`chip capitalize transition-colors ${on ? "border-primary bg-primary/15 text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {ty}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="um-label w-16 shrink-0">Done</span>
            {TASK_STATUSES.map((st) => {
              const on = filters.statuses.includes(st);
              return (
                <button
                  key={st}
                  onClick={() => toggleFacet("statuses", st)}
                  aria-pressed={on}
                  className={`chip transition-colors ${on ? "border-primary bg-primary/15 text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {st.replace("_", " ")}
                </button>
              );
            })}
          </div>
        </Card>
      )}

      {filtersActive && filtered.events.length === 0 && (
        <Card className="p-4 text-sm text-muted-foreground">
          No events match the current filters.
        </Card>
      )}

      {urgentExams.length > 0 && (
        <Card className="p-4 border-hud-rose/20 bg-hud-rose/5 glow-hover">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-hud-rose" />
              <span className="um-label text-hud-rose">Upcoming exams — next 3 days</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {urgentExams.map((ex) => {
                const course = courses.find((c) => c.id === ex.course_id);
                return (
                  <span key={ex.id} className="chip border-hud-rose/40 bg-hud-rose/10 text-hud-rose">
                    {course?.name || ex.name} · {ex.date}
                  </span>
                );
              })}
              <Button size="sm" variant="outline" disabled={scheduling} onClick={autoScheduleStudy} className="ml-2 border-hud-cyan/40 text-hud-cyan glow-hover">
                <Clock className="w-3.5 h-3.5 mr-1" /> {scheduling ? "Scheduling…" : "Auto-schedule study blocks"}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {loading ? (
        <div className="h-96 bg-muted rounded-xl animate-pulse" />
      ) : data && events.length === 0 && courses.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="Your week is wide open"
          description="Add your first course — its classes will show up here — or drop in a personal event to start building your schedule."
          actionLabel="Add Event"
          onAction={() => setQaOpen(true)}
        />
      ) : (
        <>
          {view === "week" && <WeekView anchor={anchor} events={filtered.events} courses={courses} todayStr={todayStr} />}
          {view === "day" && <DayView date={anchor} events={filtered.events} courses={courses} tasks={filtered.tasks} exams={filtered.exams} todayStr={todayStr} />}
          {view === "month" && <MonthView anchor={anchor} events={filtered.events} courses={courses} todayStr={todayStr} onPickDay={(d) => { setAnchor(d); chooseView("day"); }} />}
        </>
      )}
      <QuickAdd open={qaOpen} onClose={() => setQaOpen(false)} />
      <ICSFeedDialog open={icsOpen} onClose={() => setIcsOpen(false)} data={data} onImported={refresh} />
    </>
  );
}