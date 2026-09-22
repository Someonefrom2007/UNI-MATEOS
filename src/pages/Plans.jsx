import { useState } from "react";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { Check, Sparkles, Rocket, Zap, ExternalLink, Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/AuthContext";
import { usePlan } from "@/lib/usePlan";
import { PLAN_TIERS, planTier } from "@/lib/plans";
import { isLocalWorkspace, getAppRepo } from "@/lib/repo/select";
import { isValidEmail, addLocalWaitlist, isOnLocalWaitlist } from "@/lib/waitlist";
import { useSubscription, canUpgrade } from "@/lib/billing/useSubscription";
import { getBillingService } from "@/lib/billing/lemonSqueezy";

const LOCAL = isLocalWorkspace();
const repo = getAppRepo();

const FEATURE_KEY_LISTS = {
  free: Array.from({ length: 7 }, (_, i) => `plans.feat.free.${i}`),
  pro: Array.from({ length: 7 }, (_, i) => `plans.feat.pro.${i}`),
  ultimate: Array.from({ length: 6 }, (_, i) => `plans.feat.ultimate.${i}`),
};

export default function Plans() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { plan, tier, setPlan } = usePlan();
  const billing = useSubscription();
  const { toast } = useToast();
  const [email, setEmail] = useState(user?.email || "");
  const [joined, setJoined] = useState(() => (LOCAL ? isOnLocalWaitlist(user?.email || "") : false));
  const [busy, setBusy] = useState(false);
  const [checkingOut, setCheckingOut] = useState(null);

  const upgrade = async (value) => {
    if (!canUpgrade(billing)) {
      // Honest boundary: no fake billing. In the local sandbox the simulated
      // toggle stays (it's a demo), otherwise the tier is Coming soon.
      if (LOCAL) {
        try {
          await setPlan(value);
          toast({ title: `${planTier(value).label}${t("plans.toast.enabledLocal")}`, description: t("plans.toast.enabledLocalDesc") });
        } catch {
          toast({ title: t("plans.toast.couldntChange") });
        }
      } else {
        toast({ title: `${planTier(value).label}${t("plans.toast.comingSoonTitle")}`, description: t("plans.toast.comingSoonDesc") });
      }
      return;
    }
    setCheckingOut(value);
    try {
      const { checkoutUrl } = await getBillingService().startCheckout(value);
      window.open(checkoutUrl, "_blank", "noopener,noreferrer");
      toast({ title: t("plans.toast.checkoutOpened"), description: t("plans.toast.checkoutOpenedDesc") });
    } catch (err) {
      toast({ title: t("plans.toast.checkoutFailed"), description: err.message });
    } finally {
      setCheckingOut(null);
    }
  };

  const manageSubscription = async () => {
    try {
      const { portalUrl } = await getBillingService().manage();
      if (portalUrl) window.open(portalUrl, "_blank", "noopener,noreferrer");
      else toast({ title: t("plans.toast.noPortal"), description: t("plans.toast.noPortalDesc") });
    } catch (err) {
      toast({ title: t("plans.toast.manageFailed"), description: err.message });
    }
  };

  const joinWaitlist = async () => {
    const clean = email.trim();
    if (!isValidEmail(clean)) {
      toast({ title: t("plans.toast.waitlistInvalid") });
      return;
    }
    setBusy(true);
    try {
      if (LOCAL) {
        const { ok, duplicate } = addLocalWaitlist(clean, "pro");
        if (ok) {
          setJoined(true);
          toast({ title: duplicate ? t("plans.toast.waitlistDuplicate") : t("plans.toast.waitlistJoined") });
        }
      } else {
        await repo.create("waitlist", { email: clean, tier: "pro", source: "plans" });
        setJoined(true);
        toast({ title: t("plans.toast.waitlistJoined") });
      }
    } catch {
      toast({ title: t("plans.toast.waitlistExists") });
    } finally {
      setBusy(false);
    }
  };

  const renderCta = (p) => {
    const current = p.value === plan;
    if (current) {
      return (
        <Button variant="outline" className="w-full" disabled>
          {planTier(plan).label === "Free" ? t("plans.active") : t("plans.currentPlan")}
        </Button>
      );
    }
    if (canUpgrade(billing)) {
      return (
        <Button variant={p.rank > tier.rank ? "default" : "outline"} className="w-full" onClick={() => upgrade(p.value)} disabled={checkingOut === p.value}>
          {checkingOut === p.value ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
          {p.rank > tier.rank ? `${t("plans.upgradeTo")} ${p.label}` : `${t("plans.switchTo")} ${p.label}`}
        </Button>
      );
    }
    if (LOCAL) {
      return (
        <Button variant="outline" className="w-full" onClick={() => upgrade(p.value)}>
          {p.rank > tier.rank ? `${t("plans.enable")} ${p.label}` : `${t("plans.switchTo")} ${p.label}`}
          <span className="ml-2 text-[10px] uppercase tracking-wide opacity-70">{t("plans.simulated")}</span>
        </Button>
      );
    }
    return (
      <Button variant="outline" className="w-full" disabled>
        {t("plans.comingSoon")}
      </Button>
    );
  };

  return (
    <>
      <PageHeader title={t("title.plans")} subtitle={t("title.plans.subtitle")} />
      <div className="max-w-5xl space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {PLAN_TIERS.map((p) => {
            const current = p.value === plan;
            const above = p.rank > tier.rank;
            return (
              <Card key={p.value} className={`p-6 flex flex-col ${current ? "border-primary/40" : ""}`}>
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-xl font-semibold">{p.label}</h2>
                  {current ? (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-hud-emerald/10 text-hud-emerald border border-hud-emerald/30">{t("plans.active")}</span>
                  ) : p.value === "pro" ? (
                    <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-hud-violet/10 text-hud-violet border border-hud-violet/30"><Zap className="w-3 h-3" />{t("plans.popular")}</span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{t("plans.discover")}</span>
                  )}
                </div>
                <div className="um-label mt-1">{t(`plans.tag.${p.value}`)}</div>
                <p className="text-sm text-muted-foreground mt-3">{t(`plans.tierDesc.${p.value}`)}</p>
                <ul className="space-y-2 mt-5 flex-1">
                  {FEATURE_KEY_LISTS[p.value].map((k) => (
                    <li key={k} className="flex items-start gap-2 text-sm">
                      <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />{t(k)}
                    </li>
                  ))}
                </ul>
                <div className="mt-5">{renderCta(p)}</div>
              </Card>
            );
          })}
        </div>

        {billing.mode === "hosted" && billing.configured && billing.subscription && (
          <Card className="p-5 flex items-center justify-between gap-4">
            <div>
              <div className="font-medium text-sm">{t("plans.activeSub")}</div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {billing.subscription.tier} · status: {billing.subscription.status || "active"}
                {billing.subscription.renews_at ? ` · ${t("plans.renews")} ${new Date(billing.subscription.renews_at).toLocaleDateString()}` : ""}
                {billing.subscription.cancel_at_period_end ? ` · ${t("plans.cancelsAtEnd")}` : ""}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={manageSubscription}>
              {t("plans.manage")} <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
            </Button>
          </Card>
        )}

        <Card className="p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex items-center gap-3 flex-1">
            <div className="rounded-xl bg-hud-cyan/10 p-2.5 shrink-0">
              <Rocket className="w-5 h-5 text-hud-cyan" />
            </div>
            <div>
              <div className="font-medium text-sm">{t("plans.waitlist")}</div>
              <p className="text-xs text-muted-foreground mt-0.5">{t("plans.waitlist.desc")}</p>
            </div>
          </div>
          {joined ? (
            <span className="text-sm text-hud-emerald flex items-center gap-1.5 shrink-0"><Check className="w-4 h-4" />{t("plans.waitlist.joined")}</span>
          ) : (
            <form
              onSubmit={(e) => { e.preventDefault(); joinWaitlist(); }}
              className="flex gap-2 shrink-0 w-full sm:w-auto"
            >
              <Input value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email for the launch waitlist" placeholder={t("plans.waitlist.email")} className="sm:w-64" />
              <Button type="submit" disabled={busy}>{busy ? t("plans.waitlist.joining") : t("plans.waitlist.join")}</Button>
            </form>
          )}
        </Card>

        <div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
          <p>{t("plans.footer.free")}</p>
          {billing.mode === "hosted" && billing.configured ? (
            <p>{t("plans.footer.hostedConfigured")}</p>
          ) : billing.mode === "hosted" ? (
            <p>{t("plans.footer.hosted")}</p>
          ) : (
            <p>{t("plans.footer.local")}</p>
          )}
        </div>
      </div>
    </>
  );
}