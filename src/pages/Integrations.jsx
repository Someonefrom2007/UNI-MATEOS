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
  const { t } = useI18n();
  const { can } = usePlan();
  const { toast } = useToast();
  const [feedCount, setFeedCount] = useState(0);
  const [gcal, setGcal] = useState({ state: LOCAL ? "local" : "checking", cls: "bg-muted text-muted-foreground" });
  const [gdrive, setGdrive] = useState({ state: LOCAL ? "local" : "checking", cls: "bg-muted text-muted-foreground", connected: false });
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
          setGcal({ state: "Not configured here", cls: "bg-muted text-muted-foreground" });
        } else if (d.connected) {
          setGcal({ state: d.email ? `Synced · ${d.email}` : "Synced", cls: "bg-hud-emerald/10 text-hud-emerald" });
        } else {
          setGcal({ state: "Not connected", cls: "bg-muted text-muted-foreground" });
        }
      } catch {
        setGcal({ state: "Unavailable", cls: "bg-muted text-muted-foreground" });
      }
      try {
        const res = await supabase.functions.invoke("google-drive", {
          body: { action: "check" },
        });
        const d = res?.data || {};
        if (!d.configured) {
          setGdrive({ state: "Not configured here", cls: "bg-muted text-muted-foreground", connected: false });
        } else if (d.connected) {
          setGdrive({ state: d.email ? `Synced · ${d.email}` : "Synced", cls: "bg-hud-emerald/10 text-hud-emerald", connected: true });
        } else {
          setGdrive({ state: "Not connected", cls: "bg-muted text-muted-foreground", connected: false });
        }
      } catch {
        setGdrive({ state: "Unavailable", cls: "bg-muted text-muted-foreground", connected: false });
      }
    })();
  }, []);

  const syncDrive = async () => {
    setDriving(true);
    try {
      const res = await supabase.functions.invoke("google-drive", {
        body: { action: "sync" },
      });
      if (res.error) throw res.error;
      if (res.data?.connected === false) {
        toast({ title: "Google Drive needs attention", description: res.data.message || "Reconnect to keep syncing." });
        setGdrive((g) => ({ ...g, connected: false, state: "Not connected", cls: "bg-muted text-muted-foreground" }));
      } else {
        toast({
          title: `Drive synced — ${res.data?.created ?? 0} new, ${res.data?.updated ?? 0} updated.`,
          description: res.data?.skipped > 0 ? `${res.data.skipped} folders/links skipped.` : undefined,
        });
      }
    } catch {
      toast({ title: "Drive sync failed. Try reconnecting." });
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
          description="Live external data wired into your planner: university calendars, course feeds and direct connections — an Ultimate feature that makes UNI·MATE talk to the rest of your campus life."
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
      desc: "Pin your Google account and pull upcoming events into the schedule — real OAuth through the google-calendar-sync edge function.",
      href: "/schedule",
      cta: "Open Schedule",
    },
    {
      key: "drive",
      icon: <FolderOpen className="w-5 h-5" />,
      name: "Google Drive",
      state: gdrive.state,
      stateCls: gdrive.cls,
      desc: "Import your own Drive files as study resources — deduplicated by file, refreshed on every sync through the google-drive edge function.",
      href: "/resources",
      cta: "Open Resources",
      onSync: gdrive.connected ? syncDrive : null,
      syncing: driving,
      syncLabel: driving ? "Syncing…" : "Sync files",
    },
    {
      key: "ics",
      icon: <Rss className="w-5 h-5" />,
      name: "Course calendar feeds",
      state: `${feedCount} subscribed`,
      stateCls: feedCount > 0 ? "bg-hud-emerald/10 text-hud-emerald" : "bg-muted text-muted-foreground",
      desc: "Subscribe to .ics feeds from your university portal — classes, labs and deadlines refresh automatically on load.",
      href: "/schedule",
      cta: feedCount > 0 ? "Manage feeds" : "Add a feed",
    },
    {
      key: "resources",
      icon: <FolderOpen className="w-5 h-5" />,
      name: "Course resources",
      state: "Active",
      stateCls: "bg-hud-emerald/10 text-hud-emerald",
      desc: "Attach syllabus URLs and external reading to any course and keep them one tap away.",
      href: "/resources",
      cta: "Open Resources",
    },
    {
      key: "mobile",
      icon: <Smartphone className="w-5 h-5" />,
      name: "UNI·MATE mobile",
      state: "Soon",
      stateCls: "bg-muted text-muted-foreground",
      desc: "Native apps that inherit your whole workspace — schedule, focus timer and flashcards on the go.",
      href: "",
      cta: "",
      soon: true,
    },
    {
      key: "lms",
      icon: <School className="w-5 h-5" />,
      name: "Learning-management import",
      state: "Soon",
      stateCls: "bg-muted text-muted-foreground",
      desc: "Pre-fill courses, assignments and exam dates from your university platform.",
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
          For local/demo workspaces connectors reflect their hosted behavior; signing in on the hosted project activates real cloud sync and live external data.
        </p>
      </Card>
    </>
  );
}