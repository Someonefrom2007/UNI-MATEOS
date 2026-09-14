import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUserData } from "@/lib/useUserData";
import { useDeskMode } from "@/hooks/use-desk-mode";
import { courseGrade, ectsAverage } from "@/lib/gradeEngine";
import { weekWorkload, focusStreak } from "@/lib/workloadEngine";
import { todayTimeline, nextClass } from "@/lib/scheduleEngine";
import { generateInsights, recommendNow } from "@/lib/insightsEngine";
import { weeklyVelocity } from "@/lib/burnout";
import { useAuth } from "@/lib/AuthContext";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { BookOpen, Sparkles, PanelsTopLeft } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { loadDemoData } from "@/lib/demoData";
import { Reveal } from "@/components/motion/Reveal";
import { STICKY_BG } from "@/components/stickies/stickyColors";
import HeroGreeting from "@/components/dashboard/HeroGreeting";
import SpotlightCard from "@/components/dashboard/SpotlightCard";
import TodayTimeline from "@/components/dashboard/TodayTimeline";
import AttentionCard from "@/components/dashboard/AttentionCard";
import PulseCard from "@/components/dashboard/PulseCard";
import FocusCard from "@/components/dashboard/FocusCard";
import WorkloadCard from "@/components/dashboard/WorkloadCard";
import VelocityCard from "@/components/dashboard/VelocityCard";
import GoalsCard from "@/components/dashboard/GoalsCard";
import HabitsCard from "@/components/dashboard/HabitsCard";
import InsightsCard from "@/components/dashboard/InsightsCard";

// Chaotic Desk: each panel gets a small organic tilt so the dashboard feels
// like a student's brain-dump desk. TIDY DESK snaps everything back to 0deg.
const BENTO_ROT = {
  spotlight: "-rotate-1",
  timeline: "rotate-1",
  attention: "-rotate-2",
  pulse: "rotate-1",
  focus: "-rotate-1",
  workload: "rotate-1",
  velocity: "-rotate-1",
  habits: "-rotate-2",
  sticky: "rotate-2",
  goals: "-rotate-1",
  insights: "rotate-1",
};

