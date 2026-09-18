import { useMemo, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useUserData } from "@/lib/useUserData";
import { courseColor, fmtGrade, fmtDuration, daysSince, relativeDeadline, PRIORITY_META, notePreview } from "@/lib/format";
import { courseGrade, requiredGrade } from "@/lib/gradeEngine";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowLeft, GraduationCap, Timer, CheckSquare, FileText, BookOpen, Archive, FolderOpen, ExternalLink } from "lucide-react";
import QuickAdd from "@/components/QuickAdd";
import EmptyState from "@/components/EmptyState";
import ErrorState from "@/components/ErrorState";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useToast } from "@/components/ui/use-toast";
import { courseDependents, planCourseDelete, dependentSummary } from "@/lib/courseLifecycle";
import { activeTasks } from "@/lib/taskEdit";
import AttendancePanel from "@/components/AttendancePanel";
import { summarizeCourse } from "@/lib/attendance";
import { useI18n } from "@/lib/i18n";

export default function CourseDetail() {
  const { id } = useParams();
  const { data, loading, error, mutate, mutateBatch, refresh } = useUserData();
  const { t } = useI18n();
  const [tab, setTab] = useState("overview");
  const [qaOpen, setQaOpen] = useState(false);
  const [qaPreset, setQaPreset] = useState(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const c = data?.Course.find((x) => x.id === id);

  const derived = useMemo(() => {
    if (!data || !c) return null;
    const grades = data.Grade.filter((g) => g.course_id === id);
    const exams = data.Exam.filter((e) => e.course_id === id);
    const tasks = activeTasks(data.Task).filter((t) => t.course_id === id);
    const notes = data.Note.filter((n) => n.course_id === id);
    const resources = data.Resource.filter((r) => r.course_id === id);
    const focus = data.FocusSession.filter((f) => f.course_id === id);
    const attendance = (data.Attendance || []).filter((a) => a.course_id === id);
    const assessments = [
      ...grades.map((g) => ({ grade: g.grade, weight: g.weight })),
      ...exams.filter((e) => e.grade !== null && e.grade !== undefined).map((e) => ({ grade: e.grade, weight: e.weight })),
    ];
    const grade = courseGrade(assessments);
    const req = requiredGrade(assessments, c.target_grade);
    const focusTotal = focus.reduce((s, f) => s + f.duration, 0);
    const completedTasks = tasks.filter((t) => t.status === "completed").length;
    const lastFocus = focus
      .map((f) => f.date || f.created_at)
      .filter(Boolean)
      .sort()
      .pop() || null;
    return { grades, exams, tasks, notes, resources, focus, attendance, grade, req, focusTotal, completedTasks, lastFocus };
  }, [data, c, id]);

  const dependents = useMemo(() => (data && c ? courseDependents(data, c.id) : {}), [data, c]);
  const summary = useMemo(() => dependentSummary(dependents), [dependents]);

  // Attendance at a glance: the rate against the course's own requirement, or an
  // honest "not logged" rather than a misleading 0%.
  const attendanceGlance = useMemo(() => {
    if (!c || !derived) return t("course.notLogged");
    const s = summarizeCourse(c, derived.attendance);
    if (s.rate === null) return t("course.notLogged");
    return `${s.rate.toFixed(1)}% · min ${s.target}%`;
  }, [c, derived]);

  const lastStudied = (() => {
    if (!derived?.lastFocus) return t("course.study.never");
    const n = daysSince(derived.lastFocus);
    if (n === null) return t("course.study.never");
    if (n <= 0) return t("course.study.today");
    if (n === 1) return t("course.study.yesterday");
    return t("course.study.daysAgo", { n });
  })();

  if (error) return <ErrorState onRetry={refresh} />;

  if (loading) return <div className="h-64 bg-muted rounded-xl animate-pulse" />;
  if (!c) return <EmptyState title={t("course.notFound")} description={t("course.notFound.body")} actionLabel={t("course.notFound.action")} actionTo="/courses" />;

  const cc = courseColor(c.color);

  const openQA = (typeKey) => {
    setQaPreset({ typeKey, courseId: id });
    setQaOpen(true);
  };

  const toggleTask = async (task) => {
    const done = task.status !== "completed";
    await mutate("Task", "update", task.id, { status: done ? "completed" : "todo", completed_date: done ? new Date().toISOString().slice(0, 10) : null });
  };

  // Deletion runs from a pure plan so local and hosted behave identically:
  // optional children are unlinked and kept, required children (exams, grades,
  // attendance) cannot exist without a course and are removed with it.
  const deleteCourse = async ({ keepWork }) => {
    if (!c || busy) return;
    setBusy(true);
    try {
      const plan = planCourseDelete(data, c.id, { keepWork });
      const ops = [
        ...plan.unlink.map((r) => ({ entity: r.entity, op: "update", id: r.id, payload: { course_id: null } })),
        ...plan.remove.map((r) => ({ entity: r.entity, op: "delete", id: r.id })),
        { entity: "Course", op: "delete", id: c.id },
      ];
      await mutateBatch(ops);
      toast({ title: `Course deleted`, description: keepWork ? `${plan.unlink.length} linked items kept without a course.` : `${plan.total} linked items removed too.` });
      setDeleteOpen(false);
      navigate("/courses");
    } catch {
      toast({ title: "Couldn't delete the course", description: "Nothing was removed. Please try again." });
    } finally {
      setBusy(false);
    }
  };

  const archiveCourse = async () => {
    if (!c || busy) return;
    setBusy(true);
    try {
      await mutate("Course", "update", c.id, { archived: true });
      toast({ title: "Course archived", description: "It's hidden from your semester but nothing was deleted." });
      navigate("/courses");
    } catch {
      toast({ title: "Couldn't archive the course. Please try again." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <Link to="/courses" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="w-4 h-4 mr-1.5" />{t("course.back")}</Link>

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
            <Stat label={t("course.stat.current")} value={derived.grade !== null ? fmtGrade(derived.grade) : "—"} />
            <Stat label={t("course.stat.target")} value={fmtGrade(c.target_grade)} />
            <Stat label={t("course.stat.needed")} value={derived.req !== null ? fmtGrade(derived.req) : "—"} />
            <Stat label={t("course.stat.focus")} value={fmtDuration(derived.focusTotal)} />
          </div>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview">{t("course.tab.overview")}</TabsTrigger>
          <TabsTrigger value="tasks">{t("course.tab.tasks")}</TabsTrigger>
          <TabsTrigger value="exams">{t("course.tab.exams")}</TabsTrigger>
          <TabsTrigger value="grades">{t("course.tab.grades")}</TabsTrigger>
          <TabsTrigger value="attendance">{t("course.tab.attendance")}</TabsTrigger>
          <TabsTrigger value="notes">{t("course.tab.notes")}</TabsTrigger>
          <TabsTrigger value="resources">{t("course.tab.resources")}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="p-5">
              <h3 className="um-label mb-3">{t("course.atAGlance")}</h3>
              <div className="space-y-2 text-sm">
                <Row label={t("course.currentGrade")} value={derived.grade !== null ? fmtGrade(derived.grade) : t("course.noGrades")} />
                <Row label={t("course.targetGrade")} value={fmtGrade(c.target_grade)} />
                <Row label={t("course.required")} value={derived.req !== null ? fmtGrade(derived.req) : "—"} />
                <Row label={t("course.tasksCompleted")} value={`${derived.completedTasks} / ${derived.tasks.length}`} />
                <Row label={t("course.focusTime")} value={fmtDuration(derived.focusTotal)} />
                <Row label={t("course.tab.attendance")} value={attendanceGlance} />
              </div>
            </Card>
            <Card className="p-5">
              <h3 className="um-label mb-3">{t("course.quickActions")}</h3>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => openQA("task")}><CheckSquare className="w-3.5 h-3.5 mr-1.5" />{t("course.addTask")}</Button>
                <Button size="sm" variant="outline" onClick={() => openQA("exam")}><GraduationCap className="w-3.5 h-3.5 mr-1.5" />{t("course.addExam")}</Button>
                <Button size="sm" variant="outline" onClick={() => openQA("grade")}><FileText className="w-3.5 h-3.5 mr-1.5" />{t("course.addGrade")}</Button>
                <Button size="sm" variant="outline" onClick={() => openQA("note")}><BookOpen className="w-3.5 h-3.5 mr-1.5" />{t("course.addNote")}</Button>
                <Button size="sm" variant="outline" onClick={() => navigate("/focus")}><Timer className="w-3.5 h-3.5 mr-1.5" />{t("course.study.startFocus")}</Button>
              </div>
              <div className="mt-6 pt-4 border-t border-border space-y-2">
                <Button size="sm" variant="outline" className="w-full justify-start" onClick={archiveCourse} disabled={busy}>
                  <Archive className="w-3.5 h-3.5 mr-1.5" />{t("course.archive")}
                </Button>
                <p className="text-xs text-muted-foreground">{t("course.archive.hint")}</p>
                <Button size="sm" variant="ghost" className="w-full justify-start text-destructive hover:text-destructive" onClick={() => setDeleteOpen(true)} disabled={busy}>{t("course.delete")}</Button>
              </div>
            </Card>
          </div>

          <Card className="p-5 mt-4">
            <h3 className="um-label mb-3">{t("course.studyActivity")}</h3>
            {derived.focus.length === 0 ? (
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <p className="text-sm text-muted-foreground">{t("course.study.empty")}</p>
                <Button size="sm" variant="outline" onClick={() => navigate("/focus")}>
                  <Timer className="w-3.5 h-3.5 mr-1.5" />{t("course.study.start")}
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{t("course.study.sessions")}</div>
                  <div className="font-display text-2xl font-medium tabular-nums mt-0.5">{derived.focus.length}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{t("course.study.total")}</div>
                  <div className="font-display text-2xl font-medium tabular-nums mt-0.5">{fmtDuration(derived.focusTotal)}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{t("course.study.last")}</div>
                  <div className="text-sm font-medium mt-1.5">{lastStudied}</div>
                </div>
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="tasks" className="mt-4">
          {derived.tasks.length === 0 ? <EmptyState icon={CheckSquare} title="No tasks yet" description="Add tasks for this course to track your work." actionLabel="Add task" onAction={() => openQA("task")} /> : (
            <div className="space-y-2">
              {derived.tasks.map((t) => {
                const pm = PRIORITY_META[t.priority];
                return (
                  <Card key={t.id} className="p-3 flex items-center gap-3">
                    <button onClick={() => toggleTask(t)} aria-label={t.status === "completed" ? `Mark ${t.title} as not done` : `Mark ${t.title} as done`} className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 ${t.status === "completed" ? "bg-emerald-500 border-emerald-500" : "border-border"}`}>
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

        <TabsContent value="attendance" className="mt-4">
          <AttendancePanel course={c} rows={derived.attendance} mutate={mutate} />
        </TabsContent>

        <TabsContent value="resources" className="mt-4">
          {derived.resources.length === 0 ? (
            <EmptyState
              icon={FolderOpen}
              title={t("course.resources.empty.title")}
              description={t("course.resources.empty.body")}
              actionLabel={t("course.resources.empty.action")}
              onAction={() => openQA("resource")}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {derived.resources.map((r) => (
                <Card key={r.id} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-sm font-medium truncate">{r.name}</div>
                    <span className="chip border-border/70 bg-muted/40 text-muted-foreground shrink-0">{r.type}</span>
                  </div>
                  {r.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{r.description}</p>}
                  {r.url && (
                    <a href={r.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary mt-2 hover:underline">
                      {t("action.open")} <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="notes" className="mt-4">
          {derived.notes.length === 0 ? <EmptyState icon={FileText} title="No notes yet" description="Link notes to this course to keep everything together." actionLabel="Add note" onAction={() => openQA("note")} /> : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {derived.notes.map((n) => (
                <Link key={n.id} to={`/notes/${n.id}`}>
                  <Card className="p-4 hover:border-primary/40 transition-colors">
                    <div className="text-sm font-medium">{n.title}</div>
                    <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{notePreview(n.content, 100)}</div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <QuickAdd open={qaOpen} preset={qaPreset} onClose={() => setQaOpen(false)} />

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title={`Delete ${c.name}?`}
        description="This can't be undone. Choose what happens to the work attached to this course."
        details={
          summary.length > 0 ? (
            <div className="rounded-lg border border-border bg-muted/30 p-3 mt-1 space-y-1.5">
              <div className="text-xs font-medium text-foreground">Attached to this course</div>
              {summary.map((s) => (
                <div key={s.entity} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground capitalize">{s.label}</span>
                  <span className="font-mono">{s.count}</span>
                </div>
              ))}
              <p className="text-[11px] text-muted-foreground pt-1.5 border-t border-border/60">
                Exams, grades and attendance can't exist without a course, so they're removed either way.
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground mt-1">Nothing else is linked to this course.</p>
          )
        }
        confirmLabel="Delete everything"
        busy={busy}
        alternatives={[
          { key: "keep", label: "Keep linked work", variant: "outline" },
        ]}
        onConfirm={(choice) => deleteCourse({ keepWork: choice?.key === "keep" })}
      />
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