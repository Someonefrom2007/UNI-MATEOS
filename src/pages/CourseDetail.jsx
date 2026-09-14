import { useMemo, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useUserData } from "@/lib/useUserData";
import { courseColor, fmtGrade, fmtDuration, relativeDeadline, PRIORITY_META } from "@/lib/format";
import { courseGrade, requiredGrade } from "@/lib/gradeEngine";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowLeft, GraduationCap, Timer, CheckSquare, FileText, BookOpen } from "lucide-react";
import QuickAdd from "@/components/QuickAdd";
import EmptyState from "@/components/EmptyState";
import { useToast } from "@/components/ui/use-toast";

export default function CourseDetail() {
  const { id } = useParams();
  const { data, loading, mutate } = useUserData();
  const [tab, setTab] = useState("overview");
  const [qaOpen, setQaOpen] = useState(false);
  const [qaPreset, setQaPreset] = useState(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  const c = data?.Course.find((x) => x.id === id);

  const derived = useMemo(() => {
    if (!data || !c) return null;
    const grades = data.Grade.filter((g) => g.course_id === id);
    const exams = data.Exam.filter((e) => e.course_id === id);
    const tasks = data.Task.filter((t) => t.course_id === id);
    const notes = data.Note.filter((n) => n.course_id === id);
    const resources = data.Resource.filter((r) => r.course_id === id);
    const focus = data.FocusSession.filter((f) => f.course_id === id);
    const assessments = [
      ...grades.map((g) => ({ grade: g.grade, weight: g.weight })),
      ...exams.filter((e) => e.grade !== null && e.grade !== undefined).map((e) => ({ grade: e.grade, weight: e.weight })),
    ];
    const grade = courseGrade(assessments);
    const req = requiredGrade(assessments, c.target_grade);
    const focusTotal = focus.reduce((s, f) => s + f.duration, 0);
    const completedTasks = tasks.filter((t) => t.status === "completed").length;
    return { grades, exams, tasks, notes, resources, focus, grade, req, focusTotal, completedTasks };
  }, [data, c, id]);

  if (loading) return <div className="h-64 bg-muted rounded-xl animate-pulse" />;
  if (!c) return <EmptyState title="Course not found" description="It may have been removed." actionLabel="Back to courses" actionTo="/courses" />;

  const cc = courseColor(c.color);

  const openQA = (typeKey) => {
    setQaPreset({ typeKey, courseId: id });
    setQaOpen(true);
  };

  const toggleTask = async (task) => {
    const done = task.status !== "completed";
    await mutate("Task", "update", task.id, { status: done ? "completed" : "todo", completed_date: done ? new Date().toISOString().slice(0, 10) : null });
  };

  const deleteCourse = async () => {
    if (!confirm(`Delete ${c.name}? This removes the course. Linked tasks, exams, and notes remain but unlinked.`)) return;
    await mutate("Course", "delete", c.id);
    toast({ title: "Course deleted" });
    navigate("/courses");
  };

  return (
    <div className="space-y-6">
      <Link to="/courses" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="w-4 h-4 mr-1.5" />Courses</Link>

      {/* Header */}
      <div className={`rounded-xl border p-6 ${cc.ring} bg-gradient-to-br from-card to-transparent`}>
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className={`w-3 h-3 rounded-full ${cc.dot}`} />
              <span className="text-xs font-mono text-muted-foreground">{c.code || "—"}</span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight mt-1">{c.name}</h1>
            {c.professor && <p className="text-sm text-muted-foreground mt-1">{c.professor} · {c.ects} ECTS · {c.academic_year}</p>}
          </div>
          <div className="grid grid-cols-4 gap-4">
            <Stat label="Current" value={derived.grade !== null ? fmtGrade(derived.grade) : "—"} />
            <Stat label="Target" value={fmtGrade(c.target_grade)} />
            <Stat label="Needed" value={derived.req !== null ? fmtGrade(derived.req) : "—"} />
            <Stat label="Focus" value={fmtDuration(derived.focusTotal)} />
          </div>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="exams">Exams</TabsTrigger>
          <TabsTrigger value="grades">Grades</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="p-5">
              <h3 className="um-label mb-3">At a glance</h3>
              <div className="space-y-2 text-sm">
                <Row label="Current grade" value={derived.grade !== null ? fmtGrade(derived.grade) : "No grades yet"} />
                <Row label="Target grade" value={fmtGrade(c.target_grade)} />
                <Row label="Required on remaining" value={derived.req !== null ? fmtGrade(derived.req) : "—"} />
                <Row label="Tasks completed" value={`${derived.completedTasks} / ${derived.tasks.length}`} />
                <Row label="Focus time" value={fmtDuration(derived.focusTotal)} />
              </div>
            </Card>
            <Card className="p-5">
              <h3 className="um-label mb-3">Quick actions</h3>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => openQA("task")}><CheckSquare className="w-3.5 h-3.5 mr-1.5" />Add task</Button>
                <Button size="sm" variant="outline" onClick={() => openQA("exam")}><GraduationCap className="w-3.5 h-3.5 mr-1.5" />Add exam</Button>
                <Button size="sm" variant="outline" onClick={() => openQA("grade")}><FileText className="w-3.5 h-3.5 mr-1.5" />Add grade</Button>
                <Button size="sm" variant="outline" onClick={() => openQA("note")}><BookOpen className="w-3.5 h-3.5 mr-1.5" />Add note</Button>
                <Button size="sm" variant="outline" onClick={() => navigate("/focus")}><Timer className="w-3.5 h-3.5 mr-1.5" />Start focus</Button>
              </div>
              <div className="mt-6 pt-4 border-t border-border">
                <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={deleteCourse}>Delete course</Button>
              </div>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="tasks" className="mt-4">
          {derived.tasks.length === 0 ? <EmptyState icon={CheckSquare} title="No tasks yet" description="Add tasks for this course to track your work." actionLabel="Add task" onAction={() => openQA("task")} /> : (
            <div className="space-y-2">
              {derived.tasks.map((t) => {
                const pm = PRIORITY_META[t.priority];
                return (
                  <Card key={t.id} className="p-3 flex items-center gap-3">
                    <button onClick={() => toggleTask(t)} className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 ${t.status === "completed" ? "bg-emerald-500 border-emerald-500" : "border-border"}`}>
                      {t.status === "completed" && <span className="text-[10px] text-white">✓</span>}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-medium ${t.status === "completed" ? "line-through text-muted-foreground" : ""}`}>{t.title}</div>
                      {t.due_date && <div className="text-xs text-muted-foreground">{relativeDeadline(t.due_date)}</div>}
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded border ${pm.cls}`}>{pm.label}</span>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="exams" className="mt-4">
          {derived.exams.length === 0 ? <EmptyState icon={GraduationCap} title="No exams yet" description="Add exams to track dates and preparation." actionLabel="Add exam" onAction={() => openQA("exam")} /> : (
            <div className="space-y-2">
              {derived.exams.map((e) => (
                <Link key={e.id} to={`/exams/${e.id}`}>
                  <Card className="p-3 flex items-center gap-3 hover:border-primary/40 transition-colors">
                    <GraduationCap className="w-4 h-4 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{e.name}</div>
                      <div className="text-xs text-muted-foreground">{e.date} · {e.weight}% weight</div>
                    </div>
                    {e.grade !== null && e.grade !== undefined && <span className="text-sm font-medium">{fmtGrade(e.grade)}</span>}
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="grades" className="mt-4">
          {derived.grades.length === 0 ? <EmptyState icon={FileText} title="No grades yet" description="Enter grades to see your course performance." actionLabel="Go to Grades" actionTo="/grades" /> : (
            <Card className="p-0 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="border-b border-border">
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="px-4 py-2 font-medium">Assessment</th>
                    <th className="px-4 py-2 font-medium">Weight</th>
                    <th className="px-4 py-2 font-medium">Grade</th>
                    <th className="px-4 py-2 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {derived.grades.map((g) => (
                    <tr key={g.id} className="border-b border-border/50 last:border-0">
                      <td className="px-4 py-2.5">{g.name}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{g.weight}%</td>
                      <td className="px-4 py-2.5 font-medium">{fmtGrade(g.grade)}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{g.date || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="notes" className="mt-4">
          {derived.notes.length === 0 ? <EmptyState icon={FileText} title="No notes yet" description="Link notes to this course to keep everything together." actionLabel="Add note" onAction={() => openQA("note")} /> : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {derived.notes.map((n) => (
                <Link key={n.id} to={`/notes/${n.id}`}>
                  <Card className="p-4 hover:border-primary/40 transition-colors">
                    <div className="text-sm font-medium">{n.title}</div>
                    <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{(n.content || "").replace(/[#*]/g, "").slice(0, 100)}</div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <QuickAdd open={qaOpen} preset={qaPreset} onClose={() => setQaOpen(false)} />
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-display text-xl font-semibold mt-0.5">{value}</div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}