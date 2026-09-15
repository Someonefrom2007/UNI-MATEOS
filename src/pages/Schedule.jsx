import { useEffect, useMemo, useState } from "react";
import { useUserData } from "@/lib/useUserData";
import { fetchICSFeed, toScheduleEventRows, diffICS, expandForImport } from "@/lib/calendarSync";
import { urgentExamsWithin, pickFreeBlock, addMinutes } from "@/lib/planner";
import { loadFeeds } from "@/lib/feedsStore";
import { supabase } from "@/lib/supabase";
import { isLocalWorkspace } from "@/lib/repo/select";
import { createLocalRepo } from "@/lib/repo/localRepo";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarDays, CalendarPlus, ChevronLeft, ChevronRight, Plus, Zap, Clock } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useI18n } from "@/lib/i18n";
import { toLocalISO } from "@/lib/format";
import QuickAdd from "@/components/QuickAdd";
import ErrorState from "@/components/ErrorState";
import CalendarSync from "@/components/schedule/CalendarSync";
import WeekView from "@/components/schedule/WeekView";
import DayView from "@/components/schedule/DayView";
import MonthView from "@/components/schedule/MonthView";
import ICSFeedDialog from "@/components/schedule/ICSFeedDialog";

const LOCAL = isLocalWorkspace();
const localRepo = LOCAL ? createLocalRepo() : null;

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

  const events = data?.ScheduleEvent || [];
  const courses = data?.Course || [];
  const tasks = data?.Task || [];
  const exams = data?.Exam || [];
  const todayStr = toLocalISO(new Date());

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
            if (LOCAL) {
              for (const row of toCreate) localRepo.create("schedule_events", row);
              added += toCreate.length;
            } else {
              const { error } = await supabase.from("schedule_events").insert(toCreate);
              if (!error) added += toCreate.length;
            }
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
        <div className="flex items-center gap-2">
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
          <button onClick={() => shift(-1)} className="p-1.5 rounded-lg hover:bg-muted"><ChevronLeft className="w-4 h-4" /></button>
          <span className="text-sm font-medium w-40 text-center truncate">{label()}</span>
          <button onClick={() => shift(1)} className="p-1.5 rounded-lg hover:bg-muted"><ChevronRight className="w-4 h-4" /></button>
          <Button size="sm" variant="outline" onClick={() => setAnchor(new Date())}>Today</Button>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setQaOpen(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">
            <Plus className="w-4 h-4" /> Add Event
          </button>
          <Button size="sm" variant="outline" onClick={() => setIcsOpen(true)} className="border-cyan-500/40 text-cyan-300">
            <CalendarPlus className="w-4 h-4 mr-1" /> Import ICS
          </Button>
        </div>
      </PageHeader>

      <CalendarSync onSynced={refresh} />

      {urgentExams.length > 0 && (
        <Card className="p-4 border-rose-500/20 bg-rose-500/5 glow-hover">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-rose-400" />
              <span className="um-label text-rose-400">Upcoming exams — next 3 days</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {urgentExams.map((ex) => {
                const course = courses.find((c) => c.id === ex.course_id);
                return (
                  <span key={ex.id} className="chip border-rose-500/40 bg-rose-500/10 text-rose-300">
                    {course?.name || ex.name} · {ex.date}
                  </span>
                );
              })}
              <Button size="sm" variant="outline" disabled={scheduling} onClick={autoScheduleStudy} className="ml-2 border-cyan-500/40 text-cyan-300 glow-hover">
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
          {view === "week" && <WeekView anchor={anchor} events={events} courses={courses} todayStr={todayStr} />}
          {view === "day" && <DayView date={anchor} events={events} courses={courses} tasks={tasks} exams={exams} todayStr={todayStr} />}
          {view === "month" && <MonthView anchor={anchor} events={events} courses={courses} todayStr={todayStr} onPickDay={(d) => { setAnchor(d); chooseView("day"); }} />}
        </>
      )}
      <QuickAdd open={qaOpen} onClose={() => setQaOpen(false)} />
      <ICSFeedDialog open={icsOpen} onClose={() => setIcsOpen(false)} data={data} onImported={refresh} />
    </>
  );
}