export default function Dashboard() {
  const { data, loading, refresh } = useUserData();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useI18n();
  const [demoLoading, setDemoLoading] = useState(false);
  const { chaos: deskMode, toggle: toggleDesk } = useDeskMode();

  const cell = (k) => `h-full transition-transform duration-300 ease-out ${deskMode ? BENTO_ROT[k] : "rotate-0"}`;

  const loadDemo = async () => {
    if (!confirm("This adds a full sample semester (courses, classes, tasks, exams, grades, sticky notes) to your workspace. Continue?")) return;
    setDemoLoading(true);
    try {
      const counts = await loadDemoData();
      await refresh();
      toast({ title: "Demo semester loaded — take a look around!" });
      if (counts) console.debug("Demo seed →", counts);
    } catch (e) {
      console.error("Demo seeding failed:", e);
      toast({ title: "Demo data couldn't be loaded", description: "Check the terminal/console for the failing table." });
    } finally {
      setDemoLoading(false);
    }
  };

  const d = useMemo(() => {
    if (!data) return null;
    const courses = data.Course.filter((c) => !c.archived);
    const tasks = data.Task;
    const exams = data.Exam;
    const grades = data.Grade;
    const events = data.ScheduleEvent;
    const focus = data.FocusSession;
    const goals = data.Goal.filter((g) => !g.completed);
    const habits = data.Habit.filter((h) => !h.archived);
    const habitLogs = data.HabitLog;
    const sticky = data.StickyNote || [];

    const todayStr = new Date().toISOString().slice(0, 10);

    const courseGrades = courses.map((c) => {
      const cGrades = grades.filter((g) => g.course_id === c.id);
      const examsForCourse = exams.filter((e) => e.course_id === c.id && e.grade !== null && e.grade !== undefined);
      const assessments = [
        ...cGrades.map((g) => ({ grade: g.grade, weight: g.weight })),
        ...examsForCourse.map((e) => ({ grade: e.grade, weight: e.weight })),
      ];
      return { ...c, grade: courseGrade(assessments) };
    });

    const semesterGPA = ectsAverage(courseGrades.filter((c) => c.grade !== null));
    const totalEcts = courses.reduce((s, c) => s + (c.ects || 0), 0);

    const nc = nextClass(events);
    const timeline = todayTimeline(events, tasks, exams, todayStr);
    const wl = weekWorkload(tasks, exams, focus, courses, todayStr);
    const velocity = weeklyVelocity({ tasks, focusSessions: focus, todayStr });
    const insights = generateInsights({ tasks, exams, focusSessions: focus, courses, grades, habits, habitLogs });
    const rec = recommendNow({ tasks, exams, courses, events });

    const urgent = [
      ...exams.filter((e) => e.status !== "completed" && e.date).map((e) => {
        const n = Math.round((new Date(e.date + "T00:00:00").getTime() - new Date().getTime()) / 86400000);
        return n >= 0 && n <= 7 ? { kind: "exam", item: e, n, course: courses.find((c) => c.id === e.course_id) } : null;
      }).filter(Boolean),
      ...tasks.filter((t) => t.status !== "completed" && t.due_date).map((t) => {
        const n = Math.round((new Date(t.due_date + "T00:00:00").getTime() - new Date().getTime()) / 86400000);
        return n <= 2 ? { kind: "task", item: t, n, course: courses.find((c) => c.id === t.course_id) } : null;
      }).filter(Boolean),
    ].sort((a, b) => a.n - b.n).slice(0, 4);

    return { courses, tasks, exams, grades, courseGrades, semesterGPA, totalEcts, nc, timeline, wl, velocity, insights, rec, urgent, goals, habits, habitLogs, sticky, todayStr };
  }, [data]);

  if (loading || !d) return <DashboardSkeleton />;

  const empty = d.courses.length === 0;

  return (
    <div className="space-y-6">
      <HeroGreeting user={user} gpa={d.semesterGPA} ects={d.totalEcts} streak={focusStreak(data.FocusSession)} />

      {empty && (
        <Reveal delay={0.08}>
          <div className="relative overflow-hidden cyber-grid cyber-scanlines flex flex-col md:flex-row md:items-center gap-4 md:gap-6 justify-between px-6 py-5 rounded-2xl border border-border bg-card/60 backdrop-blur-md">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0 glow-cyan">
                <BookOpen className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2 className="font-display text-lg sm:text-xl font-semibold tracking-tight">Your semester starts here</h2>
                <p className="text-sm text-muted-foreground mt-1 max-w-md">Add your first course or explore with a demo semester — the HUD tiles below stay live either way.</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => navigate("/courses")}>Add your first course</Button>
              <Button variant="outline" onClick={() => navigate("/onboarding")}>Guided setup</Button>
              <Button variant="outline" onClick={loadDemo} disabled={demoLoading}>
                {demoLoading ? "Loading demo…" : (<><Sparkles className="w-4 h-4 mr-2 text-primary" />Explore with demo data</>)}
              </Button>
            </div>
          </div>
        </Reveal>
      )}

      {/* Desk mode → the HUD toggle: chaos tilts the desk, tidy lines it up. */}
      <div className="flex justify-end">
        <div className="flex items-center gap-3">
          <span className={`cyber-tag hidden sm:inline-flex ${deskMode ? "text-violet-300 border-violet-400/40 bg-violet-400/10" : ""}`}>{deskMode ? t("desk.chaos") : t("desk.tidy")}</span>
          <Button size="sm" variant="outline" onClick={toggleDesk} data-testid="desk-toggle" className="h-8 gap-1.5 font-mono text-[11px] uppercase tracking-wider">
            {deskMode ? <PanelsTopLeft className="w-3.5 h-3.5 text-cyan-400" /> : <Sparkles className="w-3.5 h-3.5 text-violet-400" />}
            {deskMode ? t("desk.tidy") : t("desk.chaos")}
          </Button>
        </div>
      </div>

      {/* Asymmetrical bento grid — establishing shot: the spotlight and the day. */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-5">
        <Reveal delay={0.05} mode="inView" className="md:col-span-4">
          <div className={cell("spotlight")}>
            <SpotlightCard rec={d.rec} nc={d.nc} courses={d.courses} exams={d.exams} />
          </div>
        </Reveal>
        <Reveal delay={0.12} mode="inView" className="md:col-span-2">
          <div className={cell("timeline")}>
            <TodayTimeline timeline={d.timeline} courses={d.courses} />
          </div>
        </Reveal>

        {/* Mid-shot: attention, pulse, focus */}
        <Reveal delay={0.04} mode="inView" className="md:col-span-2">
          <div className={cell("attention")}><AttentionCard urgent={d.urgent} /></div>
        </Reveal>
        <Reveal delay={0.09} mode="inView" className="md:col-span-2">
          <div className={cell("pulse")}><PulseCard gpa={d.semesterGPA} ects={d.totalEcts} grades={d.grades} /></div>
        </Reveal>
        <Reveal delay={0.14} mode="inView" className="md:col-span-2">
          <div className={cell("focus")}><FocusCard sessions={data.FocusSession} /></div>
        </Reveal>

        {/* Density: workload + velocity (and habits when present) */}
        <Reveal mode="inView" className="md:col-span-4">
          <div className={cell("workload")}><WorkloadCard wl={d.wl} /></div>
        </Reveal>
        <Reveal delay={0.08} mode="inView" className="md:col-span-2">
          <div className={cell("velocity")}><VelocityCard velocity={d.velocity} /></div>
        </Reveal>
        {d.habits.length > 0 && (
          <Reveal delay={0.16} mode="inView" className="md:col-span-2">
            <div className={cell("habits")}><HabitsCard habits={d.habits} logs={d.habitLogs} today={d.todayStr} /></div>
          </Reveal>
        )}

        {/* The brain dump: sticky notes, goals, and what the data says */}
        <Reveal mode="inView" className="md:col-span-2">
          <div className={cell("sticky")}><StickyTile notes={d.sticky} navigate={navigate} /></div>
        </Reveal>
        {d.goals.length > 0 && (
          <Reveal delay={0.06} mode="inView" className="md:col-span-2">
            <div className={cell("goals")}><GoalsCard goals={d.goals} /></div>
          </Reveal>
        )}
        <Reveal delay={0.1} mode="inView" className={d.goals.length > 0 ? "md:col-span-2" : "md:col-span-4"}>
          <div className={cell("insights")}><InsightsCard insights={d.insights} /></div>
        </Reveal>
      </div>
    </div>
  );
}

