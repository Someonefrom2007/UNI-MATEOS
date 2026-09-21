import { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import PlanLocked from "@/components/PlanLocked";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { usePlan } from "@/lib/usePlan";
import { isLocalWorkspace } from "@/lib/repo/select";
import { loadFeeds } from "@/lib/feedsStore";
import { Link } from "react-router-dom";
import { CalendarDays, Rss, FolderOpen, Smartphone, School, ArrowRight } from "lucide-react";

const LOCAL = isLocalWorkspace();

export default function Integrations() {
  const { t } = useI18n();
  const { can } = usePlan();
  const [feedCount, setFeedCount] = useState(0);

  useEffect(() => {
    setFeedCount(loadFeeds().length);
  }, []);

  if (!can("university_integrations")) {
    return (
      <>
        <PageHeader title={t("title.integrations")} subtitle={t("title.integrations.subtitle")} />
        <PlanLocked
          feature="university_integrations"
          description="Live external data wired into your planner: university calendars, course feeds and direct connections — an Ultra feature that makes UNI·MATE talk to the rest of your campus life."
        />
      </>
    );
  }

  const connectors = [
    {
      key: "calendar",
      icon: <CalendarDays className="w-5 h-5" />,
      name: "Google Calendar",
      state: LOCAL ? "Cloud sync on hosted accounts" : "Two-way sync active",
      stateCls: LOCAL ? "bg-muted text-muted-foreground" : "bg-hud-emerald/10 text-hud-emerald",
      desc: "Push and pull schedule events through the google-calendar-sync edge function. Configure the connection inside Schedule.",
      href: "/schedule",
      cta: "Open Schedule",
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
                  <div className="mt-3">
                    <Button size="sm" variant="outline" asChild>
                      <Link to={c.href}>{c.cta}<ArrowRight className="w-3.5 h-3.5 ml-1.5" /></Link>
                    </Button>
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