import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock, Sparkles } from "lucide-react";
import { usePlan } from "@/lib/usePlan";
import { FEATURE_LABELS, planTier } from "@/lib/plans";

// Shared PRO gate: renders instead of a gated surface when the current plan
// can't unlock the feature. Upgrade is simulated pre-launch (no billing yet).
export default function PlanLocked({ feature = "flashcards", title = "", description = "" }) {
  const { plan, setPlan } = usePlan();
  const label = FEATURE_LABELS[feature] || "this Pro feature";
  const tier = planTier(plan);

  return (
    <div className="max-w-2xl">
      <Card className="p-6">
        <div className="flex items-start gap-4">
          <div className="rounded-2xl bg-hud-amber/10 p-3 shrink-0">
            <Lock className="w-6 h-6 text-hud-amber" />
          </div>
          <div className="flex-1">
            <h2 className="font-display text-lg font-semibold">{title || `${label} is a Pro feature`}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {description ||
                `Your ${tier.label} plan covers the whole organizing core. Upgrade to unlock ${label} and the rest of the Pro intelligence layer.`}
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-4">
              <Button onClick={() => setPlan("pro")}>
                <Sparkles className="w-4 h-4 mr-2" />Upgrade to Pro
              </Button>
              <Button variant="ghost" asChild>
                <Link to="/plans">Compare plans</Link>
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}