import { useMemo } from "react";
import { useUserData } from "@/lib/useUserData";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import { generateInsights } from "@/lib/insightsEngine";
import { Card } from "@/components/ui/card";
import { Sparkles, TrendingUp, AlertTriangle, Clock, Target } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import ErrorState from "@/components/ErrorState";

const CAT_ICON = {
  Academic: TrendingUp,
  Productivity: Target,
  Planning: Clock,
  Risk: AlertTriangle,
};

export default function Insights() {
  const { data, loading, error, refresh } = useUserData();
  const { t } = useI18n();

  const insights = useMemo(() => {
    if (!data) return [];
    return generateInsights({
      tasks: data.Task,
      exams: data.Exam,
      focusSessions: data.FocusSession,
      courses: data.Course,
      grades: data.Grade,
      habits: data.Habit,
      habitLogs: data.HabitLog,
    });
  }, [data]);

  const byCat = useMemo(() => {
    const m = {};
    insights.forEach((i) => { (m[i.category] = m[i.category] || []).push(i); });
    return m;
  }, [insights]);

  // Deterministic order: risk first, then the engine's fixed discovery order.
  // Only categories that actually exist are rendered (never a phantom key).
  const orderedCats = useMemo(
    () => [
      ...(byCat.Risk ? ["Risk"] : []),
      ...Object.keys(byCat).filter((c) => c !== "Risk"),
    ],
    [byCat]
  );

  if (error) return <ErrorState onRetry={refresh} />;

  if (!loading && insights.length === 0) {
    return (
      <>
        <PageHeader title={t("title.insights")} subtitle={t("title.insights.subtitle")} />
        <EmptyState icon={Sparkles} title="No insights yet" description="As you add tasks, grades, and focus sessions, UNI·MATE will surface patterns here — based only on real activity." />
      </>
    );
  }

  return (
    <>
      <PageHeader title={t("title.insights")} subtitle={t("title.insights.subtitle")} />

      {orderedCats.map((cat) => {
        const list = byCat[cat];
        const Icon = CAT_ICON[cat] || Sparkles;
        return (
          <div key={cat} className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Icon className="w-4 h-4 text-muted-foreground" />
              <h2 className="um-label">{cat}</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {list.map((ins) => (
                <Card key={ins.id} className="p-4">
                  <p className="text-sm">{ins.text}</p>
                </Card>
              ))}
            </div>
          </div>
        );
      })}

      <p className="text-xs text-muted-foreground mt-8">These patterns are computed only from your real data — UNI·MATE never fabricates signals.</p>
    </>
  );
}