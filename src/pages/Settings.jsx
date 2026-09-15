import { useState, useEffect } from "react";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Moon, Sun, Monitor, Globe, Database, LogOut, Download, Loader2, Sparkles, Palette } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { useNavigate } from "react-router-dom";

import { applyTheme, applyAccent, ACCENT_PRESETS } from "@/lib/theme";
import { loadDemoData } from "@/lib/demoData";
import { supabase } from "@/lib/supabase";
import { TABLE } from "@/lib/tables";
import { useI18n, getLang } from "@/lib/i18n";
import { isLocalWorkspace } from "@/lib/repo/select";
import { createLocalRepo } from "@/lib/repo/localRepo";

const EXPORT_ENTITIES = [
  "Course", "ScheduleEvent", "Task", "Exam", "Grade", "Note", "Resource",
  "FocusSession", "Goal", "Habit", "HabitLog", "Project", "Attendance",
];

export default function Settings() {
  const { toast } = useToast();
  const { t } = useI18n();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const local = isLocalWorkspace();
  const localRepo = local ? createLocalRepo() : null;
  const [theme, setTheme] = useState("dark");
  const [accent, setAccent] = useState(() => localStorage.getItem("um-accent") || "amber");
  const [lang, setLang] = useState("en");
  const [exporting, setExporting] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);

  useEffect(() => {
    if (!local) {
      supabase.auth.getUser().then(({ data }) => setLang(data.user?.user_metadata?.language || "en")).catch(() => {});
    } else {
      setLang(getLang());
    }
    const saved = localStorage.getItem("um-theme") || "dark";
    setTheme(saved);
    applyTheme(saved);
  }, [local]);

  const chooseTheme = (t) => {
    setTheme(t);
    localStorage.setItem("um-theme", t);
    applyTheme(t);
    toast({ title: "Theme updated" });
  };

  const saveLang = async (l) => {
    setLang(l);
    if (!local) {
      try { await supabase.auth.updateUser({ data: { language: l } }); } catch {}
    } else {
      localStorage.setItem("unimate-lang", l);
    }
    toast({ title: "Language preference saved" });
  };

  const exportData = async () => {
    setExporting(true);
    try {
      const out = {};
      if (local) {
        EXPORT_ENTITIES.forEach((name) => {
          out[name] = localRepo.list(TABLE[name]) || [];
        });
      } else {
        await Promise.all(EXPORT_ENTITIES.map(async (name) => {
          const { data, error } = await supabase.from(TABLE[name]).select("*");
          out[name] = error ? [] : data || [];
        }));
      }
      const blob = new Blob(
        [JSON.stringify({ exported_at: new Date().toISOString(), data: out }, null, 2)],
        { type: "application/json" }
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `unimate-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Export ready — check your downloads" });
    } catch {
      toast({ title: "Export failed. Please try again." });
    } finally {
      setExporting(false);
    }
  };

  const loadDemo = async () => {
    if (!confirm("This adds a full sample semester (courses, classes, tasks, exams, grades, sticky notes) to your workspace. Continue?")) return;
    setDemoLoading(true);
    try {
      await loadDemoData();
      toast({ title: "Demo semester loaded — go explore!" });
    } catch {
      toast({ title: "Couldn't load the demo data. Please try again." });
    } finally {
      setDemoLoading(false);
    }
  };

  const handleLogout = () => { logout(false); navigate("/login"); };

  return (
    <>
      <PageHeader title={t("title.settings")} subtitle={t("title.settings.subtitle")} />
      <div className="max-w-2xl space-y-5">
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4"><Sun className="w-4 h-4 text-amber-400" /><h2 className="um-label">Appearance</h2></div>
          <div className="grid grid-cols-3 gap-2">
            {[{ k: "dark", label: "Dark", Icon: Moon }, { k: "light", label: "Light", Icon: Sun }, { k: "system", label: "System", Icon: Monitor }].map(({ k, label, Icon }) => (
              <button key={k} onClick={() => chooseTheme(k)} className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-colors ${theme === k ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}>
                <Icon className="w-5 h-5" /><span className="text-sm">{label}</span>
              </button>
            ))}
          </div>

          <div className="mt-5 pt-5 border-t border-border">
            <div className="flex items-center gap-2 mb-3">
              <Palette className="w-4 h-4 text-primary" />
              <h2 className="um-label">Accent color</h2>
            </div>
            <div className="flex flex-wrap gap-2.5">
              {Object.entries(ACCENT_PRESETS).map(([key, a]) => (
                <button
                  key={key}
                  onClick={() => { setAccent(key); applyAccent(key); toast({ title: "Accent updated" }); }}
                  title={a.label}
                  className={`w-8 h-8 rounded-full ${a.swatch} transition-transform ${accent === key ? "ring-2 ring-ring ring-offset-2 ring-offset-background scale-110" : "hover:scale-110"}`}
                />
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-3">Recolors buttons, highlights, and the active states across the app.</p>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4"><Globe className="w-4 h-4 text-cyan-400" /><h2 className="um-label">Language</h2></div>
          <Select value={lang} onValueChange={saveLang}>
            <SelectTrigger className="w-full" aria-label="Language"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="en">English</SelectItem><SelectItem value="es">Español</SelectItem><SelectItem value="ca">Català</SelectItem></SelectContent>
          </Select>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4"><Database className="w-4 h-4 text-emerald-400" /><h2 className="um-label">Data</h2></div>
          <Button variant="outline" className="w-full justify-start" onClick={exportData} disabled={exporting}>
            {exporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
            {exporting ? "Preparing export…" : "Export your data (JSON)"}
          </Button>
          <p className="text-xs text-muted-foreground mt-2">Downloads every course, task, exam, grade, note, and session you've created.</p>
          {local && (
            <p className="text-xs text-muted-foreground mt-2">
              Local workspace — everything is stored on this device. Export any time to keep a backup.
            </p>
          )}
          <Button variant="outline" className="w-full justify-start mt-3" onClick={loadDemo} disabled={demoLoading}>
            {demoLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2 text-primary" />}
            {demoLoading ? "Loading demo data…" : "Load demo data"}
          </Button>
          <p className="text-xs text-muted-foreground mt-2">Fills your workspace with a sample semester — courses, classes, tasks, exams, grades, and sticky notes.</p>
        </Card>

        {!local && (
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-4"><LogOut className="w-4 h-4 text-muted-foreground" /><h2 className="um-label">Account</h2></div>
            <Button variant="outline" className="w-full justify-start text-destructive hover:text-destructive" onClick={handleLogout}>Log out</Button>
          </Card>
        )}
      </div>
    </>
  );
}