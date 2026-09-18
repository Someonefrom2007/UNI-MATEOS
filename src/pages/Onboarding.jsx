import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, ArrowRight, ArrowLeft } from "lucide-react";

import Logo from "@/components/Logo";
import { useToast } from "@/components/ui/use-toast";
import { loadDemoData } from "@/lib/demoData";
import { supabase } from "@/lib/supabase";
import { isLocalWorkspace } from "@/lib/repo/select";
import { createLocalRepo } from "@/lib/repo/localRepo";
import { useI18n } from "@/lib/i18n";
import { markOnboardingDone, onboardingProfile } from "@/lib/onboarding";

const STEP_KEYS = ["onb.step.welcome", "onb.step.about", "onb.step.semester", "onb.step.goals", "onb.step.courses", "onb.step.done"];

// `value` is the canonical, language-independent label that gets stored in the
// account profile; `key` is what the student reads.
const GOALS = [
  { key: "onb.goal.assignments", value: "Assignments" },
  { key: "onb.goal.timetable", value: "Timetable" },
  { key: "onb.goal.exams", value: "Exams" },
  { key: "onb.goal.studyPlanning", value: "Study planning" },
  { key: "onb.goal.grades", value: "Grades" },
  { key: "onb.goal.organization", value: "Organization" },
  { key: "onb.goal.focus", value: "Focus" },
  { key: "onb.goal.consistency", value: "Consistency" },
];

