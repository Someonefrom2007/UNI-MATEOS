import { useMemo, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useUserData } from "@/lib/useUserData";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import { courseColor, fmtGrade, relativeExam } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GraduationCap, Plus, ArrowLeft, Check, Pencil, Trash2, X } from "lucide-react";
import QuickAdd from "@/components/QuickAdd";
import ExamEditor from "@/components/ExamEditor";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useToast } from "@/components/ui/use-toast";
import { useI18n } from "@/lib/i18n";
import ErrorState from "@/components/ErrorState";

export default function Exams() {
  const { id } = useParams();
  const { data, loading, error, mutate, mutateBatch, refresh } = useUserData();
  const [qaOpen, setQaOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  const { t } = useI18n();

  const exams = useMemo(() => {
    if (!data) return [];
    return data.Exam.sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999"));
  }, [data]);

  const courses = useMemo(() => (data?.Course || []).filter((c) => !c.archived), [data]);

  const saveExam = async (patch) => {
    if (editing?.id) {
      await mutate("Exam", "update", editing.id, patch);
      toast({ title: "Exam updated" });
    } else {
      await mutate("Exam", "create", { ...patch, topics: [] });
      toast({ title: "Exam added" });
    }
  };

  const deleteExam = async () => {
    if (!toDelete) return;
    setBusy(true);
    try {
      // Grades that point at this exam would keep its mark in the course
      // average, so clear the link as part of the same batch.
      const linked = (data?.Grade || []).filter((g) => g.exam_id === toDelete.id);
      await mutateBatch([
        ...linked.map((g) => ({ entity: "Grade", op: "update", id: g.id, payload: { exam_id: null } })),
        { entity: "Exam", op: "delete", id: toDelete.id },
      ]);
      toast({
        title: "Exam deleted",
        description: linked.length ? `${linked.length} linked grade${linked.length === 1 ? "" : "s"} kept, unlinked.` : undefined,
      });
      setToDelete(null);
    } catch {
      toast({ title: "Couldn't delete the exam. Please try again." });
    } finally {
      setBusy(false);
    }
  };

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
                  <div className="flex items-center gap-0.5 shrink-0" onClick={(ev) => ev.preventDefault()}>
                    <button onClick={() => setEditing(e)} className="p-1.5 rounded hover:bg-muted" title="Edit exam" aria-label={`Edit ${e.name}`}>
                      <Pencil className="w-4 h-4 text-muted-foreground" />
                    </button>
                    <button onClick={() => setToDelete(e)} className="p-1.5 rounded hover:bg-muted" title="Delete exam" aria-label={`Delete ${e.name}`}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </button>
                  </div>
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
                  <div className="flex items-center gap-0.5 shrink-0" onClick={(ev) => ev.preventDefault()}>
                    <button onClick={() => setEditing(e)} className="p-1.5 rounded hover:bg-muted" title="Edit exam" aria-label={`Edit ${e.name}`}>
                      <Pencil className="w-4 h-4 text-muted-foreground" />
                    </button>
                    <button onClick={() => setToDelete(e)} className="p-1.5 rounded hover:bg-muted" title="Delete exam" aria-label={`Delete ${e.name}`}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </button>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
      <QuickAdd open={qaOpen} onClose={() => setQaOpen(false)} />
      <ExamEditor open={editing !== null} exam={editing?.id ? editing : null} courses={courses} onSave={saveExam} onClose={() => setEditing(null)} />
      <ConfirmDialog
        open={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        title="Delete this exam?"
        description="Its countdown, topics and preparation progress go with it. Any grade linked to it is kept but unlinked."
        confirmLabel="Delete exam"
        busy={busy}
        onConfirm={deleteExam}
      />
    </>
  );
}

function ExamDetail({ id }) {
  const { data, mutate, mutateBatch } = useUserData();
  const { toast } = useToast();
  // Hooks run before the early return so a missing exam can't change hook order.
  const [topicDraft, setTopicDraft] = useState("");
  const [editingExam, setEditingExam] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const navigate = useNavigate();
  const exam = data?.Exam.find((e) => e.id === id);
  if (!exam) return <EmptyState title="Exam not found" actionLabel="Back to exams" actionTo="/exams" />;
  const course = data?.Course.find((c) => c.id === exam.course_id);
  const cc = course ? courseColor(course.color) : null;
  const topics = exam.topics || [];
  const linkedGrades = (data?.Grade || []).filter((g) => g.exam_id === id);

  const toggleTopic = async (idx) => {
    const newTopics = topics.map((t, i) => i === idx ? { ...t, reviewed: !t.reviewed, mastery: t.reviewed ? (t.mastery || 0) : 100 } : t);
    await mutate("Exam", "update", id, { topics: newTopics });
  };

  const setMastery = async (idx, val) => {
    const newTopics = topics.map((t, i) => i === idx ? { ...t, mastery: val, reviewed: val >= 80 } : t);
    await mutate("Exam", "update", id, { topics: newTopics });
  };

  const addTopic = async (e) => {
    e?.preventDefault();
    const name = topicDraft.trim();
    if (!name) return;
    setSaveError(null);
    try {
      await mutate("Exam", "update", id, { topics: [...topics, { name, mastery: 0, reviewed: false }] });
      setTopicDraft("");
    } catch {
      setSaveError("Couldn't add that topic. Please try again.");
    }
  };

  const removeTopic = async (idx) => {
    setSaveError(null);
    try {
      await mutate("Exam", "update", id, { topics: topics.filter((_, i) => i !== idx) });
    } catch {
      setSaveError("Couldn't remove that topic. Please try again.");
    }
  };

  const saveExam = async (patch) => {
    await mutate("Exam", "update", id, patch);
    toast({ title: "Exam updated" });
  };

  const deleteExam = async () => {
    setBusy(true);
    try {
      const linked = (data?.Grade || []).filter((g) => g.exam_id === id);
      await mutateBatch([
        ...linked.map((g) => ({ entity: "Grade", op: "update", id: g.id, payload: { exam_id: null } })),
        { entity: "Exam", op: "delete", id },
      ]);
      toast({ title: "Exam deleted", description: linked.length ? "Linked grades were kept and unlinked." : undefined });
      navigate("/exams");
    } catch {
      toast({ title: "Couldn't delete the exam. Please try again." });
      setBusy(false);
    }
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
            <p className="text-sm text-muted-foreground mt-1">
              {exam.date || "Date TBD"} · {relativeExam(exam.date)} · {exam.weight || 0}% weight
              {exam.time ? ` · ${exam.time}` : ""}{exam.location ? ` · ${exam.location}` : ""}
            </p>
          </div>
          <div className="flex items-start gap-6">
            {topics.length > 0 && (
              <div className="text-right">
                <div className="um-label">Readiness</div>
                <div className="font-display text-3xl font-semibold mt-1">{readiness}%</div>
              </div>
            )}
            <div className="flex items-center gap-1">
              <Button size="sm" variant="outline" onClick={() => setEditingExam(true)}>
                <Pencil className="w-3.5 h-3.5 mr-1.5" />Edit
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(true)} aria-label="Delete exam">
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          </div>
        </div>
        {(exam.notes || (linkedGrades.length > 0)) && (
          <div className="mt-4 pt-4 border-t border-border/60 space-y-2">
            {exam.notes && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{exam.notes}</p>}
            {linkedGrades.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Counted by {linkedGrades.length} grade{linkedGrades.length === 1 ? "" : "s"}: {linkedGrades.map((g) => g.name).join(", ")}
              </p>
            )}
          </div>
        )}
      </div>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="um-label">Preparation</h2>
          {topics.length > 0 && <span className="text-xs text-muted-foreground">{topics.filter((t) => t.reviewed).length}/{topics.length} reviewed</span>}
        </div>

        <form onSubmit={addTopic} className="flex gap-2 mb-4">
          <Input
            value={topicDraft}
            onChange={(e) => setTopicDraft(e.target.value)}
            placeholder="e.g. Chapter 4 — memory"
            aria-label="New topic"
          />
          <Button type="submit" variant="outline" size="icon" aria-label="Add topic"><Plus className="w-4 h-4" /></Button>
        </form>
        {saveError && <p className="text-xs text-destructive mb-3">{saveError}</p>}

        {topics.length === 0 ? (
          <p className="text-sm text-muted-foreground">No topics yet. Add what this exam covers and UNI·MATE tracks how ready you are per topic.</p>
        ) : (
          <div className="space-y-3">
            {topics.map((t, i) => (
              <div key={`${t.name}-${i}`} className="flex items-center gap-3 group">
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
                <button onClick={() => removeTopic(i)} aria-label={`Remove ${t.name}`} className="p-1 rounded hover:bg-muted opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity">
                  <X className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <ExamEditor
        open={editingExam}
        exam={exam}
        courses={(data?.Course || []).filter((c) => !c.archived)}
        onSave={saveExam}
        onClose={() => setEditingExam(false)}
      />
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete this exam?"
        description="Its countdown, topics and preparation progress go with it. Any grade linked to it is kept but unlinked."
        confirmLabel="Delete exam"
        busy={busy}
        onConfirm={deleteExam}
      />
    </div>
  );
}