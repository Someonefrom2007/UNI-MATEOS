import { useMemo, useState } from "react";
import { useUserData } from "@/lib/useUserData";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import { fmtGrade, courseColor } from "@/lib/format";
import { courseGrade, ectsAverage, requiredGrade, projectedGrade, gradeBand } from "@/lib/gradeEngine";
import { clampGrade, updateTargets, targetFeasibility } from "@/lib/gradesim";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { FileText, Plus, Calculator, Gauge } from "lucide-react";
import QuickAdd from "@/components/QuickAdd";
import { useI18n } from "@/lib/i18n";

export default function Grades() {
  const { data, loading } = useUserData();
  const { t } = useI18n();
  const [qaOpen, setQaOpen] = useState(false);
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
          {gpa !== null && <div className={`text-xs mt-1 ${gradeBand(gpa)?.cls}`}>{gradeBand(gpa)?.en}</div>}
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
                const reqCls = req === null ? "text-muted-foreground" : req <= 5 ? "text-emerald-400" : req <= 8.5 ? "text-amber-400" : "text-rose-400";
                return (
                  <tr key={c.id} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3"><div className="flex items-center gap-2"><span className={`w-2 h-2 rounded-full ${cc.dot}`} /><span className="font-medium">{c.name}</span></div></td>
                    <td className="px-4 py-3 text-muted-foreground">{c.ects || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{c.grades.length}</td>
                    <td className="px-4 py-3 font-medium">{c.grade !== null ? fmtGrade(c.grade) : "—"}</td>
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
                        <span className="font-mono text-xs text-cyan-300 w-7 shrink-0">{target.toFixed(1)}</span>
                      </div>
                    </td>
                    <td className={`px-4 py-3 font-medium ${reqCls}`}>
                      {req !== null ? fmtGrade(req) : "—"}
                      {req !== null && !feasible && <span className="ml-1.5 text-[10px] uppercase tracking-wider text-rose-400/70">max</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex items-center gap-2 border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
          <Gauge className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          Drag any target — the score you'd need across remaining assessments (like the final exam) recomputes live from that course's weights.
        </div>
      </Card>

      {/* Grade simulator */}
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Calculator className="w-4 h-4 text-cyan-400" />
          <h2 className="um-label">Grade simulator</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Course</Label>
            <Select value={simCourse} onValueChange={setSimCourse}>
              <SelectTrigger><SelectValue placeholder="Select course" /></SelectTrigger>
              <SelectContent>{courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Target grade</Label>
            <Select value={String(simTarget)} onValueChange={(v) => setSimTarget(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{[5, 7, 8, 9, 10].map((n) => <SelectItem key={n} value={String(n)}>{fmtGrade(n)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">What if I get…</Label>
            <Select value={String(simHypo)} onValueChange={(v) => setSimHypo(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{[5, 6, 7, 7.5, 8, 8.5, 9, 10].map((n) => <SelectItem key={n} value={String(n)}>{fmtGrade(n)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        {sim && (
          <div className="grid grid-cols-3 gap-3 pt-4 border-t border-border">
            <div><div className="text-xs text-muted-foreground">Current</div><div className="font-display text-xl font-semibold mt-0.5">{sim.current !== null ? fmtGrade(sim.current) : "—"}</div></div>
            <div><div className="text-xs text-muted-foreground">Required for {fmtGrade(simTarget)}</div><div className="font-display text-xl font-semibold mt-0.5 text-amber-400">{sim.required !== null ? fmtGrade(sim.required) : "—"}</div></div>
            <div><div className="text-xs text-muted-foreground">Projected if {fmtGrade(simHypo)}</div><div className="font-display text-xl font-semibold mt-0.5 text-cyan-400">{sim.projected !== null ? fmtGrade(sim.projected) : "—"}</div></div>
          </div>
        )}
      </Card>
      <QuickAdd open={qaOpen} onClose={() => setQaOpen(false)} />
    </>
  );
}