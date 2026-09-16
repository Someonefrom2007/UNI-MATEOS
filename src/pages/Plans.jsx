import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { useI18n } from "@/lib/i18n";

const PLANS = [
  {
    name: "FREE", tag: "Organize me", active: true,
    desc: "The core academic operating system.",
    features: ["Dashboard", "Courses, Schedule, Tasks", "Exams & Grades", "Notes & Resources", "Focus, Goals, Habits", "Workload & Insights", "Basic AI context"],
  },
  {
    name: "PRO", tag: "Help me", soon: true,
    desc: "UNI·MATE gets intelligent.",
    features: ["Advanced AI copilot", "Syllabus & document intelligence", "Predictive workload", "Smart study planning", "Flashcards & quizzes", "Exam intelligence", "Advanced analytics"],
  },
  {
    name: "ULTRA", tag: "Work with me", soon: true,
    desc: "Connect to your whole academic world.",
    features: ["Advanced cloud sync", "University integrations", "Study groups & collaboration", "Shared courses", "Campus integrations", "Cross-device intelligence"],
  },
];

export default function Plans() {
  const { t } = useI18n();
  return (
    <>
      <PageHeader title={t("title.plans")} subtitle={t("title.plans.subtitle")} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 max-w-5xl">
        {PLANS.map((p) => (
          <Card key={p.name} className={`p-6 flex flex-col ${p.active ? "border-primary/40" : ""}`}>
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-semibold">{p.name}</h2>
              {p.active ? <span className="text-xs px-2 py-0.5 rounded-full bg-hud-emerald/10 text-hud-emerald border border-hud-emerald/30">Active</span> : <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Coming at launch</span>}
            </div>
            <div className="um-label mt-1">{p.tag}</div>
            <p className="text-sm text-muted-foreground mt-3">{p.desc}</p>
            <div className="space-y-2 mt-5 flex-1">
              {p.features.map((f) => (
                <div key={f} className="flex items-start gap-2 text-sm">
                  <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />{f}
                </div>
              ))}
            </div>
            <div className="mt-5">
              {p.active ? (
                <Button variant="outline" className="w-full" disabled>Current plan</Button>
              ) : (
                <Button variant="outline" className="w-full" disabled>Join Waitlist</Button>
              )}
            </div>
          </Card>
        ))}
      </div>
      <p className="text-xs text-muted-foreground mt-6 max-w-2xl">The free tier is a complete product — not a trial. Pro and Ultra add intelligence and connection on top of a strong foundation.</p>
    </>
  );
}