function StickyTile({ notes, navigate }) {
  const sticky = notes.slice(0, 3);
  return (
    <div className="relative overflow-hidden h-full rounded-xl border border-border bg-card/60 backdrop-blur-md p-4 flex flex-col cyber-scanlines">
      <div className="flex items-center justify-between mb-3">
        <span className="um-label">Sticky notes</span>
        <button onClick={() => navigate("/stickies")} className="text-xs text-muted-foreground hover:text-foreground transition-colors">Sticky wall →</button>
      </div>
      {sticky.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">Half-formed thoughts welcome — stick them before they escape.</p>
      ) : (
        <div className="flex-1 flex flex-wrap gap-3 content-start">
          {sticky.map((n, i) => (
            <button
              key={n.id}
              onClick={() => navigate("/stickies")}
              className={`${STICKY_BG[n.color] || STICKY_BG.amber} rounded-md p-2.5 shadow-lg shadow-black/25 text-left ${i === 0 ? "rotate-1" : i === 1 ? "-rotate-1" : "rotate-2"} hover:rotate-0 transition-transform`}
            >
              <span className="font-sticky text-lg leading-snug line-clamp-4 block max-w-[9rem]">{n.content}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-end justify-between">
        <div className="space-y-2">
          <div className="h-10 w-72 bg-muted rounded-lg" />
          <div className="h-4 w-48 bg-muted rounded" />
        </div>
        <div className="h-10 w-64 bg-muted rounded hidden sm:block" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="h-64 lg:col-span-2 bg-muted rounded-2xl" />
        <div className="h-64 bg-muted rounded-xl" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="h-40 bg-muted rounded-xl" />
        <div className="h-40 bg-muted rounded-xl" />
        <div className="h-40 bg-muted rounded-xl" />
      </div>
    </div>
  );
}