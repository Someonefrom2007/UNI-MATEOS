import { useEffect, useMemo, useState } from "react";
import { useUserData } from "@/lib/useUserData";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import { courseColor, relativeDeadline, PRIORITY_META, fmtDuration, todayISO } from "@/lib/format";
import { panicTasks as selectPanicTasks, microCount, microBase, microTitle } from "@/lib/triage";
import { Card } from "@/components/ui/card";
import { CheckSquare, Plus, Timer, Siren, Scissors, Pencil, Trash2, Archive, ArchiveRestore } from "lucide-react";
import QuickAdd from "@/components/QuickAdd";
import TaskEditor from "@/components/TaskEditor";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useToast } from "@/components/ui/use-toast";
import { useNavigate } from "react-router-dom";
import { useI18n } from "@/lib/i18n";
import ErrorState from "@/components/ErrorState";
import { isActive, isArchived, viewForTask, taskViews } from "@/lib/taskEdit";
import { useHighlightRow, highlightRing } from "@/lib/useHighlightRow";

const PRIORITY_GLOW = {
  urgent: "shadow-[0_0_12px_rgba(244,63,94,0.35)]",
  high: "shadow-[0_0_10px_rgba(245,158,11,0.28)]",
  medium: "shadow-[0_0_10px_rgba(34,211,238,0.2)]",
  low: "",
};

