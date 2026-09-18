import { useMemo, useState } from "react";
import { useUserData } from "@/lib/useUserData";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import { fmtGrade, courseColor } from "@/lib/format";
import { courseGrade, ectsAverage, requiredGrade, projectedGrade } from "@/lib/gradeEngine";
import { clampGrade, updateTargets, targetFeasibility, gradeBandExtended, MATRICULA_DE_HONOR } from "@/lib/gradesim";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { FileText, Plus, Calculator, Gauge, Pencil, Trash2, ChevronDown } from "lucide-react";
import QuickAdd from "@/components/QuickAdd";
import GradeEditor from "@/components/GradeEditor";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useI18n } from "@/lib/i18n";
import ErrorState from "@/components/ErrorState";
import { useToast } from "@/components/ui/use-toast";

export default function Grades() {
  const { data, loading, error, mutate, mutateBatch, refresh } = useUserData();
  const { t } = useI18n();
  const [qaOpen, setQaOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const [busy, setBusy] = useState(false);
  const [openCourse, setOpenCourse] = useState(null);
  const { toast } = useToast();
  const exams = data?.Exam || [];
  const [simCourse, setSimCourse] = useState("");
  const [simTarget, setSimTarget] = useState(8);
  const [simHypo, setSimHypo] = useState(7);

  const [targets, setTargets] = useState({});

  const courses = data?.Course.filter((c) => !c.archived) || [];

  const courseGrades = useMemo(() => {
    if (!data) return [];
    return courses.map((c) => {
      const grades = data.Grade.filter((g) => g.course_id === c.id);
      const exams = data.Exam.filter((e) => e.course_id === c.id && e.grade !== null && e.grade !== undefined);
      const assessments = [...grades.map((g) => ({ grade: g.grade, weight: g.weight })), ...exams.map((e) => ({ grade: e.grade, weight: e.weight }))];
      return { ...c, grade: courseGrade(assessments), assessments, grades };
    });
  }, [data, courses]);

  const gpa = ectsAverage(courseGrades.filter((c) => c.grade !== null));
  const gpaBand = gpa !== null ? gradeBandExtended(gpa) : null;
  const totalEcts = courses.reduce((s, c) => s + (c.ects || 0), 0);

  const sim = useMemo(() => {
    if (!simCourse) return null;
    const c = courseGrades.find((x) => x.id === simCourse);
    if (!c) return null;
    return {
      current: c.grade,
      required: requiredGrade(c.assessments, simTarget),
      projected: projectedGrade(c.assessments, simHypo),
    };
  }, [simCourse, simTarget, simHypo, courseGrades]);

  const saveGrade = async (patch) => {
    if (editing?.id) {
      await mutate("Grade", "update", editing.id, patch);
      toast({ title: "Grade updated" });
    } else {
      await mutate("Grade", "create", patch);
      toast({ title: "Grade added" });
    }
  };

  const deleteGrade = async (choice) => {
    if (!toDelete) return;
    setBusy(true);
    try {
      const ops = [{ entity: "Grade", op: "delete", id: toDelete.id }];
      // A linked exam also carries a mark into the average. Clearing it too is
      // the only way to truly remove this score, so offer it explicitly.
      if (choice?.key === "with-exam" && toDelete.exam_id) {
        ops.push({ entity: "Exam", op: "update", id: toDelete.exam_id, payload: { grade: null, status: "upcoming" } });
      }
      await mutateBatch(ops);
      toast({ title: "Grade deleted" });
      setToDelete(null);
    } catch {
      toast({ title: "Couldn't delete the grade. Please try again." });
    } finally {
      setBusy(false);
    }
  };

  const linkedExam = toDelete?.exam_id ? exams.find((e) => e.id === toDelete.exam_id) : null;

  if (error) return <ErrorState onRetry={refresh} />;

  if (!loading && data && data.Grade.length === 0 && courses.length === 0) {
    return (
      <>
        <PageHeader title={t("title.grades")} subtitle={t("title.grades.subtitle")} />
        <EmptyState icon={FileText} title="No grades yet" description="Add courses and assessments to see your grade average and ECTS progress." actionLabel="Add Course" actionTo="/courses" />
      </>
    );
  }

  return (
    <>
      <PageHeader title="Grades" subtitle="Weighted assessments and grade averages — all calculated for you.">
        <button onClick={() => setQaOpen(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">
          <Plus className="w-4 h-4" /> Add
        </button>
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card className="p-5 glow-hover">
          <div className="um-label mb-2">Overall average</div>
          <div className="flex items-baseline gap-2">
            <span className="font-display text-3xl font-semibold">{gpa !== null ? fmtGrade(gpa) : "—"}</span>
            <span className="text-sm text-muted-foreground">/ 10</span>
          </div>
          {gpaBand && <div className={`text-xs mt-1 ${gpaBand.cls}`}>{gpaBand.en}</div>}
        </Card>
        <Card className="p-5 glow-hover">
          <div className="um-label mb-2">ECTS this semester</div>
          <div className="flex items-baseline gap-2">
            <span className="font-display text-3xl font-semibold">{totalEcts}</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden mt-3">
            <div className="h-full bg-cyan-500 rounded-full meter-glow" style={{ width: `${Math.min(100, (totalEcts / 60) * 100)}%` }} />
          </div>
        </Card>
        <Card className="p-5 glow-hover">
          <div className="um-label mb-2">Courses tracked</div>
          <div className="font-display text-3xl font-semibold">{courses.length}</div>
        </Card>
      </div>

      <Card className="p-0 overflow-hidden mb-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/30">
              <tr className="text-left text-xs text-muted-foreground">
                <th className="px-4 py-3 font-medium">Course</th>
                <th className="px-4 py-3 font-medium">ECTS</th>
                <th className="px-4 py-3 font-medium">Assessments</th>
                <th className="px-4 py-3 font-medium">Current</th>
                <th className="px-4 py-3 font-medium">Target <span className="text-muted-foreground/60">(drag)</span></th>
                <th className="px-4 py-3 font-medium">Final exam score needed</th>
              </tr>
            </thead>
            <tbody>
              {courseGrades.map((c) => {
                const cc = courseColor(c.color);
                const target = clampGrade(targets[c.id] ?? c.target_grade);
                const { required: req, feasible } = targetFeasibility(c.assessments, target);
                const reqCls = req === null ? "text-muted-foreground" : req <= 5 ? "text-hud-emerald" : req <= 8.5 ? "text-hud-amber" : "text-hud-rose";
                const isMH = c.grade !== null && gradeBandExtended(c.grade) === MATRICULA_DE_HONOR;
                const expanded = openCourse === c.id;
                return (
                  <>
                  <tr key={c.id} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setOpenCourse(expanded ? null : c.id)}
                          aria-expanded={expanded}
                          aria-label={`${expanded ? "Hide" : "Show"} assessments for ${c.name}`}
                          className="p-0.5 rounded hover:bg-muted"
                        >
                          <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`} />
                        </button>
                        <span className={`w-2 h-2 rounded-full ${cc.dot}`} />
                        <span className="font-medium">{c.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{c.ects || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{c.grades.length}</td>
                    <td className={`px-4 py-3 font-medium ${isMH ? "text-hud-amber" : ""}`}>{c.grade !== null ? fmtGrade(c.grade) : "—"}{isMH && <span className="ml-1.5 text-[10px] uppercase tracking-wider text-hud-amber/70">MH</span>}</td>
                    <td className="px-4 py-3 min-w-[160px]">
                      <div className="flex items-center gap-3">
                        <Slider
                          min={0}
                          max={10}
                          step={0.5}
                          value={[target]}
                          onValueChange={(v) => setTargets((p) => updateTargets(p, c.id, v[0]))}
                          className="w-28"
                        />
                        <span className="font-mono text-xs text-hud-cyan w-7 shrink-0">{target.toFixed(1)}</span>
                      </div>
                    </td>
                    <td className={`px-4 py-3 font-medium ${reqCls}`}>
                      {req !== null ? fmtGrade(req) : "—"}
                      {req !== null && !feasible && <span className="ml-1.5 text-[10px] uppercase tracking-wider text-hud-rose/70">max</span>}
                    </td>
                  </tr>
                  {expanded && (
                    <tr key={`${c.id}-detail`} className="bg-muted/10 border-b border-border/50">
                      <td colSpan={6} className="px-4 py-3">
                        {c.grades.length === 0 ? (
                          <p className="text-xs text-muted-foreground">No assessments recorded for this course yet.</p>
                        ) : (
                          <ul className="space-y-1.5">
                            {c.grades.map((g) => (
                              <li key={g.id} className="flex items-center gap-3 text-xs group">
                                <span className="font-medium text-foreground">{g.name}</span>
                                <span className="text-muted-foreground capitalize">{g.type}</span>
                                {g.weight > 0 && <span className="text-muted-foreground">{g.weight}%</span>}
                                {g.date && <span className="text-muted-foreground">{g.date}</span>}
                                <span className="font-medium text-hud-cyan ml-auto">{fmtGrade(g.grade)}</span>
                                <button onClick={() => setEditing(g)} className="p-1 rounded hover:bg-muted" title="Edit grade" aria-label={`Edit ${g.name}`}>
                                  <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                                </button>
                                <button onClick={() => setToDelete(g)} className="p-1 rounded hover:bg-muted" title="Delete grade" aria-label={`Delete ${g.name}`}>
                                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                        <button
                          onClick={() => setEditing({ course_id: c.id })}
                          className="mt-3 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          <Plus className="w-3 h-3" /> Add assessment to {c.code || c.name}
                        </button>
                      </td>
                    </tr>
                  )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex items-center gap-2 border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
          <Gauge className="w-3.5 h-3.5 text-hud-cyan shrink-0" />
          Drag any target — the score you'd need across remaining assessments (like the final exam) recomputes live from that course's weights.
        </div>
      </Card>

      {/* Grade simulator */}
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Calculator className="w-4 h-4 text-hud-cyan" />
          <h2 className="um-label">Grade simulator</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Course</Label>
            <Select value={simCourse} onValueChange={setSimCourse}>
              <SelectTrigger aria-label="Course"><SelectValue placeholder="Select course" /></SelectTrigger>
              <SelectContent>{courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Target grade</Label>
            <Select value={String(simTarget)} onValueChange={(v) => setSimTarget(Number(v))}>
              <SelectTrigger aria-label="Target grade"><SelectValue /></SelectTrigger>
              <SelectContent>{[5, 7, 8, 9, 10].map((n) => <SelectItem key={n} value={String(n)}>{fmtGrade(n)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">What if I get…</Label>
            <Select value={String(simHypo)} onValueChange={(v) => setSimHypo(Number(v))}>
              <SelectTrigger aria-label="What if I get"><SelectValue /></SelectTrigger>
              <SelectContent>{[5, 6, 7, 7.5, 8, 8.5, 9, 10].map((n) => <SelectItem key={n} value={String(n)}>{fmtGrade(n)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        {sim && (
          <div className="grid grid-cols-3 gap-3 pt-4 border-t border-border">
            <div><div className="text-xs text-muted-foreground">Current</div><div className="font-display text-xl font-semibold mt-0.5">{sim.current !== null ? fmtGrade(sim.current) : "—"}</div></div>
            <div><div className="text-xs text-muted-foreground">Required for {fmtGrade(simTarget)}</div><div className="font-display text-xl font-semibold mt-0.5 text-hud-amber">{sim.required !== null ? fmtGrade(sim.required) : "—"}</div></div>
            <div><div className="text-xs text-muted-foreground">Projected if {fmtGrade(simHypo)}</div><div className="font-display text-xl font-semibold mt-0.5 text-hud-cyan">{sim.projected !== null ? fmtGrade(sim.projected) : "—"}</div></div>
          </div>
        )}
      </Card>
      <QuickAdd open={qaOpen} onClose={() => setQaOpen(false)} />
      <GradeEditor
        open={editing !== null}
        grade={editing?.id ? editing : null}
        courses={courses}
        exams={exams}
        onSave={saveGrade}
        onClose={() => setEditing(null)}
      />
      <ConfirmDialog
        open={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        title="Delete this grade?"
        description={
          linkedExam
            ? `This grade is linked to ${linkedExam.name}. Deleting it only removes the grade row.`
            : "It will stop counting towards the course average and your ECTS average."
        }
        confirmLabel="Delete grade"
        busy={busy}
        alternatives={linkedExam ? [{ key: "with-exam", label: `Also clear ${linkedExam.name}'s mark`, variant: "outline" }] : []}
        onConfirm={deleteGrade}
      />
    </>
  );
}