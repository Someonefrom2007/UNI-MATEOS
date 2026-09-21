import { useMemo, useState } from "react";
import { useUserData } from "@/lib/useUserData";
import { goalProgress } from "@/lib/goalStats";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Target, Plus, Trash2, RotateCcw } from "lucide-react";
import QuickAdd from "@/components/QuickAdd";

import { useToast } from "@/components/ui/use-toast";
import { useI18n } from "@/lib/i18n";
import ErrorState from "@/components/ErrorState";

const CATS = ["academic", "productivity", "study", "personal"];

export default function Goals() {
  const { data, loading, error, mutate, refresh } = useUserData();
  const [qaOpen, setQaOpen] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const { toast } = useToast();
  const { t } = useI18n();

  const goals = useMemo(() => (data?.Goal || []).filter((g) => !g.completed), [data]);
  const completed = useMemo(() => (data?.Goal || []).filter((g) => g.completed), [data]);

  const updateProgress = async (g, delta) => {
    const next = Math.max(0, (g.current || 0) + delta);
    const current = g.target > 0 ? Math.min(g.target, next) : next;
    const done = goalProgress({ ...g, current }).achieved;
    await mutate("Goal", "update", g.id, { current, completed: done });
    if (done) toast({ title: "Goal achieved 🎯" });
  };

  const restore = async (g) => {
    await mutate("Goal", "update", g.id, { completed: false });
    toast({ title: "Goal reopened" });
  };

  const remove = async (g) => {
    if (!confirm(`Delete goal "${g.name}"?`)) return;
    await mutate("Goal", "delete", g.id);
    toast({ title: "Goal deleted" });
  };

  if (error) return <ErrorState onRetry={refresh} />;

  if (loading && !data) {
    return (
      <>
        <PageHeader title={t("title.goals")} subtitle={t("title.goals.subtitle")} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-36 bg-muted rounded-xl animate-pulse" />)}
        </div>
      </>
    );
  }

  if (goals.length === 0 && data) {
    return (
      <>
        <PageHeader title={t("title.goals")} subtitle={t("title.goals.subtitle")} />
        <EmptyState icon={Target} title="No goals yet" description="Set a goal — like finishing the semester with an 8.0 GPA — and track it over time." actionLabel="Add Goal" onAction={() => setQaOpen(true)} />
        <QuickAdd open={qaOpen} onClose={() => setQaOpen(false)} />
      </>
    );
  }

  return (
    <>
      <PageHeader title="Goals" subtitle="Set targets and watch your progress fill in.">
        <button onClick={() => setQaOpen(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">
          <Plus className="w-4 h-4" /> Add Goal
        </button>
        <button onClick={() => setShowDone(!showDone)} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${showDone ? "bg-accent/10 border-accent/50 text-hud-cyan" : "border-border text-muted-foreground hover:border-primary/40"}`}>
          Completed ({completed.length})
        </button>
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {goals.map((g) => {
          const pct = goalProgress(g).pct;
          return (
            <Card key={g.id} className="p-5 group glow-hover">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{g.category}</span>
                  </div>
                  <h3 className="font-medium mt-1">{g.name}</h3>
                  {g.description && <p className="text-xs text-muted-foreground mt-1">{g.description}</p>}
                </div>
                <button onClick={() => remove(g)} aria-label={`Delete goal ${g.name}`} className="opacity-0 group-hover:opacity-100 p-1.5 rounded hover:bg-muted text-destructive transition-opacity"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
              <div className="mt-4">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-muted-foreground">{g.current} / {g.target}</span>
                  <span className="font-medium">{pct}%</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className={`h-full rounded-full ${pct >= 100 ? "bg-emerald-500 meter-glow" : "bg-primary"}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
              <div className="flex items-center gap-2 mt-4">
                <Button size="sm" variant="outline" onClick={() => updateProgress(g, 1)}>+1</Button>
                <Button size="sm" variant="outline" onClick={() => updateProgress(g, -1)}>−1</Button>
                {g.deadline && <span className="text-xs text-muted-foreground ml-auto">by {g.deadline}</span>}
              </div>
            </Card>
          );
        })}
      </div>

      {showDone && (
        <div className="mt-8">
          <h2 className="um-label mb-3">Archived achievements</h2>
          {completed.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing completed yet — get your first one.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {completed.map((g) => {
                const pct = goalProgress(g).pct;
                return (
                  <Card key={g.id} className="p-5 group">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] uppercase tracking-wider text-emerald-500/80">{g.category} · achieved</div>
                        <h3 className="font-medium mt-1 line-through decoration-emerald-500/50">{g.name}</h3>
                        {g.description && <p className="text-xs text-muted-foreground mt-1">{g.description}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mt-4">
                      <span className="text-xs text-muted-foreground">{pct}% of target</span>
                      {g.deadline && <span className="text-xs text-muted-foreground ml-auto">by {g.deadline}</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-4">
                      <Button size="sm" variant="outline" onClick={() => restore(g)}><RotateCcw className="w-3.5 h-3.5 mr-1.5" />Reopen</Button>
                      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => remove(g)}><Trash2 className="w-3.5 h-3.5 mr-1.5" />Delete</Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}
      <QuickAdd open={qaOpen} onClose={() => setQaOpen(false)} />
    </>
  );
}