export default function Tasks() {
  const { data, loading, error, mutate, refresh } = useUserData();
  const [view, setView] = useState("today");
  const [panic, setPanic] = useState(false);
  const [qaOpen, setQaOpen] = useState(false);
  const [editing, setEditing] = useState(null);   // task row or {} for create
  const [toDelete, setToDelete] = useState(null);
  const [busy, setBusy] = useState(false);
  const { highlightId, register } = useHighlightRow();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { t } = useI18n();
  const todayStr = todayISO();

  const courses = data?.Course || [];
  const activeCourses = useMemo(() => courses.filter((c) => !c.archived), [courses]);

  // Archived tasks are excluded from every working view — workload, counts and
  // triage all read this same filtered set so archiving a task actually removes
  // it from the numbers, not just the list.
  const visible = useMemo(() => (data ? data.Task.filter((t) => !isArchived(t)) : []), [data]);

  // A task opened from search must be on screen when the page lands. The
  // default "today" view hides anything not due today, which would drop the
  // user on an empty list next to a highlight they cannot see. Flipping to the
  // view that actually contains the task keeps the deep link honest.
  useEffect(() => {
    if (!highlightId || !data) return;
    const target = viewForTask(data.Task.find((t) => t.id === highlightId), todayStr);
    if (target) setView(target);
  }, [highlightId, data, todayStr]);

  const tasks = useMemo(() => {
    if (!data) return [];
    let list = view === "archived" ? data.Task.filter(isArchived) : visible;
    if (view === "today") list = list.filter((t) => t.status !== "completed" && t.due_date === todayStr);
    if (view === "upcoming") list = list.filter((t) => t.status !== "completed" && t.due_date && t.due_date >= todayStr);
    if (view === "overdue") list = list.filter((t) => t.status !== "completed" && t.due_date && t.due_date < todayStr);
    if (view === "completed") list = list.filter((t) => t.status === "completed");
    return list.sort((a, b) => (a.due_date || "9999").localeCompare(b.due_date || "9999"));
  }, [data, view, todayStr, visible]);

  const activeCount = visible.filter(isActive).length;
  const overdueCount = visible.filter((t) => t.status !== "completed" && t.due_date && t.due_date < todayStr).length;
  const archivedCount = data ? data.Task.filter(isArchived).length : 0;

  // Panic / triage mode: only uncompleted, non-low-priority items due ≤48h.
  const panicTasks = useMemo(() => {
    if (!data) return [];
    return selectPanicTasks(visible, { todayStr });
  }, [data, todayStr, visible]);

  const breakTask = async (t) => {
    const n = microCount(t);
    const base = microBase(t.title);
    await Promise.all(
      Array.from({ length: n }, (_, i) => mutate("Task", "create", {
        title: microTitle(base, i, n),
        course_id: t.course_id,
        due_date: t.due_date,
        priority: t.priority || "medium",
        estimated_duration: 15,
        status: "todo",
      }))
    );
    toast({ title: `Split into ${n} × 15m micro-tasks` });
  };

  const toggle = async (task) => {
    const done = task.status !== "completed";
    await mutate("Task", "update", task.id, { status: done ? "completed" : "todo", completed_date: done ? todayStr : null });
    if (done) toast({ title: "Task completed" });
  };

  const saveTask = async (patch) => {
    if (editing?.id) {
      await mutate("Task", "update", editing.id, patch);
      toast({ title: "Task updated" });
    } else {
      await mutate("Task", "create", { ...patch, completed_date: patch.status === "completed" ? todayStr : null });
      toast({ title: "Task created" });
    }
  };

  const setArchived = async (task, archived) => {
    await mutate("Task", "update", task.id, { archived });
    toast({ title: archived ? "Task archived" : "Task restored", description: archived ? "Find it under Archived." : undefined });
  };

  const deleteTask = async () => {
    if (!toDelete) return;
    setBusy(true);
    try {
      await mutate("Task", "delete", toDelete.id);
      toast({ title: "Task deleted" });
      setToDelete(null);
    } catch {
      toast({ title: "Couldn't delete the task. Please try again." });
    } finally {
      setBusy(false);
    }
  };

  if (error) return <ErrorState onRetry={refresh} />;

  if (!loading && data && data.Task.length === 0) {
    return (
      <>
        <PageHeader title={t("title.tasks")} subtitle={t("title.tasks.subtitle.empty")} />
        <EmptyState icon={CheckSquare} title="No tasks yet" description="Add your first task — give it a title, a due date, and a course." actionLabel="Add Task" onAction={() => setQaOpen(true)} />
        <QuickAdd open={qaOpen} onClose={() => setQaOpen(false)} />
      </>
    );
  }

  return (
    <>
      <PageHeader title={t("title.tasks")} subtitle={t("title.tasks.subtitle")}>
        <button onClick={() => setQaOpen(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">
          <Plus className="w-4 h-4" /> Add Task
        </button>
      </PageHeader>

      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <span className="cyber-tag"><span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />{t("tasks.clutter")} · {activeCount} {t("tasks.open")}</span>
        <div className="flex items-center gap-2">
          {overdueCount > 0 && <span className="chip text-hud-rose border-hud-rose/30 bg-hud-rose/10">{overdueCount} {t("tasks.overdue")}</span>}
          <button onClick={() => setPanic((v) => !v)} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all ${panic ? "bg-rose-500 text-white shadow-[0_0_18px_rgba(244,63,94,0.55)]" : "border border-hud-rose/40 text-hud-rose bg-hud-rose/5 hover:bg-hud-rose/10"}`}>
            <Siren className="w-3.5 h-3.5" /> {panic ? t("tasks.panicOn") : t("tasks.panicToggle")}
          </button>
        </div>
      </div>

      {panic ? (
        <div className="space-y-2">
          <div className="relative rounded-xl border border-hud-rose/30 bg-hud-rose/5 p-4 overflow-hidden">
            <div className="absolute inset-0 cyber-scanlines opacity-40" />
            <div className="relative">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Siren className="w-4 h-4 text-hud-rose" />
                  <span className="um-label text-hud-rose">{t("tasks.panicMode")}</span>
                </div>
                <span className="chip border-hud-rose/40 bg-hud-rose/10 text-hud-rose">{panicTasks.length} {t("tasks.next48h")}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">Low-priority noise filtered out. Only fire zones due within 48 hours remain — break anything heavy into 15-minute micro-tasks.</p>
            </div>
          </div>
          {loading ? (
            <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-14 bg-muted rounded-lg animate-pulse" />)}</div>
          ) : panicTasks.length === 0 ? (
            <EmptyState title="Zero fire zones" description="Nothing urgent in the next 48 hours. Clear skies." />
          ) : panicTasks.map((t) => {
            const pm = PRIORITY_META[t.priority];
            const course = courses.find((c) => c.id === t.course_id);
            const cc = course ? courseColor(course.color) : null;
            return (
              <Card key={t.id} className="p-3 flex items-center gap-3 group glow-hover border-hud-rose/20">
                <button onClick={() => toggle(t)} className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors ${t.status === "completed" ? "bg-emerald-500 border-emerald-500" : "border-border hover:border-primary"}`}>
                  {t.status === "completed" && <span className="text-[10px] text-white">✓</span>}
                </button>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-medium ${t.status === "completed" ? "line-through text-muted-foreground" : ""}`}>{t.title}</div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                    {course && <span className="flex items-center gap-1"><span className={`w-1.5 h-1.5 rounded-full ${cc.dot}`} />{course.name}</span>}
                    {t.due_date && <span className="text-hud-rose font-medium">{relativeDeadline(t.due_date)}</span>}
                    {t.estimated_duration > 0 && <span>· {fmtDuration(t.estimated_duration)}</span>}
                  </div>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded border ${PRIORITY_GLOW[t.priority] || ""} ${pm.cls}`}>{pm.label}</span>
                <button onClick={() => breakTask(t)} className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-hud-cyan/40 text-hud-cyan text-xs hover:bg-hud-cyan/10 transition-colors" title="Split into 15-minute micro-tasks">
                  <Scissors className="w-3.5 h-3.5" /> Micro-tasks
                </button>
              </Card>
            );
          })}
        </div>
      ) : (
        <>
          <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
            {taskViews.map((v) => (
              <button key={v} onClick={() => setView(v)} className={`px-3 py-1.5 rounded-lg text-sm capitalize whitespace-nowrap transition-all duration-200 ${view === v ? "bg-primary text-primary-foreground shadow-[0_0_14px_rgba(99,102,241,0.35)]" : "text-muted-foreground hover:bg-muted glow-hover"}`}>
                {t(`tasks.views.${v}`)}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-14 bg-muted rounded-lg animate-pulse" />)}</div>
          ) : tasks.length === 0 ? (
            <EmptyState title={view === "completed" ? "Nothing completed yet" : view === "overdue" ? "Nothing overdue — nice." : "Nothing here"} description={view === "today" ? "No tasks due today." : "You're all caught up."} />
          ) : (
            <div className="space-y-2">
              {tasks.map((t) => {
                const pm = PRIORITY_META[t.priority];
                const course = courses.find((c) => c.id === t.course_id);
                const cc = course ? courseColor(course.color) : null;
                const overdue = t.due_date && t.due_date < todayStr && t.status !== "completed";
                return (
                  <Card key={t.id} ref={register(t.id)} className={`p-3 flex items-center gap-3 group glow-hover ${highlightRing(highlightId === t.id)}`}>
<button onClick={() => toggle(t)} aria-label={t.status === "completed" ? `Mark ${t.title} as not done` : `Mark ${t.title} as done`} className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors ${t.status === "completed" ? "bg-emerald-500 border-emerald-500" : "border-border hover:border-primary"}`}>
                      {t.status === "completed" && <span className="text-[10px] text-white">✓</span>}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-medium ${t.status === "completed" ? "line-through text-muted-foreground" : ""}`}>{t.title}</div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        {course && <span className="flex items-center gap-1"><span className={`w-1.5 h-1.5 rounded-full ${cc.dot}`} />{course.name}</span>}
                        {t.due_date && <span className={overdue ? "text-hud-rose font-medium" : ""}>{relativeDeadline(t.due_date)}</span>}
                        {t.estimated_duration > 0 && <span>· {fmtDuration(t.estimated_duration)}</span>}
                      </div>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded border ${PRIORITY_GLOW[t.priority] || ""} ${pm.cls}`}>{pm.label}</span>
                    <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                      {view === "archived" ? (
                        <button onClick={() => setArchived(t, false)} className="p-1.5 rounded hover:bg-muted" title="Restore task" aria-label={`Restore ${t.title}`}>
                          <ArchiveRestore className="w-4 h-4 text-muted-foreground" />
                        </button>
                      ) : (
                        <button onClick={() => setArchived(t, true)} className="p-1.5 rounded hover:bg-muted" title="Archive task" aria-label={`Archive ${t.title}`}>
                          <Archive className="w-4 h-4 text-muted-foreground" />
                        </button>
                      )}
                      <button onClick={() => setEditing(t)} className="p-1.5 rounded hover:bg-muted" title="Edit task" aria-label={`Edit ${t.title}`}>
                        <Pencil className="w-4 h-4 text-muted-foreground" />
                      </button>
                      <button onClick={() => navigate("/focus")} className="p-1.5 rounded hover:bg-muted" title="Start focus">
                        <Timer className="w-4 h-4 text-muted-foreground" />
                      </button>
                      <button onClick={() => setToDelete(t)} className="p-1.5 rounded hover:bg-muted" title="Delete task" aria-label={`Delete ${t.title}`}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}
      <QuickAdd open={qaOpen} onClose={() => setQaOpen(false)} />
      <TaskEditor
        open={editing !== null}
        task={editing?.id ? editing : null}
        courses={activeCourses}
        onSave={saveTask}
        onClose={() => setEditing(null)}
      />
      <ConfirmDialog
        open={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        title="Delete this task?"
        description="Deleting removes it from your workload and history. Archiving keeps it recoverable instead."
        confirmLabel="Delete task"
        busy={busy}
        alternatives={[{ key: "archive", label: "Archive instead", variant: "outline" }]}
        onConfirm={async (choice) => {
          if (choice?.key === "archive") {
            await setArchived(toDelete, true);
            setToDelete(null);
            return;
          }
          await deleteTask();
        }}
      />
    </>
  );
}