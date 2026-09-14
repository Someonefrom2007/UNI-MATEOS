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

const STEPS = ["Welcome", "About you", "Semester", "Goals", "Courses", "Done"];

export default function Onboarding() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ university: "", degree: "", year: "1", semester: "1", academic_year: "2025/26", goals: [], courses: [], courseName: "", courseCode: "", courseEcts: "" });
  const [demoLoading, setDemoLoading] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const loadDemoAndFinish = async () => {
    setDemoLoading(true);
    try {
      await loadDemoData();
      toast({ title: "Demo semester loaded — take a look around!" });
      navigate("/dashboard");
    } catch {
      toast({ title: "Couldn't load the demo data. Please try again." });
    } finally {
      setDemoLoading(false);
    }
  };

  const finish = async () => {
    try {
      await supabase.auth.updateUser({
        data: { university: form.university, degree: form.degree, year: form.year, interests: form.goals },
      });
    } catch {}
    toast({ title: "You're all set." });
    navigate("/dashboard");
  };

  return (
    <div className="max-w-xl mx-auto py-8">
      <div className="flex items-center justify-between mb-8">
        <Logo size={30} subtext={false} />
        <span className="text-xs text-muted-foreground">{step + 1} / {STEPS.length}</span>
      </div>

      <div className="flex gap-1 mb-8">
        {STEPS.map((_, i) => <div key={i} className={`h-1 flex-1 rounded-full ${i <= step ? "bg-primary" : "bg-muted"}`} />)}
      </div>

      {step === 0 && (
        <div className="text-center py-10">
          <h1 className="font-display text-3xl font-semibold tracking-tight">Your university, organized around you.</h1>
          <p className="text-muted-foreground mt-3 max-w-md mx-auto">UNI·MATE brings your calendar, courses, tasks, exams, grades, notes, and focus into one connected system.</p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button onClick={() => setStep(1)}>Get started <ArrowRight className="w-4 h-4 ml-2" /></Button>
            <Button variant="outline" onClick={loadDemoAndFinish} disabled={demoLoading}>
              {demoLoading ? "Setting up your demo…" : "Explore with demo data"}
            </Button>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <h2 className="font-display text-xl font-semibold">About you</h2>
          <div className="space-y-1.5"><Label>University</Label><Input value={form.university} onChange={(e) => set("university", e.target.value)} placeholder="Universitat de Barcelona" /></div>
          <div className="space-y-1.5"><Label>Degree</Label><Input value={form.degree} onChange={(e) => set("degree", e.target.value)} placeholder="Computer Science" /></div>
          <div className="space-y-1.5"><Label>Year</Label>
            <Select value={form.year} onValueChange={(v) => set("year", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["1", "2", "3", "4", "5+"].map((y) => <SelectItem key={y} value={y}>Year {y}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="flex justify-end"><Button onClick={() => setStep(2)}>Continue <ArrowRight className="w-4 h-4 ml-2" /></Button></div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <h2 className="font-display text-xl font-semibold">Your semester</h2>
          <div className="space-y-1.5"><Label>Semester</Label>
            <Select value={form.semester} onValueChange={(v) => set("semester", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="1">First semester</SelectItem><SelectItem value="2">Second semester</SelectItem><SelectItem value="full_year">Full year</SelectItem><SelectItem value="custom">Custom</SelectItem></SelectContent></Select>
          </div>
          <div className="space-y-1.5"><Label>Academic year</Label><Input value={form.academic_year} onChange={(e) => set("academic_year", e.target.value)} placeholder="2025/26" /></div>
          <div className="flex justify-between"><Button variant="ghost" onClick={() => setStep(1)}><ArrowLeft className="w-4 h-4 mr-2" />Back</Button><Button onClick={() => setStep(3)}>Continue <ArrowRight className="w-4 h-4 ml-2" /></Button></div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <h2 className="font-display text-xl font-semibold">What do you want help with?</h2>
          <p className="text-sm text-muted-foreground">Pick a few — you can change these later.</p>
          <div className="grid grid-cols-2 gap-2">
            {["Assignments", "Timetable", "Exams", "Study planning", "Grades", "Organization", "Focus", "Consistency"].map((g) => {
              const on = form.goals.includes(g);
              return (
                <button key={g} onClick={() => set("goals", on ? form.goals.filter((x) => x !== g) : [...form.goals, g])} className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm transition-colors ${on ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}>
                  {on && <Check className="w-4 h-4 text-primary" />}{g}
                </button>
              );
            })}
          </div>
          <div className="flex justify-between"><Button variant="ghost" onClick={() => setStep(2)}><ArrowLeft className="w-4 h-4 mr-2" />Back</Button><Button onClick={() => setStep(4)}>Continue <ArrowRight className="w-4 h-4 ml-2" /></Button></div>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-4">
          <h2 className="font-display text-xl font-semibold">Add your first course</h2>
          <p className="text-sm text-muted-foreground">Optional — you can add more later from the Courses page.</p>
          <div className="space-y-1.5"><Label>Course name</Label><Input value={form.courseName || ""} onChange={(e) => set("courseName", e.target.value)} placeholder="Algorithms & Data Structures" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Code</Label><Input value={form.courseCode || ""} onChange={(e) => set("courseCode", e.target.value)} placeholder="CS201" /></div>
            <div className="space-y-1.5"><Label>ECTS</Label><Input type="number" value={form.courseEcts || ""} onChange={(e) => set("courseEcts", e.target.value)} placeholder="6" /></div>
          </div>
          <div className="flex justify-between"><Button variant="ghost" onClick={() => setStep(3)}><ArrowLeft className="w-4 h-4 mr-2" />Back</Button><Button onClick={async () => { if (form.courseName) { try { await supabase.from("courses").insert({ name: form.courseName, code: form.courseCode || "", ects: Number(form.courseEcts) || 0, semester: form.semester, academic_year: form.academic_year, target_grade: 7, color: "amber", archived: false }); } catch {} } setStep(5); }}>Continue <ArrowRight className="w-4 h-4 ml-2" /></Button></div>
        </div>
      )}

      {step === 5 && (
        <div className="text-center py-10">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-4"><Check className="w-7 h-7 text-emerald-400" /></div>
          <h1 className="font-display text-2xl font-semibold">You're all set.</h1>
          <p className="text-muted-foreground mt-2 max-w-sm mx-auto">Your academic workspace is ready. Open the dashboard to see your semester come together.</p>
          <Button className="mt-6" onClick={finish}>Open dashboard <ArrowRight className="w-4 h-4 ml-2" /></Button>
        </div>
      )}
    </div>
  );
}