import { useMemo, useState } from "react";
import { useUserData } from "@/lib/useUserData";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Target, Plus, Trash2 } from "lucide-react";
import QuickAdd from "@/components/QuickAdd";

import { useToast } from "@/components/ui/use-toast";
import { useI18n } from "@/lib/i18n";
import ErrorState from "@/components/ErrorState";

const CATS = ["academic", "productivity", "study", "personal"];

export default function Goals() {
  const { data, loading, error, mutate, refresh } = useUserData();
  const [qaOpen, setQaOpen] = useState(false);
  const { toast } = useToast();
  const { t } = useI18n();

  const goals = useMemo(() => (data?.Goal || []).filter((g) => !g.completed), [data]);

  const updateProgress = async (g, delta) => {
    const current = Math.max(0, (g.current || 0) + delta);
    const completed = g.target > 0 && current >= g.target;
    await mutate("Goal", "update", g.id, { current, completed });
    if (completed) toast({ title: "Goal achieved 🎯" });
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
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {goals.map((g) => {
          const pct = g.target ? Math.min(100, Math.round((g.current / g.target) * 100)) : 0;
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
      <QuickAdd open={qaOpen} onClose={() => setQaOpen(false)} />
    </>
  );
}