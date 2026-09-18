import { useMemo, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useUserData } from "@/lib/useUserData";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import ErrorState from "@/components/ErrorState";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Bell, X, RotateCcw, AlertTriangle, AlertCircle, Info } from "lucide-react";
import { courseColor } from "@/lib/format";
import { detectConflicts } from "@/lib/scheduleEngine";
import {
  deriveNotifications, applyDismissed, pruneDismissed, groupNotifications, countBySeverity, CATEGORY_META,
} from "@/lib/notifications";
import {
  loadDismissed, dismissItem, clearDismissed, saveDismissed, loadPrefs, savePrefs, applyPrefs, DEFAULT_PREFS,
  NOTIF_CHANGED_EVENT,
} from "@/lib/notificationStore";
import { useI18n } from "@/lib/i18n";

const SEVERITY_ICON = { critical: AlertTriangle, warning: AlertCircle, info: Info };
const SEVERITY_CLS = {
  critical: "text-hud-rose bg-hud-rose/10 border-hud-rose/30",
  warning: "text-hud-amber bg-hud-amber/10 border-hud-amber/30",
  info: "text-hud-cyan bg-hud-cyan/10 border-hud-cyan/30",
};

// Conflicts only matter on days the student is about to live through, so the
// scan window looks forward rather than across the whole semester.

export default function Notifications() {
  const { data, loading, error, refresh } = useUserData();
  const { toast } = useToast();
  const { t } = useI18n();
  const [dismissed, setDismissed] = useState(() => loadDismissed());
  const [prefs, setPrefs] = useState(() => loadPrefs());

  useEffect(() => {
    const sync = () => setDismissed(loadDismissed());
    window.addEventListener(NOTIF_CHANGED_EVENT, sync);
    return () => window.removeEventListener(NOTIF_CHANGED_EVENT, sync);
  }, []);

  const derived = useMemo(() => {
    if (!data) return null;
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    // One shared derivation so the bell badge and this page can never disagree.
    const { all, courses } = deriveNotifications(data, { todayStr, detectConflicts });
    return { all, todayStr, courses };
  }, [data]);

  // Keys for resolved conditions are dropped so the stored list can't grow
  // without bound across a semester.
  useEffect(() => {
    if (!derived) return;
    const pruned = pruneDismissed(dismissed, derived.all);
    if (pruned.length !== dismissed.length) setDismissed(saveDismissed(pruned));
  }, [derived, dismissed]);

  const visible = useMemo(() => {
    if (!derived) return [];
    return applyPrefs(applyDismissed(derived.all, dismissed), prefs);
  }, [derived, dismissed, prefs]);

  const counts = useMemo(() => countBySeverity(visible), [visible]);
  const groups = useMemo(() => groupNotifications(visible), [visible]);
  const courseById = (id) => (derived?.courses || []).find((c) => c.id === id);

  const dismiss = (item) => {
    setDismissed(dismissItem(item.key));
    toast({ title: "Dismissed", description: "The item returns automatically if it still applies next time you open this page." });
  };

  const restore = () => {
    clearDismissed();
    setDismissed([]);
    toast({ title: "Dismissed items restored" });
  };

  const togglePref = (category) => {
    const next = savePrefs({ ...prefs, [category]: !prefs[category] });
    setPrefs(next);
  };

  if (error) return <ErrorState onRetry={refresh} />;
  if (loading && !data) return <div className="h-64 rounded-xl bg-muted animate-pulse" />;

  return (
    <>
      <PageHeader title={t("title.notifications")} subtitle={t("title.notifications.subtitle")}>
        {dismissed.length > 0 && (
          <Button variant="ghost" size="sm" onClick={restore} className="gap-1.5">
            <RotateCcw className="w-4 h-4" /> Restore
          </Button>
        )}
      </PageHeader>

      {counts.total > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-5">
          {counts.critical > 0 && (
            <span className={`text-xs px-2.5 py-1 rounded-full border ${SEVERITY_CLS.critical}`}>
              {counts.critical} needs attention
            </span>
          )}
          {counts.warning > 0 && (
            <span className={`text-xs px-2.5 py-1 rounded-full border ${SEVERITY_CLS.warning}`}>
              {counts.warning} to watch
            </span>
          )}
          {counts.info > 0 && (
            <span className={`text-xs px-2.5 py-1 rounded-full border ${SEVERITY_CLS.info}`}>
              {counts.info} for info
            </span>
          )}
        </div>
      )}

      <Card className="p-4 mb-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="text-sm font-medium">Categories</div>
            <div className="text-xs text-muted-foreground">Turn off a group if it is not useful to you.</div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {Object.keys(DEFAULT_PREFS).map((cat) => {
              const on = prefs[cat] !== false;
              return (
                <button
                  key={cat}
                  onClick={() => togglePref(cat)}
                  aria-pressed={on}
                  className={`text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${
                    on ? "border-primary/40 bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {CATEGORY_META[cat]?.label || cat}
                </button>
              );
            })}
          </div>
        </div>
      </Card>

      {groups.length === 0 ? (
        <EmptyState
          icon={Bell}
          title={derived?.all.length ? "Nothing needs you right now" : t("empty.notifications.title")}
          description={
            derived?.all.length
              ? "You have dismissed everything currently showing. Items come back on their own while the underlying deadline, exam or conflict still applies."
              : t("empty.notifications.description")
          }
        />
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <section key={group.category}>
              <h2 className="um-label mb-2">{group.label}</h2>
              <div className="space-y-2">
                {group.items.map((item) => {
                  const Icon = SEVERITY_ICON[item.severity] || Info;
                  const course = item.courseId ? courseById(item.courseId) : null;
                  return (
                    <Card key={item.key} className="p-3.5 flex items-start gap-3 hover:border-primary/30 transition-colors">
                      <span className={`mt-0.5 w-7 h-7 shrink-0 rounded-lg border flex items-center justify-center ${SEVERITY_CLS[item.severity]}`}>
                        <Icon className="w-3.5 h-3.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <Link to={item.to} className="font-medium text-sm hover:text-primary transition-colors block truncate">
                          {item.title}
                        </Link>
                        <div className="text-xs text-muted-foreground mt-0.5">{item.detail}</div>
                        {course && (
                          <span className="inline-flex items-center gap-1.5 mt-1.5 text-[11px] text-muted-foreground">
                            <span className={`w-1.5 h-1.5 rounded-full ${courseColor(course.color).dot}`} />
                            {course.code || course.name}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => dismiss(item)}
                        aria-label={`Dismiss ${item.title}`}
                        className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted shrink-0"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </Card>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
