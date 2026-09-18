import { Repeat } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n";

export default function HabitsCard({ habits, logs, today }) {
  const { t } = useI18n();
  const doneCount = habits.filter((h) => logs.some((l) => l.habit_id === h.id && l.date === today && l.completed)).length;
  return (
    <Card className="p-5 h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Repeat className="w-4 h-4 text-blue-400" />
          <h2 className="um-label">{t("dash.habitsToday")}</h2>
        </div>
        <span className="text-xs text-muted-foreground">{t("dash.doneOf", { done: doneCount, total: habits.length })}</span>
      </div>
      <div className="space-y-2">
        {habits.slice(0, 5).map((h) => {
          const done = logs.some((l) => l.habit_id === h.id && l.date === today && l.completed);
          return (
            <div key={h.id} className="flex items-center gap-2 text-sm">
              <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${done ? "bg-emerald-500 border-emerald-500" : "border-border"}`}>
                {done && <span className="text-[10px] text-white leading-none">✓</span>}
              </span>
              <span className={`truncate ${done ? "text-muted-foreground line-through" : ""}`}>{h.name}</span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}