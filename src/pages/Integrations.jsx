import { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import PlanLocked from "@/components/PlanLocked";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { useI18n } from "@/lib/i18n";
import { usePlan } from "@/lib/usePlan";
import { isLocalWorkspace } from "@/lib/repo/select";
import { loadFeeds } from "@/lib/feedsStore";
import { supabase } from "@/lib/supabase";
import { Link } from "react-router-dom";
import { CalendarDays, Rss, FolderOpen, Smartphone, School, ArrowRight } from "lucide-react";

const LOCAL = isLocalWorkspace();

export default function Integrations() {
  const { t, lang } = useI18n();
  const { can } = usePlan();
  const { toast } = useToast();
  const [feedCount, setFeedCount] = useState(0);
  const [gcal, setGcal] = useState({ state: LOCAL ? t("integrations.status.local") : t("integrations.status.checking"), cls: "bg-muted text-muted-foreground" });
  const [gdrive, setGdrive] = useState({ state: LOCAL ? t("integrations.status.local") : t("integrations.status.checking"), cls: "bg-muted text-muted-foreground", connected: false });
  const [driving, setDriving] = useState(false);

  useEffect(() => {
    setFeedCount(loadFeeds().length);
    if (LOCAL) return;
    (async () => {
      try {
        const res = await supabase.functions.invoke("google-calendar-sync", {
          body: { action: "check" },
        });
        const d = res?.data || {};
        if (!d.configured) {
          setGcal({ state: t("integrations.status.notConfigured"), cls: "bg-muted text-muted-foreground" });
        } else if (d.connected) {
          setGcal({ state: d.email ? `${t("integrations.status.synced")} · ${d.email}` : t("integrations.status.synced"), cls: "bg-hud-emerald/10 text-hud-emerald" });
        } else {
          setGcal({ state: t("integrations.status.notConnected"), cls: "bg-muted text-muted-foreground" });
        }
      } catch {
        setGcal({ state: t("integrations.status.unavailable"), cls: "bg-muted text-muted-foreground" });
      }
      try {
        const res = await supabase.functions.invoke("google-drive", {
          body: { action: "check" },
        });
        const d = res?.data || {};
        if (!d.configured) {
          setGdrive({ state: t("integrations.status.notConfigured"), cls: "bg-muted text-muted-foreground", connected: false });
        } else if (d.connected) {
          setGdrive({ state: d.email ? `${t("integrations.status.synced")} · ${d.email}` : t("integrations.status.synced"), cls: "bg-hud-emerald/10 text-hud-emerald", connected: true });
        } else {
          setGdrive({ state: t("integrations.status.notConnected"), cls: "bg-muted text-muted-foreground", connected: false });
        }
      } catch {
        setGdrive({ state: t("integrations.status.unavailable"), cls: "bg-muted text-muted-foreground", connected: false });
      }
    })();
  }, [lang]);

  const syncDrive = async () => {
    setDriving(true);
    try {
      const res = await supabase.functions.invoke("google-drive", {
        body: { action: "sync" },
      });
      if (res.error) throw res.error;
      if (res.data?.connected === false) {
        toast({ title: t("integrations.drive.needsAttention"), description: res.data.message || t("integrations.drive.reconnect") });
        setGdrive((g) => ({ ...g, connected: false, state: t("integrations.status.notConnected"), cls: "bg-muted text-muted-foreground" }));
      } else {
        toast({
          title: `${t("integrations.drive.syncedTitle")}${res.data?.created ?? 0}${t("integrations.drive.newCount")}${res.data?.updated ?? 0}${t("integrations.drive.updatedCount")}`,
          description: res.data?.skipped > 0 ? `${res.data.skipped}${t("integrations.drive.skipped")}` : undefined,
        });
      }
    } catch {
      toast({ title: t("integrations.drive.syncFailed") });
    } finally {
      setDriving(false);
    }
  };

  if (!can("university_integrations")) {
    return (
      <>
        <PageHeader title={t("title.integrations")} subtitle={t("title.integrations.subtitle")} />
        <PlanLocked
          feature="university_integrations"
          description={t("integrations.locked")}
        />
      </>
    );
  }

  const connectors = [
    {
      key: "calendar",
      icon: <CalendarDays className="w-5 h-5" />,
      name: "Google Calendar",
      state: gcal.state,
      stateCls: gcal.cls,
      desc: t("integrations.calendar.desc"),
      href: "/schedule",
      cta: t("integrations.calendar.cta"),
    },
    {
      key: "drive",
      icon: <FolderOpen className="w-5 h-5" />,
      name: "Google Drive",
      state: gdrive.state,
      stateCls: gdrive.cls,
      desc: t("integrations.drive.desc"),
      href: "/resources",
      cta: t("integrations.drive.cta"),
      onSync: gdrive.connected ? syncDrive : null,
      syncing: driving,
      syncLabel: driving ? t("integrations.drive.syncing") : t("integrations.drive.syncFiles"),
    },
    {
      key: "ics",
      icon: <Rss className="w-5 h-5" />,
      name: t("integrations.ics.name"),
      state: `${feedCount} ${t("integrations.status.subscribed")}`,
      stateCls: feedCount > 0 ? "bg-hud-emerald/10 text-hud-emerald" : "bg-muted text-muted-foreground",
      desc: t("integrations.ics.desc"),
      href: "/schedule",
      cta: feedCount > 0 ? t("integrations.ics.cta.manage") : t("integrations.ics.cta.add"),
    },
    {
      key: "resources",
      icon: <FolderOpen className="w-5 h-5" />,
      name: t("integrations.resources.name"),
      state: t("integrations.status.active"),
      stateCls: "bg-hud-emerald/10 text-hud-emerald",
      desc: t("integrations.resources.desc"),
      href: "/resources",
      cta: t("integrations.resources.cta"),
    },
    {
      key: "mobile",
      icon: <Smartphone className="w-5 h-5" />,
      name: t("integrations.mobile.name"),
      state: t("integrations.status.soon"),
      stateCls: "bg-muted text-muted-foreground",
      desc: t("integrations.mobile.desc"),
      href: "",
      cta: "",
      soon: true,
    },
    {
      key: "lms",
      icon: <School className="w-5 h-5" />,
      name: t("integrations.lms.name"),
      state: t("integrations.status.soon"),
      stateCls: "bg-muted text-muted-foreground",
      desc: t("integrations.lms.desc"),
      href: "",
      cta: "",
      soon: true,
    },
  ];

  return (
    <>
      <PageHeader title={t("title.integrations")} subtitle={t("title.integrations.subtitle")} />
      <div className="max-w-4xl grid grid-cols-1 sm:grid-cols-2 gap-3">
        {connectors.map((c) => (
          <Card key={c.key} className={`p-5 ${c.soon ? "opacity-70" : ""}`}>
            <div className="flex items-start gap-3">
              <span className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-foreground shrink-0">{c.icon}</span>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-display text-base font-semibold">{c.name}</h2>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wide ${c.stateCls}`}>{c.state}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">{c.desc}</p>
                {!c.soon && (
                  <div className="mt-3 flex items-center gap-2 flex-wrap">
                    <Button size="sm" variant="outline" asChild>
                      <Link to={c.href}>{c.cta}<ArrowRight className="w-3.5 h-3.5 ml-1.5" /></Link>
                    </Button>
                    {c.onSync && (
                      <Button size="sm" onClick={c.onSync} disabled={c.syncing}>
                        {c.syncLabel}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card className="p-5 mt-4">
        <p className="text-xs text-muted-foreground">
          {t("integrations.footer")}
        </p>
      </Card>
    </>
  );
}