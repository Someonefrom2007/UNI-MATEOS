import { useState, useEffect, useRef } from "react";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Moon, Sun, Monitor, Globe, Database, LogOut, Download, Upload, Loader2, Sparkles, Palette, Bell, BellOff, Trash2, HardDrive } from "lucide-react";
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
import { parseExport, runImport } from "@/lib/dataImport";

const EXPORT_ENTITIES = [
  "Course", "ScheduleEvent", "Task", "Exam", "Grade", "Note", "Resource",
  "FocusSession", "Goal", "Habit", "HabitLog", "Project", "Attendance",
];

const ALL_ENTITIES = [...EXPORT_ENTITIES, "Topic", "StickyNote"];

const NOTIFY_GROUP_KEYS = {
  academic: "settings.notify.academic",
  milestone: "settings.notify.milestone",
  community: "settings.notify.community",
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
  const [importing, setImporting] = useState(false);
  const fileRef = useRef(null);
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
      for (const name of ALL_ENTITIES) {
        const rows = (await localRepo.list(TABLE[name])) || [];
        counts[name] = rows.length;
        rows.forEach((r) => { bytes += JSON.stringify(r).length; });
      }
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
    toast({ title: t("settings.theme.updated") });
  };

  const saveLang = async (l) => {
    setLangState(l);
    setLang(l); // writes the device pref + re-renders the whole app
    if (!local) {
      try { await supabase.auth.updateUser({ data: { language: l } }); } catch {}
    }
    toast({ title: t("settings.language.saved") });
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
        for (const name of EXPORT_ENTITIES) {
          out[name] = (await localRepo.list(TABLE[name])) || [];
        }
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
      toast({ title: t("settings.data.exported") });
    } catch {
      toast({ title: t("settings.data.exportFailed") });
    } finally {
      setExporting(false);
    }
  };

  const loadDemo = async () => {
    if (!confirm(t("settings.confirm.demo"))) return;
    setDemoLoading(true);
    try {
      await loadDemoData();
      toast({ title: t("settings.data.loaded") });
      computeUsage();
    } catch {
      toast({ title: t("settings.data.loadFailed") });
    } finally {
      setDemoLoading(false);
    }
  };

  const importData = async (e) => {
    const file = e.target.files?.[0];
    if (e.target) e.target.value = "";
    if (!file) return;
    let parsed;
    try {
      parsed = parseExport(await file.text());
    } catch {
      parsed = { ok: false };
    }
    if (!parsed.ok) {
      toast({ title: t("settings.data.importFailed") });
      return;
    }
    if (!confirm(t("settings.data.importConfirm"))) return;
    setImporting(true);
    try {
      const total = await runImport(getAppRepo(), parsed.bundle.data);
      const description = `${total.imported} ${t("settings.data.importImported")} · ${total.skipped} ${t("settings.data.importSkipped")} · ${total.failed} ${t("settings.data.importFailures")}`;
      toast({ title: t("settings.data.importDone"), description });
      computeUsage();
    } catch {
      toast({ title: t("settings.data.importFailed") });
    } finally {
      setImporting(false);
    }
  };

  const wipeAll = async () => {
    if (!confirm(t("settings.confirm.wipe1"))) return;
    if (!confirm(t("settings.confirm.wipe2"))) return;
    setClearing(true);
    try {
      await Promise.all(ALL_ENTITIES.map((name) => localRepo.clear(TABLE[name])));
      computeUsage();
      toast({ title: t("settings.data.cleared"), description: t("settings.data.clearedDesc") });
    } catch {
      toast({ title: t("settings.data.couldntClear") });
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
      return `${total} ${t("settings.data.rows")} · ${kb} KB ${t("settings.data.onDevice")}`;
    }
    return `${total} ${t("settings.data.rows")} ${t("settings.data.inAccount")}`;
  };

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
          <p className="text-xs text-muted-foreground mt-4">{t("settings.appearance.desc")}</p>

          <div className="mt-5 pt-5 border-t border-border">
            <div className="flex items-center gap-2 mb-3">
              <Palette className="w-4 h-4 text-primary" />
              <h2 className="um-label">{t("settings.accent")}</h2>
            </div>
            <div className="flex flex-wrap gap-2.5">
              {Object.entries(ACCENT_PRESETS).map(([key, a]) => (
                <button
                  key={key}
                  onClick={() => { setAccent(key); applyAccent(key); toast({ title: t("settings.accent.updated") }); }}
                  title={a.label}
                  className={`w-8 h-8 rounded-full ${a.swatch} transition-transform ${accent === key ? "ring-2 ring-ring ring-offset-2 ring-offset-background scale-110" : "hover:scale-110"}`}
                />
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-3">{t("settings.accent.desc")}</p>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4"><Globe className="w-4 h-4 text-hud-cyan" /><h2 className="um-label">{t("settings.language")}</h2></div>
          <Select value={lang} onValueChange={saveLang}>
            <SelectTrigger className="w-full" aria-label={t("settings.language")}><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="en">English</SelectItem><SelectItem value="es">Español</SelectItem><SelectItem value="ca">Català</SelectItem></SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-2">
            {local
              ? t("settings.language.deviceNote")
              : t("settings.language.profileNote")}
          </p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4"><Bell className="w-4 h-4 text-hud-amber" /><h2 className="um-label">{t("settings.notifications")}</h2></div>
          <div className="space-y-2">
            {Object.entries(NOTIFY_GROUP_KEYS).map(([group, key]) => {
              const enabled = notifyPrefs[group] !== false;
              return (
                <button
                  key={group}
                  onClick={() => toggleNotify(group)}
                  className={`w-full flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
                    enabled ? "border-border bg-secondary/40" : "border-border bg-muted/30 opacity-70"
                  }`}
                >
                  <span className="text-sm">{t(key)}</span>
                  <span className={`flex items-center gap-2 text-xs ${enabled ? "text-hud-emerald" : "text-muted-foreground"}`}>
                    {enabled ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
                    {enabled ? t("settings.notify.on") : t("settings.notify.off")}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground mt-3">{t("settings.notify.note")}</p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4"><Database className="w-4 h-4 text-hud-emerald" /><h2 className="um-label">{t("settings.data")}</h2></div>
          <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/30 px-3 py-2 mb-4">
            <HardDrive className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">{usage ? `${t("settings.data.stored")}: ${usageLine()}` : t("settings.data.counting")}</span>
          </div>
          <Button variant="outline" className="w-full justify-start" onClick={exportData} disabled={exporting}>
            {exporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
            {exporting ? t("settings.data.exporting") : t("settings.data.export")}
          </Button>
          <p className="text-xs text-muted-foreground mt-2">{t("settings.data.exportDesc")}</p>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={importData} />
          <Button variant="outline" className="w-full justify-start mt-3" onClick={() => fileRef.current?.click()} disabled={importing}>
            {importing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
            {importing ? t("settings.data.importing") : t("settings.data.import")}
          </Button>
          <p className="text-xs text-muted-foreground mt-2">{t("settings.data.importDesc")}</p>
          <Button variant="outline" className="w-full justify-start mt-3" onClick={loadDemo} disabled={demoLoading}>
            {demoLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2 text-primary" />}
            {demoLoading ? t("settings.data.demoLoading") : t("settings.data.demo")}
          </Button>
          <p className="text-xs text-muted-foreground mt-2">{t("settings.data.demoDesc")}</p>
          {local ? (
            <>
              <Button variant="outline" className="w-full justify-start mt-3 text-destructive hover:text-destructive" onClick={wipeAll} disabled={clearing}>
                {clearing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                {clearing ? t("settings.data.wiping") : t("settings.data.wipe")}
              </Button>
              <p className="text-xs text-muted-foreground mt-2">{t("settings.data.wipeDesc")}</p>
            </>
          ) : (
            <p className="text-xs text-muted-foreground mt-3">{t("settings.data.hosted")}</p>
          )}
        </Card>

        {!local && (
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-4"><LogOut className="w-4 h-4 text-muted-foreground" /><h2 className="um-label">{t("settings.account")}</h2></div>
            <Button variant="outline" className="w-full justify-start text-destructive hover:text-destructive" onClick={handleLogout}>{t("shell.logout")}</Button>
          </Card>
        )}
      </div>
    </>
  );
}