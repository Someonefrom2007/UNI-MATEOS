import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Lock } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { PLAN_IDS, PLANS, PLAN_FEATURES, entitlementFor } from "@/lib/plans";

// Only limits the app actually enforces are listed. §35 requires every tier to
// have limits, but printing one the product does not apply would be a claim
// the code cannot back, so the AI message allowance is deliberately absent
// until the assistant meters usage.
const limitLines = (plan) => {
  const lines = [`Study planning up to ${plan.limits.studyPlanHorizonDays} days ahead`];
  if (plan.limits.cloudSync) lines.push("Cloud sync across devices");
  return lines;
};

export default function Plans() {
  const { t } = useI18n();
  const current = entitlementFor();

  return (
    <>
      <PageHeader title={t("title.plans")} subtitle={t("title.plans.subtitle")} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 max-w-5xl">
        {PLAN_IDS.map((id) => {
          const plan = PLANS[id];
          const active = plan.id === current.id;
          return (
            <Card key={plan.id} className={`p-6 flex flex-col ${active ? "border-primary/40" : ""}`}>
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl font-semibold">{plan.name}</h2>
                {active ? (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-hud-emerald/10 text-hud-emerald border border-hud-emerald/30">Active</span>
                ) : (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground inline-flex items-center gap-1">
                    <Lock className="w-3 h-3" aria-hidden="true" />
                    Coming
                  </span>
                )}
              </div>
              <div className="um-label mt-1">{plan.purpose}</div>
              <p className="text-sm text-muted-foreground mt-3">{plan.tagline}</p>
              <div className="space-y-2 mt-5 flex-1">
                {PLAN_FEATURES[plan.id].map((f) => (
                  <div key={f} className="flex items-start gap-2 text-sm">
                    <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" aria-hidden="true" />
                    {f}
                  </div>
                ))}
              </div>
              <div className="mt-5 pt-4 border-t border-border/60 space-y-1">
                <div className="um-label">Limits</div>
                {limitLines(plan).map((line) => (
                  <p key={line} className="text-xs text-muted-foreground">{line}</p>
                ))}
              </div>
              <div className="mt-5">
                <Button variant="outline" className="w-full" disabled>
                  {active ? "Current plan" : "Not available yet"}
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground mt-6 max-w-2xl">
        Free is a complete product — not a trial. Pro and Ultimate add intelligence and connection on top of it.
        Nothing here is purchasable yet, and nothing you already have is locked behind a plan.
      </p>
    </>
  );
}
