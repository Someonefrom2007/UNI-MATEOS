// Derived notifications for the center. Strictly derived from real rows — a
// notification is only emitted when its trigger exists in the user's actual
// data (exams, tasks, schedule events, focus sessions, community replies). No
// item is ever fabricated, and read-state is strictly per-device: the local
// workspace and per-device localStorage are the read surface, never rows.

import { getAppRepo } from "@/lib/repo/select";
import { getTable } from "@/lib/tables";
import { buildNotifications, loadReadIds, saveReadIds, markRead, markAllRead, unreadCount } from "@/lib/notifications";

/**
 * One shared notifications + read-state bundle. Call ONCE in the app shell and
 * share the returned values between the bells (desktop/mobile) and the panel —
 * useUserData fans out its own fetches per instance, so multiple hook calls
 * would duplicate load work; community replies are the one engine input the
 * entity loader does not expose, so they are fetched here on mount.
 */
export const useNotifications = () => {
  const { data } = useUserData();
  const [replies, setReplies] = useState([]);
  const [readIds, setReadIds] = useState(() => loadReadIds());

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
    return buildNotifications({
      exams: data.Exam || [],
      tasks: data.Task || [],
      events: data.ScheduleEvent || [],
      courses: data.Course || [],
      focusSessions: data.FocusSession || [],
      communityReplies: replies,
    });
  }, [data, replies]);

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
