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
  const { t, lang, setLang } = useI18n();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const local = isLocalWorkspace();
  const localRepo = local ? createLocalRepo() : null;
  const [theme, setTheme] = useState("dark");
  const [accent, setAccent] = useState(() => localStorage.getItem("um-accent") || "amber");
  const [exporting, setExporting] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);

  useEffect(() => {
    // Signed-in users keep their language on the account; the local workspace
    // keeps it on the device (the store persists it either way).
    if (!local) {
      supabase.auth.getUser()
        .then(({ data }) => setLang(data.user?.user_metadata?.language || getLang()))
        .catch(() => {});
    }
    const saved = localStorage.getItem("um-theme") || "dark";
    setTheme(saved);
    applyTheme(saved);
  }, [local]);

  const chooseTheme = (t) => {
    setTheme(t);
    localStorage.setItem("um-theme", t);
    applyTheme(t);
    toast({ title: t("settings.themeUpdated") });
  };

  const saveLang = async (l) => {
    setLang(l);
    if (!local) {
      try { await supabase.auth.updateUser({ data: { language: l } }); } catch {}
    }
    toast({ title: t("settings.languageSaved") });
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
      toast({ title: t("settings.exportReady") });
    } catch {
      toast({ title: t("settings.exportFailed") });
    } finally {
      setExporting(false);
    }
  };

  const loadDemo = async () => {
    if (!confirm("This loads a full sample semester (courses, classes, tasks, exams, grades, notes, stickies, habits, goals). Running it again refreshes that sample rather than duplicating it. Your own courses are left alone. Continue?")) return;
    setDemoLoading(true);
    try {
      await loadDemoData();
      toast({ title: t("settings.demoLoaded") });
    } catch {
      toast({ title: t("settings.demoFailed") });
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
          <div className="flex items-center gap-2 mb-4"><Sun className="w-4 h-4 text-hud-amber" /><h2 className="um-label">{t("settings.appearance")}</h2></div>
          <div className="grid grid-cols-3 gap-2">
            {[{ k: "dark", label: t("settings.theme.dark"), Icon: Moon }, { k: "light", label: t("settings.theme.light"), Icon: Sun }, { k: "system", label: t("settings.theme.system"), Icon: Monitor }].map(({ k, label, Icon }) => (
              <button key={k} onClick={() => chooseTheme(k)} className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-colors ${theme === k ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}>
                <Icon className="w-5 h-5" /><span className="text-sm">{label}</span>
              </button>
            ))}
          </div>

          <div className="mt-5 pt-5 border-t border-border">
            <div className="flex items-center gap-2 mb-3">
              <Palette className="w-4 h-4 text-primary" />
              <h2 className="um-label">{t("settings.accent")}</h2>
            </div>
            <div className="flex flex-wrap gap-2.5">
              {Object.entries(ACCENT_PRESETS).map(([key, a]) => (
                <button
                  key={key}
                  onClick={() => { setAccent(key); applyAccent(key); toast({ title: t("settings.accentUpdated") }); }}
                  title={a.label}
                  className={`w-8 h-8 rounded-full ${a.swatch} transition-transform ${accent === key ? "ring-2 ring-ring ring-offset-2 ring-offset-background scale-110" : "hover:scale-110"}`}
                />
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-3">{t("settings.accent.hint")}</p>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4"><Globe className="w-4 h-4 text-hud-cyan" /><h2 className="um-label">{t("settings.language")}</h2></div>
          <Select value={lang} onValueChange={saveLang}>
            <SelectTrigger className="w-full" aria-label={t("settings.language")}><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="en">English</SelectItem><SelectItem value="es">Español</SelectItem><SelectItem value="ca">Català</SelectItem></SelectContent>
          </Select>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4"><Database className="w-4 h-4 text-hud-emerald" /><h2 className="um-label">{t("settings.data")}</h2></div>
          <Button variant="outline" className="w-full justify-start" onClick={exportData} disabled={exporting}>
            {exporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
            {exporting ? t("settings.exporting") : t("settings.export")}
          </Button>
          <p className="text-xs text-muted-foreground mt-2">{t("settings.export.hint")}</p>
          {local && (
            <p className="text-xs text-muted-foreground mt-2">
              {t("settings.local.hint")}
            </p>
          )}
          <Button variant="outline" className="w-full justify-start mt-3" onClick={loadDemo} disabled={demoLoading}>
            {demoLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2 text-primary" />}
            {demoLoading ? t("settings.loadingDemo") : t("settings.loadDemo")}
          </Button>
          <p className="text-xs text-muted-foreground mt-2">{t("settings.demo.hint")}</p>
        </Card>

        {!local && (
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-4"><LogOut className="w-4 h-4 text-muted-foreground" /><h2 className="um-label">{t("settings.account")}</h2></div>
            <Button variant="outline" className="w-full justify-start text-destructive hover:text-destructive" onClick={handleLogout}>{t("settings.logout")}</Button>
          </Card>
        )}
      </div>
    </>
  );
}