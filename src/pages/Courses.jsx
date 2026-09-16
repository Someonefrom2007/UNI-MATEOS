import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useUserData } from "@/lib/useUserData";
import { useDeskMode } from "@/hooks/use-desk-mode";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import { courseColor, fmtGrade, relativeDeadline } from "@/lib/format";
import { courseGrade } from "@/lib/gradeEngine";
import { parseSyllabus } from "@/lib/syllabusParser";
import { prepareSyllabusImport, resolveCourseId } from "@/lib/syllabusImporter";
import { Card } from "@/components/ui/card";
import { BookOpen, Plus, ArrowRight, Clock, Upload, FileSpreadsheet, AlertTriangle, Check } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useI18n } from "@/lib/i18n";
import QuickAdd from "@/components/QuickAdd";
import ErrorState from "@/components/ErrorState";

export default function Courses() {
const { data, loading, error, mutate, refresh } = useUserData();
  const { chaos } = useDeskMode();
  const { t } = useI18n();
  const { toast } = useToast();
  const [sort, setSort] = useState("name");
  const [qaOpen, setQaOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importResult, setImportResult] = useState(null);
  const [importing, setImporting] = useState(false);

  const courses = useMemo(() => {
    if (!data) return [];
    return data.Course.filter((c) => !c.archived).map((c) => {
      const grades = data.Grade.filter((g) => g.course_id === c.id);
      const exams = data.Exam.filter((e) => e.course_id === c.id && e.grade !== null && e.grade !== undefined);
      const assessments = [...grades.map((g) => ({ grade: g.grade, weight: g.weight })), ...exams.map((e) => ({ grade: e.grade, weight: e.weight }))];
      const nextDeadline = data.Task.filter((t) => t.course_id === c.id && t.status !== "completed" && t.due_date).sort((a, b) => a.due_date.localeCompare(b.due_date))[0];
      return { ...c, grade: courseGrade(assessments), nextDeadline };
    });
  }, [data]);

  const sorted = useMemo(() => {
    const s = [...courses];
    if (sort === "name") s.sort((a, b) => a.name.localeCompare(b.name));
    if (sort === "grade") s.sort((a, b) => (b.grade ?? -1) - (a.grade ?? -1));
    if (sort === "ects") s.sort((a, b) => (b.ects || 0) - (a.ects || 0));
    if (sort === "deadline") s.sort((a, b) => (a.nextDeadline?.due_date || "9999").localeCompare(b.nextDeadline?.due_date || "9999"));
    return s;
  }, [courses, sort]);

  const handlePreview = () => {
    const result = parseSyllabus(importText);
    setImportResult(result);
  };

  const handleImport = async () => {
    if (!importResult) return;
    setImporting(true);
    try {
      const { courseBundles, taskBundles, examBundles, linkMap } = prepareSyllabusImport(importResult);
      for (const { payload, link } of courseBundles) {
        const created = await mutate("Course", "create", payload);
        if (created && link) linkMap[link] = created.id;
      }
      for (const { payload, courseLink } of taskBundles) {
        await mutate("Task", "create", { ...payload, course_id: resolveCourseId(linkMap, courseLink) });
      }
      for (const { payload, courseLink } of examBundles) {
        await mutate("Exam", "create", { ...payload, course_id: resolveCourseId(linkMap, courseLink) });
      }
      toast({ title: `Imported ${courseBundles.length} courses, ${taskBundles.length} tasks, ${examBundles.length} exams.` });
      setImportOpen(false);
      setImportText("");
      setImportResult(null);
    } catch (err) {
      toast({ title: "Import failed", description: err.message || "Something went wrong." });
    } finally {
      setImporting(false);
    }
  };

  if (error) return <ErrorState onRetry={refresh} />;

  if (!loading && courses.length === 0) {
    return (
      <>
        <PageHeader title={t("title.courses")} subtitle={t("title.courses.subtitle")} />
        <EmptyState icon={BookOpen} title="Your semester is empty." description="Add your first course — or paste your syllabus CSV/JSON to bulk-import the whole semester." actionLabel="Add Course" onAction={() => setQaOpen(true)} />
        <div className="flex justify-center mt-4">
          <button onClick={() => setImportOpen(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-accent/40 text-hud-cyan text-sm font-medium glow-hover hover:bg-accent/10 transition-colors">
            <Upload className="w-4 h-4" /> Import Syllabus CSV
          </button>
        </div>
        <QuickAdd open={qaOpen} onClose={() => setQaOpen(false)} />
        {importOpen && <SyllabusImportModal importText={importText} setImportText={setImportText} importResult={importResult} onPreview={handlePreview} onImport={handleImport} importing={importing} onClose={() => { setImportOpen(false); setImportText(""); setImportResult(null); }} />}
      </>
    );
  }

  return (
    <>
      <PageHeader title="Courses" subtitle="Everything you're studying this semester.">
        <button onClick={() => setImportOpen(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-accent/40 text-hud-cyan text-sm font-medium glow-hover hover:bg-accent/10 transition-colors">
          <Upload className="w-4 h-4" /> Import Syllabus
        </button>
        <button onClick={() => setQaOpen(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">
          <Plus className="w-4 h-4" /> Add Course
        </button>
        <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort courses" className="bg-card border border-border rounded-lg px-2 py-1.5 text-sm">
          <option value="name">Name</option>
          <option value="grade">Grade</option>
          <option value="ects">ECTS</option>
          <option value="deadline">Next deadline</option>
        </select>
      </PageHeader>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="h-44 bg-muted rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sorted.map((c, i) => {
            const cc = courseColor(c.color);
            const status = c.grade === null || c.grade === undefined
              ? { label: "in progress", cls: "text-hud-cyan border-hud-cyan/40 bg-hud-cyan/10" }
              : c.grade >= (c.target_grade ?? 0)
                ? { label: "on track", cls: "text-hud-emerald border-hud-emerald/40 bg-hud-emerald/10" }
                : { label: "below target", cls: "text-hud-amber border-hud-amber/40 bg-hud-amber/10" };
            const pct = c.grade != null ? Math.min(100, Math.max(0, Math.round((c.grade / 10) * 100))) : 0;
            return (
              <Link key={c.id} to={`/courses/${c.id}`}>
                <Card className={`p-5 h-full glow-hover group transition-transform duration-300 ${chaos ? (i % 2 === 0 ? "rotate-1" : "-rotate-1") : "rotate-0"}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${cc.dot}`} />
                      <span className="text-xs font-mono text-muted-foreground transition-colors group-hover:text-hud-cyan">{c.code || "—"}</span>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div className="flex items-start justify-between gap-2 mt-2">
                    <h3 className="font-display text-lg font-semibold leading-tight">{c.name}</h3>
                    <span className={`chip shrink-0 ${status.cls}`}>{status.label}</span>
                  </div>
                  {c.professor && <p className="text-xs text-muted-foreground mt-0.5">{c.professor}</p>}
                  <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-border">
                    <Metric label="Grade" value={c.grade !== null ? fmtGrade(c.grade) : "—"} />
                    <Metric label="Target" value={fmtGrade(c.target_grade)} />
                    <Metric label="ECTS" value={c.ects || "—"} />
                  </div>
                  {c.grade != null && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground mb-1">
                        <span>progression</span><span>{pct}%</span>
                      </div>
                      <div className="h-1 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-violet-500 meter-glow" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )}
                  {c.nextDeadline && (
                    <div className="flex items-center gap-1.5 mt-3 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" /> {relativeDeadline(c.nextDeadline.due_date)}
                    </div>
                  )}
                </Card>
              </Link>
            );
          })}
        </div>
      )}
      <QuickAdd open={qaOpen} onClose={() => setQaOpen(false)} />
      {importOpen && <SyllabusImportModal importText={importText} setImportText={setImportText} importResult={importResult} onPreview={handlePreview} onImport={handleImport} importing={importing} onClose={() => { setImportOpen(false); setImportText(""); setImportResult(null); }} />}
    </>
  );
}

