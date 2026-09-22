// Notifications Center — a bell with an unread badge plus a right-side panel
// (a shadcn Sheet) showing the derived notification set, grouped and labeled
// from real user data. Nothing is fabricated; read-state is per-device
// (localStorage) and separately keyed from any shared rows.
import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  BellOff,
  AlarmClock,
  CalendarClock,
  Trophy,
  MessagesSquare,
  CheckCheck,

} from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useUserData } from "@/lib/useUserData";
import { useI18n } from "@/lib/i18n";
import { getAppRepo } from "@/lib/repo/select";
import { getTable } from "@/lib/tables";
import {
  buildNotifications,
  loadReadIds,

  markRead,
  markAllRead,
  unreadCount,
} from "@/lib/notifications";
import { loadPrefs, filterNotifs } from "@/lib/notifyPrefs";
import { relLabel, groupByGroup } from "@/lib/notificationsUi";

const KIND_META = {
  important: { icon: AlarmClock, cls: "text-hud-rose" },
  action: { icon: CalendarClock, cls: "text-hud-amber" },
  achievement: { icon: Trophy, cls: "text-hud-emerald" },
  community: { icon: MessagesSquare, cls: "text-hud-violet" },
};

const GROUP_LABEL_KEY = {
  academic: "notify.group.academic",
  milestone: "notify.group.milestone",
  community: "notify.group.community",
};

/** Compose the engine + read state. Call ONCE in the shell and share the
 *  returned bundle with both bells and the panel — useUserData fans out its
 *  own fetches per instance, so multiple calls would duplicate load work. */
export const useNotifications = () => {
  const { data } = useUserData();
  const [replies, setReplies] = useState([]);
  const [readIds, setReadIds] = useState(() => loadReadIds());
  const [prefsVersion, setPrefsVersion] = useState(0);

  useEffect(() => {
    const onPrefs = () => setPrefsVersion((v) => v + 1);
    window.addEventListener("unimate:notif-prefs", onPrefs);
    return () => window.removeEventListener("unimate:notif-prefs", onPrefs);
  }, []);

  useEffect(() => {
    let cancelled = false;
    getAppRepo()
      .list(getTable("CommunityReply"))
      .then((rows) => {
        if (!cancelled) setReplies(rows || []);
      })
      .catch(() => {
        if (!cancelled) setReplies([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const notifs = useMemo(() => {
    if (!data) return [];
    return filterNotifs(
      buildNotifications({
        exams: data.Exam || [],
        tasks: data.Task || [],
        events: data.ScheduleEvent || [],
        courses: data.Course || [],
        focusSessions: data.FocusSession || [],
        communityReplies: replies,
      }),
      loadPrefs()
    );
  }, [data, replies, prefsVersion]);

  const unread = unreadCount(notifs, readIds);

  const markOne = useCallback((id) => {
    markRead(id);
    setReadIds(loadReadIds());
  }, []);

  const markAll = useCallback(() => {
    markAllRead(notifs);
    setReadIds(loadReadIds());
  }, [notifs]);

  return { notifs, readIds, unread, markOne, markAll };
};

/** Bell with unread badge. Pure presentational; onClick opens the panel. */
export function NotificationBell({ unread, onClick }) {
  return (
    <button
      onClick={onClick}
      aria-label="Notifications"
      title="Notifications"
      className="relative p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
    >
      <Bell className="w-5 h-5" />
      {unread > 0 && (
        <span className="absolute top-1 right-1 min-w-[15px] h-4 px-1 rounded-full bg-hud-rose text-[9px] font-bold text-white flex items-center justify-center shadow-[0_0_8px_rgba(244,63,94,0.6)]">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </button>
  );
}

export default function NotificationCenter({ open, onOpenChange, notifs, readIds, onMarkOne, onMarkAll }) {
  const navigate = useNavigate();
  const { t } = useI18n();
  const grouped = useMemo(() => groupByGroup(notifs), [notifs]);

  const openItem = (n) => {
    onMarkOne(n.id);
    onOpenChange(false);
    navigate(n.to);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md w-full p-0">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border pr-12">
          <div className="flex items-center gap-2">
            <span className="font-display font-semibold">{t("notify.title")}</span>
            {notifs.length > 0 && (
              <button
                onClick={onMarkAll}
                className="flex items-center gap-1 text-xs text-hud-cyan hover:text-hud-cyan/80 transition-colors"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                {t("notify.markAll")}
              </button>
            )}
          </div>
        </div>

        <div className="overflow-y-auto px-4 py-3">
          {notifs.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 px-6 text-center">
              <BellOff className="w-8 h-8 text-muted-foreground/60" />
              <p className="text-sm font-medium">{t("notify.empty")}</p>
              <p className="text-xs text-muted-foreground">{t("notify.emptySub")}</p>
            </div>
          ) : (
            Object.entries(grouped).map(([group, items]) => (
              <div key={group} className="mb-4 last:mb-0">
                <div className="um-label px-2 mb-1.5">{t(GROUP_LABEL_KEY[group] || "notify.group.academic")}</div>
                <div className="space-y-0.5">
                  {items.map((n) => {
                    const meta = KIND_META[n.kind] || KIND_META.action;
                    const Icon = meta.icon;
                    const isRead = readIds.includes(n.id);
                    return (
                      <button
                        key={n.id}
                        onClick={() => openItem(n)}
                        className={`text-left w-full flex gap-3 p-3 rounded-lg transition-colors ${
                          isRead ? "hover:bg-muted/40" : "bg-muted/40 hover:bg-muted/70"
                        }`}
                      >
                        <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${meta.cls}`} />
                        <span className="min-w-0 flex-1">
                          <span
                            className={`block text-sm leading-snug ${
                              isRead ? "text-foreground/70" : "text-foreground font-medium"
                            }`}
                          >
                            {n.title}
                          </span>
                          {n.body && (
                            <span className="block text-xs text-muted-foreground truncate mt-0.5">{n.body}</span>
                          )}
                        </span>
                        <span className="hud-mono text-[10px] text-muted-foreground/70 shrink-0 pt-0.5">
                          {relLabel(n.date)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
