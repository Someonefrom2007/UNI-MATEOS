import { useState } from "react";
import { Link } from "react-router-dom";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { Check, Sparkles, Rocket, Zap } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/AuthContext";
import { usePlan } from "@/lib/usePlan";
import { PLAN_TIERS, planTier } from "@/lib/plans";
import { isLocalWorkspace, getAppRepo } from "@/lib/repo/select";
import { isValidEmail, addLocalWaitlist, isOnLocalWaitlist } from "@/lib/waitlist";

const LOCAL = isLocalWorkspace();
const repo = getAppRepo();

const TIER_FEATURES = {
  free: ["Dashboard", "Courses, Schedule, Tasks", "Exams & Grades", "Notes & Resources", "Focus, Goals, Habits", "Workload & Insights", "Basic AI context"],
  pro: ["Advanced AI copilot", "Syllabus & document intelligence", "Predictive workload", "Smart study planning", "Flashcards & quizzes", "Exam intelligence", "Advanced analytics"],
  ultra: ["Advanced cloud sync", "University integrations", "Study groups & collaboration", "Shared courses", "Campus integrations", "Cross-device intelligence"],
};

const TIER_DESC = {
  free: "The core academic operating system.",
  pro: "UNI·MATE gets intelligent.",
  ultra: "Connect to your whole academic world.",
};

export default function Plans() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { plan, tier, setPlan } = usePlan();
  const { toast } = useToast();
  const [email, setEmail] = useState(user?.email || "");
  const [joined, setJoined] = useState(() => (LOCAL ? isOnLocalWaitlist(user?.email || "") : false));
  const [busy, setBusy] = useState(false);

  const switchPlan = async (value) => {
    try {
      await setPlan(value);
      toast({ title: `${planTier(value).label} enabled on this account`, description: "Launch billing will replace this pre-launch toggle." });
    } catch {
      toast({ title: "Couldn't change plan" });
    }
  };

  const joinWaitlist = async () => {
    const clean = email.trim();
    if (!isValidEmail(clean)) {
      toast({ title: "Enter a valid email" });
      return;
    }
    setBusy(true);
    try {
      if (LOCAL) {
        const { ok, duplicate } = addLocalWaitlist(clean, "pro");
        if (ok) {
          setJoined(true);
          toast({ title: duplicate ? "You're already on the list" : "Got it — you're on the list" });
        }
      } else {
        await repo.create("waitlist", { email: clean, tier: "pro", source: "plans" });
        setJoined(true);
        toast({ title: "Got it — you're on the list" });
      }
    } catch {
      toast({ title: "You're already on the launch list" });
    } finally {
      setBusy(false);
    }
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
                    <span className="text-xs px-2 py-0.5 rounded-full bg-hud-emerald/10 text-hud-emerald border border-hud-emerald/30">Active</span>
                  ) : p.value === "pro" ? (
                    <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-hud-violet/10 text-hud-violet border border-hud-violet/30"><Zap className="w-3 h-3" />Popular</span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Discover</span>
                  )}
                </div>
                <div className="um-label mt-1">{p.tag}</div>
                <p className="text-sm text-muted-foreground mt-3">{TIER_DESC[p.value]}</p>
                <ul className="space-y-2 mt-5 flex-1">
                  {TIER_FEATURES[p.value].map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />{f}
                    </li>
                  ))}
                </ul>
                <div className="mt-5">
                  {current ? (
                    <Button variant="outline" className="w-full" disabled>Current plan</Button>
                  ) : (
                    <Button variant={above ? "default" : "outline"} className="w-full" onClick={() => switchPlan(p.value)}>
                      <Sparkles className="w-4 h-4 mr-2" />{above ? `Upgrade to ${p.label}` : `Switch to ${p.label}`}
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>

        <Card className="p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex items-center gap-3 flex-1">
            <div className="rounded-xl bg-hud-cyan/10 p-2.5 shrink-0">
              <Rocket className="w-5 h-5 text-hud-cyan" />
            </div>
            <div>
              <div className="font-medium text-sm">Launch waitlist</div>
              <p className="text-xs text-muted-foreground mt-0.5">Leave your email to stay in the loop — no accounts, no spam, just the launch announcement.</p>
            </div>
          </div>
          {joined ? (
            <span className="text-sm text-hud-emerald flex items-center gap-1.5 shrink-0"><Check className="w-4 h-4" />You're on the list</span>
          ) : (
            <form
              onSubmit={(e) => { e.preventDefault(); joinWaitlist(); }}
              className="flex gap-2 shrink-0 w-full sm:w-auto"
            >
              <Input value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email for the launch waitlist" placeholder="you@university.edu" className="sm:w-64" />
              <Button type="submit" disabled={busy}>{busy ? "Joining…" : "Join"}</Button>
            </form>
          )}
        </Card>

        <div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
          <p>The free tier is a complete product — not a trial. Pro and Ultra add intelligence and connection on top of a strong foundation.</p>
          <p>Billing isn't enabled yet: plan switches are simulated on your profile (hosted) or this device (local workspace). A real checkout replaces this at launch.</p>
          <Link to="/profile" className="text-hud-cyan hover:underline w-fit">Manage profile</Link>
        </div>
      </div>
    </>
  );
}