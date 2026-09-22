import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock, Sparkles, Loader2 } from "lucide-react";
import { useState } from "react";
import { usePlan } from "@/lib/usePlan";
import { FEATURE_LABELS, planTier } from "@/lib/plans";
import { isLocalWorkspace } from "@/lib/repo/select";
import { useSubscription, canUpgrade } from "@/lib/billing/useSubscription";
import { getBillingService } from "@/lib/billing/lemonSqueezy";
import { useToast } from "@/components/ui/use-toast";

const LOCAL = isLocalWorkspace();

// Shared Pro gate: renders instead of a gated surface when the current plan
// can't unlock the feature. Upgrade is real when billing is configured,
// Coming-soon when it isn't, and a clearly-labeled simulation in the local
// workspace demo.
export default function PlanLocked({ feature = "flashcards", title = "", description = "" }) {
  const { plan, setPlan } = usePlan();
  const billing = useSubscription();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const label = FEATURE_LABELS[feature] || "this Pro feature";
  const tier = planTier(plan);

  const onUpgrade = async () => {
    setBusy(true);
    if (canUpgrade(billing)) {
      try {
        const { checkoutUrl } = await getBillingService().startCheckout("pro");
        window.open(checkoutUrl, "_blank", "noopener,noreferrer");
        toast({ title: "Checkout opened", description: "Complete it on Lemon Squeezy — access activates automatically." });
      } catch (err) {
        toast({ title: "Couldn't open checkout", description: err.message });
      }
    } else if (LOCAL) {
      await setPlan("pro");
      toast({ title: "Pro enabled (simulated demo)", description: "On the hosted app this becomes a real subscription." });
    } else {
      toast({ title: "Pro is coming soon", description: "Billing isn't configured for this deployment yet." });
    }
    setBusy(false);
  };

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
              <Button onClick={onUpgrade} disabled={busy}>
                {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                {canUpgrade(billing) ? "Upgrade to Pro" : LOCAL ? "Upgrade to Pro (simulated)" : "Pro — coming soon"}
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