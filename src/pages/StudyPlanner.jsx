import { useEffect, useState, useCallback } from "react";
import PageHeader from "@/components/PageHeader";
import PlanLocked from "@/components/PlanLocked";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { useI18n } from "@/lib/i18n";
import { usePlan } from "@/lib/usePlan";
import { getAppRepo } from "@/lib/repo/select";
import { todayISO, fmtDuration, relativeExam } from "@/lib/format";
import { generateStudyPlan, materializeItems, summarizePlan } from "@/lib/studyPlan";
import { CalendarDays, Plus, Trash2, RefreshCw, Sparkles, Circle, CheckCircle2 } from "lucide-react";

const repo = getAppRepo();

const listOrZero = async (table) => {
  try {
    return (await repo.list(table)) || [];
  } catch {
    return [];
  }
};

const KIND_META = {
  weak_intro: { label: "New", cls: "bg-hud-amber/10 text-hud-amber border-hud-amber/30" },
  mid_intro: { label: "New", cls: "bg-hud-amber/10 text-hud-amber border-hud-amber/30" },
  strong_intro: { label: "New", cls: "bg-hud-amber/10 text-hud-amber border-hud-amber/30" },
  weak_review: { label: "Review", cls: "bg-hud-cyan/10 text-hud-cyan border-hud-cyan/30" },
  mid_review: { label: "Review", cls: "bg-hud-cyan/10 text-hud-cyan border-hud-cyan/30" },
  eve_review: { label: "Eve", cls: "bg-hud-violet/10 text-hud-violet border-hud-violet/30" },
  exam_pass: { label: "Exam", cls: "bg-hud-emerald/10 text-hud-emerald border-hud-emerald/30" },
};

const kindFor = (kind) => KIND_META[kind] || KIND_META.mid_intro;

const byDateAsc = (a, b) => (a.date || "").localeCompare(b.date || "");

const formattedDay = (date) => {
  const d = new Date(`${String(date).slice(0, 10)}T00:00:00`);
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
};