function SyllabusImportModal({ importText, setImportText, importResult, onPreview, onImport, importing, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl max-h-[85vh] bg-card border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-hud-cyan" />
            <h2 className="font-display text-lg font-semibold">Import Syllabus Data</h2>
          </div>
          <button onClick={onClose} aria-label="Close import dialog" className="text-muted-foreground hover:text-foreground">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <p className="text-sm text-muted-foreground">Paste CSV or JSON with columns: <span className="font-mono text-xs text-hud-cyan">type, name, course, code, professor, ects, date, weight, priority, duration</span>. Types: <span className="font-mono text-xs">course | task | exam</span>.</p>
          <textarea value={importText} onChange={(e) => setImportText(e.target.value)} aria-label="Syllabus data to import" placeholder={"type,name,course,code,date,priority,duration\nexam,Final Exam,Linear Algebra,MATH101,2026-06-20,high,180\nhomework,Problem Set 3,MATH101,MATH101,2026-03-15,medium,60"} rows={8} className="w-full font-mono text-xs p-3 rounded-lg border border-border bg-muted/30 text-foreground placeholder:text-muted-foreground/50 resize-none focus:outline-none focus:ring-1 focus:ring-accent/50" />
          {!importResult && (
            <button onClick={onPreview} disabled={!importText.trim()} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-accent/40 text-hud-cyan text-sm font-medium disabled:opacity-50 hover:bg-accent/10 transition-colors">
              <FileSpreadsheet className="w-4 h-4" /> Preview
            </button>
          )}
          {importResult && (
            <>
              {importResult.errors.length > 0 && (
                <div aria-live="polite" className="rounded-lg border border-hud-amber/30 bg-hud-amber/5 p-3">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-hud-amber mb-1"><AlertTriangle className="w-3.5 h-3.5" /> Warnings</div>
                  {importResult.errors.map((e, i) => <p key={i} className="text-[11px] text-muted-foreground">{e}</p>)}
                </div>
              )}
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-lg border border-border p-3"><div className="text-2xl font-bold text-hud-cyan">{importResult.courses.length}</div><div className="text-xs text-muted-foreground">courses</div></div>
                <div className="rounded-lg border border-border p-3"><div className="text-2xl font-bold text-hud-violet">{importResult.tasks.length}</div><div className="text-xs text-muted-foreground">tasks</div></div>
                <div className="rounded-lg border border-border p-3"><div className="text-2xl font-bold text-hud-rose">{importResult.exams.length}</div><div className="text-xs text-muted-foreground">exams</div></div>
              </div>
              <button onClick={onImport} disabled={importing} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50">
                {importing ? "Importing…" : <><Check className="w-4 h-4" /> Import All</>}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-medium text-sm mt-0.5">{value}</div>
    </div>
  );
}