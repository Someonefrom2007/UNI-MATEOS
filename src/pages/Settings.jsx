import { useState, useEffect } from "react";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Moon, Sun, Monitor, Globe, Database, LogOut, Download, Loader2, Sparkles, Palette, Bell, BellOff, Trash2, HardDrive } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { useNavigate } from "react-router-dom";

import { applyTheme, applyAccent, ACCENT_PRESETS } from "@/lib/theme";
import { loadDemoData } from "@/lib/demoData";
import { supabase } from "@/lib/supabase";
import { TABLE } from "@/lib/tables";
import { useI18n, getLang, setLang } from "@/lib/i18n";
import { isLocalWorkspace, getAppRepo } from "@/lib/repo/select";
import { createLocalRepo } from "@/lib/repo/localRepo";
import { loadPrefs, savePrefs } from "@/lib/notifyPrefs";

const EXPORT_ENTITIES = [
  "Course", "ScheduleEvent", "Task", "Exam", "Grade", "Note", "Resource",
  "FocusSession", "Goal", "Habit", "HabitLog", "Project", "Attendance",
];

const ALL_ENTITIES = [...EXPORT_ENTITIES, "Topic", "StickyNote"];

const NOTIFY_GROUP_LABELS = {
  academic: "Academic (exams, tasks, free time)",
  milestone: "Milestones (focus streaks)",
  community: "Community (replies to you)",
};