export default function StudyPlanner() {
  const { t } = useI18n();
  const { can } = usePlan();
  const { toast } = useToast();

  const [plans, setPlans] = useState([]);
  const [items, setItems] = useState([]);
  const [exams, setExams] = useState([]);
  const [topics, setTopics] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState("");
  const [formExam, setFormExam] = useState("");
  const [formWindow, setFormWindow] = useState("14");
  const [formBudget, setFormBudget] = useState("90");

  const load = useCallback(async () => {
    const [p, i, e, to] = await Promise.all([
      listOrZero("study_plans"),
      listOrZero("study_plan_items"),
      listOrZero("exams"),
      listOrZero("topics"),
    ]);
    setPlans(p);
    setItems(i);
    setExams(e);
    setTopics(to);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const sortedPlans = plans.slice().sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
  const upcoming = exams
    .filter((e) => e.status !== "completed" && e.date && String(e.date).slice(0, 10) >= todayISO())
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));

  const plan = plans.find((p) => p.id === selectedPlan) || null;
  const planItems = items.filter((i) => i.plan_id === selectedPlan).sort(byDateAsc);
  const summary = summarizePlan(planItems);
  const completedCount = planItems.filter((i) => i.completed).length;
  const progressPct = summary.sessions ? Math.round((completedCount / summary.sessions) * 100) : 0;

  const groups = [];
  planItems.forEach((it) => {
    const last = groups[groups.length - 1];
    if (last && last.date === it.date) last.rows.push(it);
    else groups.push({ date: it.date, rows: [it] });
  });

  if (!can("smart_planning")) {
    return (
      <>
        <PageHeader title={t("title.studyPlan")} subtitle={t("title.studyPlan.subtitle")} />
        <PlanLocked
          feature="smart_planning"
          description="Turn any exam into a day-by-day prep schedule — weakest topics first, spaced reviews up to exam day. A Pro feature layered on your full organizing core."
        />
      </>
    );
  }

  const generate = async () => {
    const exam = exams.find((e) => e.id === formExam);
    if (!exam) return;
    const generated = generateStudyPlan(exam, topics, {
      daysBefore: Number(formWindow) || 14,
      budgetMin: Number(formBudget) || 90,
    });
    if (!generated.length) {
      toast({ title: "Nothing to plan", description: "Pick an upcoming exam with a date." });
      return;
    }
    const row = await repo.create("study_plans", {
      exam_id: exam.id,
      course_id: exam.course_id || null,
      title: `${exam.name} prep`,
      status: "active",
      days_before: Number(formWindow) || 14,
      budget_min: Number(formBudget) || 90,
    });
    for (const item of materializeItems(generated, row.id, "")) {
      await repo.create("study_plan_items", item);
    }
    toast({
      title: "Plan generated",
      description: `${generated.length} sessions · ${fmtDuration(generated.reduce((s, i) => s + i.minutes, 0))} across ${new Set(generated.map((i) => i.date)).size} days.`,
    });
    await load();
    setSelectedPlan(row.id);
  };

  const toggle = async (item) => {
    const completed = !item.completed;
    try {
      await repo.update("study_plan_items", item.id, { completed });
    } catch {
      return;
    }
    setItems(items.map((i) => (i.id === item.id ? { ...i, completed } : i)));
  };

  const regenerate = async () => {
    if (!plan) return;
    const exam = exams.find((e) => e.id === plan.exam_id);
    if (!exam) return;
    const generated = generateStudyPlan(exam, topics, {
      daysBefore: Number(plan.days_before) || 14,
      budgetMin: Number(plan.budget_min) || 90,
    });
    await repo.deleteWhere("study_plan_items", (r) => r.plan_id === plan.id);
    for (const item of materializeItems(generated, plan.id, "")) {
      await repo.create("study_plan_items", item);
    }
    toast({ title: "Plan regenerated" });
    await load();
  };

  const remove = async (id) => {
    await repo.delete("study_plans", id);
    try {
      await repo.deleteWhere("study_plan_items", (r) => r.plan_id === id);
    } catch { /* hosted FK cascades */ }
    if (selectedPlan === id) setSelectedPlan("");
    await load();
  };

  return (
    <>
      <PageHeader title={t("title.studyPlan")} subtitle={t("title.studyPlan.subtitle")} />
      <div className="max-w-5xl grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-5">
        <div className="space-y-4 h-fit">
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <CalendarDays className="w-4 h-4 text-hud-violet" />
              <h2 className="um-label">My plans</h2>
            </div>
            <div className="space-y-1">
              {sortedPlans.map((p) => {
                const total = items.filter((i) => i.plan_id === p.id).length;
                const done = items.filter((i) => i.plan_id === p.id && i.completed).length;
                return (
                  <div
                    key={p.id}
                    className={`flex items-center gap-2 rounded-lg px-2 py-1.5 cursor-pointer text-sm ${selectedPlan === p.id ? "bg-accent/10 text-foreground" : "hover:bg-muted text-muted-foreground"}`}
                  >
                    <button className="flex-1 text-left truncate" onClick={() => setSelectedPlan(p.id)}>
                      {p.title}
                    </button>
                    <span className="text-xs text-muted-foreground">{done}/{total}</span>
                    <button onClick={() => remove(p.id)} aria-label={`Delete ${p.title}`} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
              {sortedPlans.length === 0 && (
                <p className="text-xs text-muted-foreground pt-1">No plans yet — pick an upcoming exam and generate one.</p>
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          {!plan ? (
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="w-4 h-4 text-hud-amber" />
                <h2 className="font-display text-lg font-semibold">Generate a study plan</h2>
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                Choose an upcoming exam — the planner reads your course&apos;s topic mastery to schedule first passes and spaced reviews up to exam day.
              </p>
              {upcoming.length === 0 ? (
                <p className="text-sm text-muted-foreground">No upcoming exams yet. Add one under Exams first so there&apos;s something to plan toward.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5 sm:col-span-2">
                    <div className="um-label text-xs">Exam</div>
                    <Select value={formExam} onValueChange={setFormExam}>
                      <SelectTrigger aria-label="Pick an exam"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {upcoming.map((e) => (
                          <SelectItem key={e.id} value={e.id}>{e.name} — {relativeExam(e.date)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <div className="um-label text-xs">Window</div>
                    <Select value={formWindow} onValueChange={setFormWindow}>
                      <SelectTrigger aria-label="Plan window"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="7">7 days</SelectItem>
                        <SelectItem value="14">14 days</SelectItem>
                        <SelectItem value="21">21 days</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <div className="um-label text-xs">Daily budget</div>
                    <Select value={formBudget} onValueChange={setFormBudget}>
                      <SelectTrigger aria-label="Daily budget"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="60">60 min/day</SelectItem>
                        <SelectItem value="90">90 min/day</SelectItem>
                        <SelectItem value="120">120 min/day</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="sm:col-span-3">
                    <Button onClick={generate} disabled={!formExam}><Plus className="w-4 h-4 mr-2" />Generate plan</Button>
                  </div>
                </div>
              )}
            </Card>
          ) : (
            <>
              <Card className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="font-display text-lg font-semibold">{plan.title}</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {relativeExam(String(exams.find((e) => e.id === plan.exam_id)?.date || ""))} · {plan.days_before}d window · {fmtDuration(plan.budget_min)}/day
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={regenerate}><RefreshCw className="w-4 h-4 mr-1" />Regenerate</Button>
                    <Button size="sm" variant="outline" onClick={() => remove(plan.id)} className="text-destructive hover:text-destructive"><Trash2 className="w-4 h-4 mr-1" />Delete</Button>
                  </div>
                </div>
                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                    <span>{completedCount} of {summary.sessions} sessions done</span>
                    <span>{progressPct}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-hud-emerald transition-all" style={{ width: `${progressPct}%` }} />
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center mt-4">
                  {[
                    ["Sessions", summary.sessions],
                    ["Minutes", summary.minutes],
                    ["Days", summary.days],
                    ["Reviews", summary.reviews],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-xl border border-border/70 p-3">
                      <div className="text-xl font-semibold">{label === "Minutes" ? fmtDuration(value) : value}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="p-5">
                <h2 className="um-label mb-3">Schedule</h2>
                {groups.length === 0 && <p className="text-sm text-muted-foreground">No sessions on this plan — regenerate it.</p>}
                <div className="space-y-4">
                  {groups.map((g) => {
                    const isToday = g.date === todayISO();
                    const dayMinutes = g.rows.reduce((s, r) => s + (Number(r.minutes) || 0), 0);
                    return (
                      <div key={g.date}>
                        <div className={`flex items-center gap-2 text-xs mb-1.5 ${isToday ? "text-hud-amber" : "text-muted-foreground"}`}>
                          <span className="font-medium">{formattedDay(g.date)}</span>
                          {isToday && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-hud-amber/10 text-hud-amber uppercase tracking-wide">Today</span>}
                          <span className="ml-auto">{fmtDuration(dayMinutes)}</span>
                        </div>
                        <div className="space-y-1.5">
                          {g.rows.map((r) => {
                            const meta = kindFor(r.kind);
                            return (
                              <div key={r.id} className={`flex items-start gap-2.5 rounded-lg border border-border/70 p-3 ${r.completed ? "opacity-55" : ""}`}>
                                <button onClick={() => toggle(r)} aria-label={r.completed ? "Mark not done" : "Mark done"} className="mt-0.5 text-muted-foreground hover:text-hud-emerald">
                                  {r.completed ? <CheckCircle2 className="w-4 h-4 text-hud-emerald" /> : <Circle className="w-4 h-4" />}
                                </button>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className={`text-sm font-medium ${r.completed ? "line-through" : ""} truncate`}>{r.label}</span>
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full border uppercase tracking-wide shrink-0 ${meta.cls}`}>{meta.label}</span>
                                  </div>
                                  {r.note && <p className="text-xs text-muted-foreground mt-0.5">{r.note}</p>}
                                </div>
                                <span className="text-xs text-muted-foreground shrink-0">{r.minutes}m</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </>
          )}
        </div>
      </div>
    </>
  );
}