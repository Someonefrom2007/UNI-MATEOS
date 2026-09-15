import { useMemo, useState } from "react";
import { useUserData } from "@/lib/useUserData";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import { Card } from "@/components/ui/card";
import { Repeat, Plus, Trash2, Flame, Check } from "lucide-react";
import QuickAdd from "@/components/QuickAdd";

import { useToast } from "@/components/ui/use-toast";
import { useI18n } from "@/lib/i18n";
import ErrorState from "@/components/ErrorState";

const DAY_MS = 86400000;

export default function Habits() {
  const { data, loading, error, mutate, refresh } = useUserData();
  const [qaOpen, setQaOpen] = useState(false);
  const { toast } = useToast();
  const { t } = useI18n();

  const habits = useMemo(() => (data?.Habit || []).filter((h) => !h.archived), [data]);
  const logs = data?.HabitLog || [];
  const todayStr = new Date().toISOString().slice(0, 10);

  const last7 = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i)); d.setHours(0, 0, 0, 0);
    return d.toISOString().slice(0, 10);
  }), []);

  const streak = (habitId) => {
    const habitLogs = logs.filter((l) => l.habit_id === habitId && l.completed).map((l) => l.date).sort().reverse();
    if (!habitLogs.length) return 0;
    let s = 0;
    const d = new Date(); d.setHours(0, 0, 0, 0);
    // allow today or yesterday as start
    if (habitLogs[0] !== todayStr) {
      const y = new Date(); y.setDate(y.getDate() - 1); y.setHours(0,0,0,0);
      if (habitLogs[0] !== y.toISOString().slice(0,10)) return 0;
    }
    const set = new Set(habitLogs);
    const cur = new Date(d);
    while (set.has(cur.toISOString().slice(0, 10))) {
      s++;
      cur.setDate(cur.getDate() - 1);
    }
    return s;
  };

  const toggle = async (habit, dateStr) => {
    const existing = logs.find((l) => l.habit_id === habit.id && l.date === dateStr);
    if (existing) {
      await mutate("HabitLog", "delete", existing.id);
    } else {
      await mutate("HabitLog", "create", { habit_id: habit.id, date: dateStr, completed: true });
    }
  };

  const remove = async (habit) => {
    if (!confirm(`Delete habit "${habit.name}"?`)) return;
    await mutate("Habit", "delete", habit.id);
    toast({ title: "Habit deleted" });
  };

  if (error) return <ErrorState onRetry={refresh} />;

  if (loading && !data) {
    return (
      <>
        <PageHeader title={t("title.habits")} subtitle={t("title.habits.subtitle")} />
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />)}
        </div>
      </>
    );
  }

  if (habits.length === 0 && data) {
    return (
      <>
        <PageHeader title={t("title.habits")} subtitle={t("title.habits.subtitle")} />
        <EmptyState icon={Repeat} title="No habits yet" description="Add a daily habit — like studying an hour or reviewing notes — and build a streak." actionLabel="Add Habit" onAction={() => setQaOpen(true)} />
        <QuickAdd open={qaOpen} onClose={() => setQaOpen(false)} />
      </>
    );
  }

  return (
    <>
      <PageHeader title="Habits" subtitle="Consistency compounds. Track it without the noise.">
        <button onClick={() => setQaOpen(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">
          <Plus className="w-4 h-4" /> Add Habit
        </button>
      </PageHeader>

      <div className="space-y-3">
        {habits.map((h) => {
          const s = streak(h.id);
          const weekDone = last7.filter((d) => logs.some((l) => l.habit_id === h.id && l.date === d && l.completed)).length;
          return (
            <Card key={h.id} className="p-4 group glow-hover">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Repeat className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <div className="font-medium">{h.name}</div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                      <span className="flex items-center gap-1"><Flame className="w-3 h-3 text-amber-400" />{s} day streak</span>
                      <span>{weekDone}/7 this week</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {last7.map((d) => {
                    const done = logs.some((l) => l.habit_id === h.id && l.date === d && l.completed);
                    const isToday = d === todayStr;
                    return (
                      <button key={d} onClick={() => toggle(h, d)} aria-label={done ? `Mark ${h.name} not done on ${d}` : `Mark ${h.name} done on ${d}`} className={`w-8 h-8 rounded-lg border flex items-center justify-center text-xs transition-colors ${done ? "bg-emerald-500 border-emerald-500 text-white" : "border-border hover:border-primary"} ${isToday ? "ring-2 ring-primary/30" : ""}`} title={d}>
                        {done && <Check className="w-4 h-4" />}
                      </button>
                    );
                  })}
                  <button onClick={() => remove(h)} aria-label={`Delete habit ${h.name}`} className="opacity-0 group-hover:opacity-100 p-2 rounded hover:bg-muted text-destructive transition-opacity ml-1"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
      <QuickAdd open={qaOpen} onClose={() => setQaOpen(false)} />
    </>
  );
}