export default function Settings() {
  const { toast } = useToast();
  const { t } = useI18n();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const local = isLocalWorkspace();
  const localRepo = local ? createLocalRepo() : null;
  const [theme, setTheme] = useState("dark");
  const [accent, setAccent] = useState(() => localStorage.getItem("um-accent") || "amber");
  const [lang, setLangState] = useState("en");
  const [exporting, setExporting] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [usage, setUsage] = useState(null);
  const [notifyPrefs, setNotifyPrefs] = useState(() => loadPrefs());

  useEffect(() => {
    const deviceLang = getLang();
    if (!local) {
      supabase.auth.getUser()
        .then(({ data }) => {
          const profileLang = data.user?.user_metadata?.language;
          // Device preference wins; profile is the account-level fallback. Both
          // are kept in sync on save (dual persistence).
          setLangState(profileLang || deviceLang);
        })
        .catch(() => setLangState(deviceLang));
    } else {
      setLangState(deviceLang);
    }
    const saved = localStorage.getItem("um-theme") || "dark";
    setTheme(saved);
    applyTheme(saved);
    computeUsage();
  }, [local]);

  const computeUsage = async () => {
    if (local) {
      let bytes = 0;
      const counts = {};
      ALL_ENTITIES.forEach((name) => {
        const rows = localRepo.list(TABLE[name]) || [];
        counts[name] = rows.length;
        rows.forEach((r) => { bytes += JSON.stringify(r).length; });
      });
      setUsage({ bytes, counts });
      return;
    }
    try {
      const counts = {};
      await Promise.all(ALL_ENTITIES.map(async (name) => {
        try {
          counts[name] = ((await getAppRepo().list(TABLE[name])) || []).length;
        } catch {
          counts[name] = 0;
        }
      }));
      setUsage({ bytes: 0, counts });
    } catch {
      setUsage(null);
    }
  };

  const chooseTheme = (tt) => {
    setTheme(tt);
    localStorage.setItem("um-theme", tt);
    applyTheme(tt);
    toast({ title: "Theme updated" });
  };

  const saveLang = async (l) => {
    setLangState(l);
    setLang(l); // writes the device pref + re-renders the whole app
    if (!local) {
      try { await supabase.auth.updateUser({ data: { language: l } }); } catch {}
    }
    toast({ title: "Language preference saved" });
  };

  const toggleNotify = (group) => {
    const next = { ...notifyPrefs, [group]: !notifyPrefs[group] };
    setNotifyPrefs(next);
    savePrefs(next);
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
          try {
            out[name] = (await getAppRepo().list(TABLE[name])) || [];
          } catch {
            out[name] = [];
          }
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
      computeUsage();
    } catch {
      toast({ title: "Couldn't load the demo data. Please try again." });
    } finally {
      setDemoLoading(false);
    }
  };

  const wipeAll = async () => {
    if (!confirm("This permanently deletes every row in this local workspace — courses, tasks, exams, notes, everything. Export first if you want a backup. Continue?")) return;
    if (!confirm("Are you absolutely sure? There is no undo.")) return;
    setClearing(true);
    try {
      ALL_ENTITIES.forEach((name) => localRepo.clear(TABLE[name]));
      computeUsage();
      toast({ title: "Workspace cleared", description: "Every local row was removed from this device." });
    } catch {
      toast({ title: "Couldn't clear the workspace. Try again." });
    } finally {
      setClearing(false);
    }
  };

  const handleLogout = () => { logout(false); navigate("/login"); };

  const usageLine = () => {
    if (!usage) return null;
    const total = Object.values(usage.counts).reduce((s, n) => s + n, 0);
    if (local) {
      const kb = (usage.bytes / 1024).toFixed(1);
      return `${total} rows · ${kb} KB on this device`;
    }
    return `${total} rows in your account`;
  };

  return (
    <>
      <PageHeader title={t("title.settings")} subtitle={t("title.settings.subtitle")} />
      <div className="max-w-2xl space-y-5">
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4"><Sun className="w-4 h-4 text-hud-amber" /><h2 className="um-label">Appearance</h2></div>
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
          <div className="flex items-center gap-2 mb-4"><Globe className="w-4 h-4 text-hud-cyan" /><h2 className="um-label">Language</h2></div>
          <Select value={lang} onValueChange={saveLang}>
            <SelectTrigger className="w-full" aria-label="Language"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="en">English</SelectItem><SelectItem value="es">Español</SelectItem><SelectItem value="ca">Català</SelectItem></SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-2">
            {local
              ? "Saved to this device."
              : "Saved to your device and your account profile — the next device you sign into inherits it."}
          </p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4"><Bell className="w-4 h-4 text-hud-amber" /><h2 className="um-label">Notifications</h2></div>
          <div className="space-y-2">
            {Object.entries(NOTIFY_GROUP_LABELS).map(([group, label]) => {
              const enabled = notifyPrefs[group] !== false;
              return (
                <button
                  key={group}
                  onClick={() => toggleNotify(group)}
                  className={`w-full flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
                    enabled ? "border-border bg-secondary/40" : "border-border bg-muted/30 opacity-70"
                  }`}
                >
                  <span className="text-sm">{label}</span>
                  <span className={`flex items-center gap-2 text-xs ${enabled ? "text-hud-emerald" : "text-muted-foreground"}`}>
                    {enabled ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
                    {enabled ? "On" : "Off"}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground mt-3">Notification preferences are applied per device, like read-state.</p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4"><Database className="w-4 h-4 text-hud-emerald" /><h2 className="um-label">Data</h2></div>
          <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/30 px-3 py-2 mb-4">
            <HardDrive className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">{usage ? `Stored: ${usageLine()}` : "Counting your data…"}</span>
          </div>
          <Button variant="outline" className="w-full justify-start" onClick={exportData} disabled={exporting}>
            {exporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
            {exporting ? "Preparing export…" : "Export your data (JSON)"}
          </Button>
          <p className="text-xs text-muted-foreground mt-2">Downloads every course, task, exam, grade, note, and session you've created.</p>
          <Button variant="outline" className="w-full justify-start mt-3" onClick={loadDemo} disabled={demoLoading}>
            {demoLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2 text-primary" />}
            {demoLoading ? "Loading demo data…" : "Load demo data"}
          </Button>
          <p className="text-xs text-muted-foreground mt-2">Fills your workspace with a sample semester — courses, classes, tasks, exams, grades, and sticky notes.</p>
          {local ? (
            <>
              <Button variant="outline" className="w-full justify-start mt-3 text-destructive hover:text-destructive" onClick={wipeAll} disabled={clearing}>
                {clearing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                {clearing ? "Clearing workspace…" : "Delete all data on this device"}
              </Button>
              <p className="text-xs text-muted-foreground mt-2">Permanently empties this local workspace. Export a backup first.</p>
            </>
          ) : (
            <p className="text-xs text-muted-foreground mt-3">Data lives in your host account. Export any time; deleting account data is handled in your host project's dashboard.</p>
          )}
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