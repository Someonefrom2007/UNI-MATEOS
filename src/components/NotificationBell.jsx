import { useMemo, useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useUserData } from "@/lib/useUserData";
import { Bell, AlertTriangle, AlertCircle, Info, Check } from "lucide-react";
import { detectConflicts } from "@/lib/scheduleEngine";
import { deriveNotifications, applyDismissed, countBySeverity } from "@/lib/notifications";
import {
  loadDismissed, dismissItem, loadPrefs, applyPrefs, markSeen, unseenCount, NOTIF_CHANGED_EVENT,
} from "@/lib/notificationStore";

const SEVERITY_ICON = { critical: AlertTriangle, warning: AlertCircle, info: Info };
const SEVERITY_CLS = {
  critical: "text-hud-rose bg-hud-rose/10 border-hud-rose/30",
  warning: "text-hud-amber bg-hud-amber/10 border-hud-amber/30",
  info: "text-hud-cyan bg-hud-cyan/10 border-hud-cyan/30",
};

const PREVIEW_LIMIT = 6;

const isoLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// Header bell. Shares the attention engine with the notifications page, so the
// badge and the page can never disagree about what is outstanding.
export default function NotificationBell() {
  const { data } = useUserData();
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(() => loadDismissed());
  // Bumped when the seen set changes elsewhere so the badge recomputes.
  const [seenRev, setSeenRev] = useState(0);
  const [prefs] = useState(() => loadPrefs());
  const wrapRef = useRef(null);

  const items = useMemo(() => {
    if (!data) return [];
    const all = deriveNotifications(data, { todayStr: isoLocal(new Date()), detectConflicts }).all;
    return applyPrefs(applyDismissed(all, dismissed), prefs);
  }, [data, dismissed, prefs]);

  const counts = useMemo(() => countBySeverity(items), [items]);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- seenRev is the recompute trigger for the persisted seen set
  const badge = useMemo(() => unseenCount(items), [items, seenRev]);

  // Dismissals and mark-seen made elsewhere (the attention page) must be
  // reflected here, otherwise the badge reappears on the next open.
  useEffect(() => {
    const sync = () => {
      setDismissed(loadDismissed());
      setSeenRev((n) => n + 1);
    };
    window.addEventListener(NOTIF_CHANGED_EVENT, sync);
    return () => window.removeEventListener(NOTIF_CHANGED_EVENT, sync);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const openPanel = () => {
    const next = !open;
    setOpen(next);
    if (next) {
      // Opening the panel is the acknowledgement: the badge clears, the items
      // stay until they are resolved or dismissed.
      markSeen(items);
      setSeenRev((n) => n + 1);
    }
  };

  const dismiss = (item) => {
    setDismissed(dismissItem(item.key));
  };

  return (
    <div className="relative" ref={wrapRef}>
      <button
        onClick={openPanel}
        aria-label={badge > 0 ? `Notifications, ${badge} need attention` : "Notifications"}
        aria-expanded={open}
        className="relative p-2 rounded-lg hover:bg-muted"
      >
        <Bell className="w-5 h-5" />
        {badge > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-hud-rose text-white text-[10px] font-semibold flex items-center justify-center">
            {badge > 9 ? "9+" : badge}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-card shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-border">
            <span className="text-sm font-medium">Attention</span>
            {counts.total > 0 && (
              <span className="text-[11px] text-muted-foreground">
                {counts.critical > 0 ? `${counts.critical} urgent` : `${counts.total} open`}
              </span>
            )}
          </div>

          <div className="max-h-[22rem] overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-3.5 py-8 text-center">
                <Check className="w-5 h-5 mx-auto text-hud-emerald mb-2" />
                <p className="text-sm text-muted-foreground">Nothing needs you right now.</p>
              </div>
            ) : (
              items.slice(0, PREVIEW_LIMIT).map((item) => {
                const Icon = SEVERITY_ICON[item.severity] || Info;
                return (
                  <div key={item.key} className="flex items-start gap-2.5 px-3.5 py-2.5 border-b border-border/60 last:border-0 hover:bg-muted/40">
                    <span className={`mt-0.5 w-6 h-6 shrink-0 rounded-md border flex items-center justify-center ${SEVERITY_CLS[item.severity]}`}>
                      <Icon className="w-3 h-3" />
                    </span>
                    <Link to={item.to} onClick={() => setOpen(false)} className="min-w-0 flex-1">
                      <div className="text-[13px] font-medium truncate">{item.title}</div>
                      <div className="text-[11px] text-muted-foreground truncate">{item.detail}</div>
                    </Link>
                    <button
                      onClick={() => dismiss(item)}
                      aria-label={`Dismiss ${item.title}`}
                      className="text-[11px] text-muted-foreground hover:text-foreground shrink-0 px-1"
                    >
                      Dismiss
                    </button>
                  </div>
                );
              })
            )}
          </div>

          <Link
            to="/notifications"
            onClick={() => setOpen(false)}
            className="block px-3.5 py-2.5 text-center text-xs font-medium border-t border-border hover:bg-muted"
          >
            Open attention centre
          </Link>
        </div>
      )}
    </div>
  );
}