export default function Onboarding() {
  const local = isLocalWorkspace();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useI18n();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ university: "", degree: "", year: "1", semester: "1", academic_year: "2025/26", goals: [], courses: [], courseName: "", courseCode: "", courseEcts: "" });
  const [demoLoading, setDemoLoading] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const loadDemoAndFinish = async () => {
    setDemoLoading(true);
    try {
      await loadDemoData();
      markOnboardingDone();
      toast({ title: t("onb.demoLoaded") });
      navigate("/dashboard");
    } catch {
      toast({ title: t("onb.demoFailed") });
    } finally {
      setDemoLoading(false);
    }
  };

  const finish = async () => {
    markOnboardingDone();
    if (!local) {
      try {
        await supabase.auth.updateUser({ data: onboardingProfile(form) });
      } catch {}
    }
    toast({ title: t("onb.done.title") });
    navigate("/dashboard");
  };

  const addFirstCourse = async () => {
    if (form.courseName) {
      const payload = {
        name: form.courseName,
        code: form.courseCode || "",
        ects: Number(form.courseEcts) || 0,
        semester: form.semester,
        academic_year: form.academic_year,
        target_grade: 7,
        color: "amber",
        archived: false,
      };
      try {
        if (local) createLocalRepo().create("courses", payload);
        else await supabase.from("courses").insert(payload);
      } catch { /* onboarding never blocks on a single optional course */ }
    }
    setStep(5);
  };

  return (
    <div className="max-w-xl mx-auto py-8">
      <div className="flex items-center justify-between mb-8">
        <Logo size={30} subtext={false} />
        <span className="text-xs text-muted-foreground">{step + 1} / {STEP_KEYS.length}</span>
      </div>

      <div className="flex gap-1 mb-8">
        {STEP_KEYS.map((_, i) => <div key={i} className={`h-1 flex-1 rounded-full ${i <= step ? "bg-primary" : "bg-muted"}`} />)}
      </div>

      {step === 0 && (
        <div className="text-center py-10">
          <h1 className="font-display text-3xl font-semibold tracking-tight">{t("onb.welcome.title")}</h1>
          <p className="text-muted-foreground mt-3 max-w-md mx-auto">{t("onb.welcome.body")}</p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button onClick={() => setStep(1)}>{t("onb.getStarted")} <ArrowRight className="w-4 h-4 ml-2" /></Button>
            <Button variant="outline" onClick={loadDemoAndFinish} disabled={demoLoading}>
              {demoLoading ? t("onb.settingUpDemo") : t("onb.exploreDemo")}
            </Button>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <h2 className="font-display text-xl font-semibold">{t("onb.about.title")}</h2>
          <div className="space-y-1.5"><Label>{t("onb.university")}</Label><Input value={form.university} onChange={(e) => set("university", e.target.value)} aria-label={t("onb.university")} placeholder="Universitat de Barcelona" /></div>
          <div className="space-y-1.5"><Label>{t("onb.degree")}</Label><Input value={form.degree} onChange={(e) => set("degree", e.target.value)} aria-label={t("onb.degree")} placeholder="Computer Science" /></div>
          <div className="space-y-1.5"><Label>{t("onb.year")}</Label>
            <Select value={form.year} onValueChange={(v) => set("year", v)}><SelectTrigger aria-label={t("onb.year")}><SelectValue /></SelectTrigger><SelectContent>{["1", "2", "3", "4", "5+"].map((y) => <SelectItem key={y} value={y}>{t("onb.yearN", { n: y })}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="flex justify-end"><Button onClick={() => setStep(2)}>{t("onb.continue")} <ArrowRight className="w-4 h-4 ml-2" /></Button></div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <h2 className="font-display text-xl font-semibold">{t("onb.semester.title")}</h2>
          <div className="space-y-1.5"><Label>{t("onb.semester.label")}</Label>
            <Select value={form.semester} onValueChange={(v) => set("semester", v)}><SelectTrigger aria-label={t("onb.semester.label")}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="1">{t("onb.semester.first")}</SelectItem><SelectItem value="2">{t("onb.semester.second")}</SelectItem><SelectItem value="full_year">{t("onb.semester.fullYear")}</SelectItem><SelectItem value="custom">{t("onb.semester.custom")}</SelectItem></SelectContent></Select>
          </div>
          <div className="space-y-1.5"><Label>{t("onb.academicYear")}</Label><Input value={form.academic_year} onChange={(e) => set("academic_year", e.target.value)} aria-label={t("onb.academicYear")} placeholder="2025/26" /></div>
          <div className="flex justify-between"><Button variant="ghost" onClick={() => setStep(1)}><ArrowLeft className="w-4 h-4 mr-2" />{t("onb.back")}</Button><Button onClick={() => setStep(3)}>{t("onb.continue")} <ArrowRight className="w-4 h-4 ml-2" /></Button></div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <h2 className="font-display text-xl font-semibold">{t("onb.goals.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("onb.goals.body")}</p>
          <div className="grid grid-cols-2 gap-2">
            {GOALS.map(({ key, value }) => {
              const on = form.goals.includes(value);
              return (
                <button key={value} onClick={() => set("goals", on ? form.goals.filter((x) => x !== value) : [...form.goals, value])} className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm transition-colors ${on ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}>
                  {on && <Check className="w-4 h-4 text-primary" />}{t(key)}
                </button>
              );
            })}
          </div>
          <div className="flex justify-between"><Button variant="ghost" onClick={() => setStep(2)}><ArrowLeft className="w-4 h-4 mr-2" />{t("onb.back")}</Button><Button onClick={() => setStep(4)}>{t("onb.continue")} <ArrowRight className="w-4 h-4 ml-2" /></Button></div>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-4">
          <h2 className="font-display text-xl font-semibold">{t("onb.course.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("onb.course.body")}</p>
          <div className="space-y-1.5"><Label>{t("onb.course.name")}</Label><Input value={form.courseName || ""} onChange={(e) => set("courseName", e.target.value)} aria-label={t("onb.course.name")} placeholder="Algorithms & Data Structures" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>{t("onb.course.code")}</Label><Input value={form.courseCode || ""} onChange={(e) => set("courseCode", e.target.value)} aria-label={t("onb.course.code")} placeholder="CS201" /></div>
            <div className="space-y-1.5"><Label>{t("onb.course.ects")}</Label><Input type="number" value={form.courseEcts || ""} onChange={(e) => set("courseEcts", e.target.value)} aria-label={t("onb.course.ects")} placeholder="6" /></div>
          </div>
          <div className="flex justify-between"><Button variant="ghost" onClick={() => setStep(3)}><ArrowLeft className="w-4 h-4 mr-2" />{t("onb.back")}</Button><Button onClick={addFirstCourse}>{t("onb.continue")} <ArrowRight className="w-4 h-4 ml-2" /></Button></div>
        </div>
      )}

      {step === 5 && (
        <div className="text-center py-10">
          <div className="w-14 h-14 rounded-2xl bg-hud-emerald/10 flex items-center justify-center mx-auto mb-4"><Check className="w-7 h-7 text-hud-emerald" /></div>
          <h1 className="font-display text-2xl font-semibold">{t("onb.done.title")}</h1>
          <p className="text-muted-foreground mt-2 max-w-sm mx-auto">{t("onb.done.body")}</p>
          <Button className="mt-6" onClick={finish}>{t("onb.openDashboard")} <ArrowRight className="w-4 h-4 ml-2" /></Button>
        </div>
      )}
    </div>
  );
}