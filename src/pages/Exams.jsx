import { useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useUserData } from "@/lib/useUserData";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import { courseColor, fmtGrade, relativeExam } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GraduationCap, Plus, ArrowLeft, Check } from "lucide-react";
import QuickAdd from "@/components/QuickAdd";
import { useToast } from "@/components/ui/use-toast";
import { useI18n } from "@/lib/i18n";
import ErrorState from "@/components/ErrorState";

export default function Exams() {
  const { id } = useParams();
  const { data, loading, error, mutate, refresh } = useUserData();
  const [qaOpen, setQaOpen] = useState(false);
  const { toast } = useToast();
  const { t } = useI18n();

  const exams = useMemo(() => {
    if (!data) return [];
    return data.Exam.sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999"));
  }, [data]);

  const courses = data?.Course || [];

  if (error) return <ErrorState onRetry={refresh} />;

  if (id) return <ExamDetail id={id} />;

  if (loading && !data) {
    return (
      <>
        <PageHeader title={t("title.exams")} subtitle={t("title.exams.subtitle")} />
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />)}
        </div>
      </>
    );
  }

  if (!loading && exams.length === 0) {
    return (
      <>
        <PageHeader title={t("title.exams")} subtitle={t("title.exams.subtitle")} />
        <EmptyState icon={GraduationCap} title="No exams yet" description="Add an exam to get a countdown and start tracking preparation." actionLabel="Add Exam" onAction={() => setQaOpen(true)} />
        <QuickAdd open={qaOpen} onClose={() => setQaOpen(false)} />
      </>
    );
  }

  const upcoming = exams.filter((e) => e.status !== "completed");
  const past = exams.filter((e) => e.status === "completed");

  return (
    <>
      <PageHeader title="Exams" subtitle="Countdowns and preparation, all in one place.">
        <button onClick={() => setQaOpen(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">
          <Plus className="w-4 h-4" /> Add Exam
        </button>
      </PageHeader>

      {upcoming.length > 0 && (
        <div className="space-y-2 mb-6">
          <h2 className="um-label">Upcoming</h2>
          {upcoming.map((e) => {
            const course = courses.find((c) => c.id === e.course_id);
            const cc = course ? courseColor(course.color) : null;
            const n = relativeExam(e.date);
            return (
              <Link key={e.id} to={`/exams/${e.id}`}>
                <Card className={`p-4 flex items-center gap-4 glow-hover group transition-colors`}>
                  <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center ${cc ? `${cc.soft} ${cc.text}` : "bg-muted"} ${n === "Today" || n === "In 1d" ? "shadow-[0_0_14px_rgba(244,63,94,0.3)] ring-1 ring-hud-rose/40" : ""}`}>
                    {e.date ? (
                      <>
                        <span className="text-lg font-semibold leading-none">{n === "Today" ? "!" : n.replace("In ", "").replace("d", "")}</span>
                        <span className="text-[9px] uppercase mt-0.5">{n === "Today" ? "Today" : "days"}</span>
                      </>
                    ) : (
                      <span className="text-[10px] uppercase tracking-wider">TBD</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{e.name}</div>
                    <div className="text-xs text-muted-foreground">{course?.name} · {e.date}{e.weight ? ` · ${e.weight}%` : ""}</div>
                  </div>
                  <span className={`text-xs ${n === "Today" || n === "In 1d" ? "text-hud-rose font-medium" : "text-muted-foreground"}`}>{n}</span>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      {past.length > 0 && (
        <div className="space-y-2">
          <h2 className="um-label">Past</h2>
          {past.map((e) => {
            const course = courses.find((c) => c.id === e.course_id);
            return (
              <Link key={e.id} to={`/exams/${e.id}`}>
                <Card className="p-3 flex items-center gap-3 hover:border-primary/40 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-muted-foreground">{e.name}</div>
                    <div className="text-xs text-muted-foreground">{course?.name} · {e.date}</div>
                  </div>
                  {e.grade !== null && e.grade !== undefined && <span className="text-sm font-medium">{fmtGrade(e.grade)}</span>}
                </Card>
              </Link>
            );
          })}
        </div>
      )}
      <QuickAdd open={qaOpen} onClose={() => setQaOpen(false)} />
    </>
  );
}

function ExamDetail({ id }) {
  const { data, mutate } = useUserData();
  const { toast } = useToast();
  const exam = data?.Exam.find((e) => e.id === id);
  if (!exam) return <EmptyState title="Exam not found" actionLabel="Back to exams" actionTo="/exams" />;
  const course = data?.Course.find((c) => c.id === exam.course_id);
  const cc = course ? courseColor(course.color) : null;
  const topics = exam.topics || [];

  const toggleTopic = async (idx) => {
    const newTopics = topics.map((t, i) => i === idx ? { ...t, reviewed: !t.reviewed, mastery: t.reviewed ? (t.mastery || 0) : 100 } : t);
    await mutate("Exam", "update", id, { topics: newTopics });
  };

  const setMastery = async (idx, val) => {
    const newTopics = topics.map((t, i) => i === idx ? { ...t, mastery: val, reviewed: val >= 80 } : t);
    await mutate("Exam", "update", id, { topics: newTopics });
  };

  const addTopic = async () => {
    const name = prompt("Topic name");
    if (!name) return;
    await mutate("Exam", "update", id, { topics: [...topics, { name, mastery: 0, reviewed: false }] });
  };

  const readiness = topics.length ? Math.round(topics.reduce((s, t) => s + (t.mastery || 0), 0) / topics.length) : 0;

  return (
    <div className="space-y-6">
      <Link to="/exams" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="w-4 h-4 mr-1.5" />Exams</Link>
      <div className={`rounded-xl border p-6 ${cc ? cc.ring : ""} bg-gradient-to-br from-card to-transparent`}>
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2">
              {course && <span className={`w-2.5 h-2.5 rounded-full ${cc.dot}`} />}
              <span className="text-xs text-muted-foreground">{course?.name}</span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight mt-1">{exam.name}</h1>
            <p className="text-sm text-muted-foreground mt-1">{exam.date} · {relativeExam(exam.date)} · {exam.weight}% weight</p>
          </div>
          {topics.length > 0 && (
            <div className="text-right">
              <div className="um-label">Readiness</div>
              <div className="font-display text-3xl font-semibold mt-1">{readiness}%</div>
            </div>
          )}
        </div>
      </div>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="um-label">Preparation</h2>
          <Button size="sm" variant="outline" onClick={addTopic}><Plus className="w-3.5 h-3.5 mr-1.5" />Add topic</Button>
        </div>
        {topics.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No topics yet. Add the topics this exam covers to track your preparation and readiness.</p>
        ) : (
          <div className="space-y-3">
            {topics.map((t, i) => (
              <div key={i} className="flex items-center gap-3">
                <button onClick={() => toggleTopic(i)} aria-label={t.reviewed ? `Mark ${t.name} as not reviewed` : `Mark ${t.name} as reviewed`} className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 ${t.reviewed ? "bg-emerald-500 border-emerald-500" : "border-border"}`}>
                  {t.reviewed && <Check className="w-3 h-3 text-white" />}
                </button>
                <div className="flex-1">
                  <div className="text-sm font-medium">{t.name}</div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden mt-1.5">
                    <div className="h-full bg-cyan-500 rounded-full" style={{ width: `${t.mastery || 0}%` }} />
                  </div>
                </div>
                <input type="range" min="0" max="100" value={t.mastery || 0} onChange={(e) => setMastery(i, Number(e.target.value))} aria-label={`${t.name} mastery`} className="w-24 accent-cyan-500" />
                <span className="text-xs text-muted-foreground w-8 text-right">{t.mastery || 0}%</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}