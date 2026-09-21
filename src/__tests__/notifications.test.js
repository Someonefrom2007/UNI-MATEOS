import { describe, it, expect } from "vitest";
import {
  buildNotifications,
  loadReadIds,
  saveReadIds,
  markRead,
  markAllRead,
  unreadCount,
} from "@/lib/notifications";

const day = (offset, base = "2026-09-16") => {
  const d = new Date(base + "T00:00:00");
  d.setDate(d.getDate() + offset);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${dd}`;
};

const NOW = new Date("2026-09-16T09:00:00");

const mkStore = () => {
  const map = {};
  return {
    getItem: (k) => (k in map ? map[k] : null),
    setItem: (k, v) => { map[k] = v; },
  };
};

describe("buildNotifications — exams (important)", () => {
  it("flags exams within 3 days with relative copy", () => {
    const exams = [
      { id: "e1", name: "Statistics", course_id: "c1", date: day(2), weight: 40, status: "upcoming" },
      { id: "e0", name: "Midterm", course_id: "c2", date: day(0), weight: 25, status: "upcoming" },
      { id: "efar", name: "Final", course_id: "c1", date: day(9), weight: 60, status: "upcoming" },
    ];
    const courses = [{ id: "c1", name: "Statistics" }, { id: "c2", name: "Design" }];
    const n = buildNotifications({ exams, courses, nowDate: NOW });
    const important = n.filter((x) => x.kind === "important");
    expect(important).toHaveLength(2);
    expect(important[0]).toMatchObject({ title: "Statistics in 2 days.", body: "Statistics · 40%", group: "academic" });
    expect(important[1]).toMatchObject({ title: "Midterm today.", date: day(0), to: "/exams/e0" });
  });

  it("skips completed, graded, and past exams", () => {
    const exams = [
      { id: "done", name: "Past", course_id: null, date: day(-1), status: "completed" },
      { id: "far", name: "Weeks away", course_id: null, date: day(4), status: "upcoming" },
    ];
    const n = buildNotifications({ exams, nowDate: NOW });
    expect(n.filter((x) => x.kind === "important")).toHaveLength(0);
  });
});

describe("buildNotifications — tasks (action)", () => {
  it("flags overdue, due-today, and due-tomorrow tasks only", () => {
    const tasks = [
      { id: "t-2", title: "Refactor", due_date: day(-2), status: "todo", course_id: null },
      { id: "t0", title: "Essay", due_date: day(0), status: "in_progress", course_id: null },
      { id: "t1", title: "Exercises", due_date: day(1), status: "todo", course_id: null },
      { id: "t4", title: "Project", due_date: day(4), status: "todo", course_id: null },
      { id: "tc", title: "Done thing", due_date: day(0), status: "completed", course_id: null },
    ];
    const n = buildNotifications({ tasks, nowDate: NOW });
    const acts = n.filter((x) => x.kind === "action" && x.id.startsWith("action:task"));
    expect(acts).toHaveLength(3);
    expect(acts.map((a) => a.title)).toEqual([
      "Exercises is due tomorrow.",
      "Essay is due today.",
      "Refactor is overdue.",
    ]);
  });

  it("does not surface very old overdue tasks", () => {
    const tasks = [{ id: "old", title: "Ancient", due_date: day(-60), status: "todo", course_id: null }];
    const n = buildNotifications({ tasks, nowDate: NOW });
    expect(n.filter((x) => x.id.startsWith("action:task"))).toHaveLength(0);
  });
});

describe("buildNotifications — free time before next class (action)", () => {
  it("recommends a study block when free time exists before today's class", () => {
    const events = [
      { id: "ev", title: "Statistics lecture", type: "class", date: day(0), start_time: "11:00", end_time: "12:30", room: "2.15" },
    ];
    const n = buildNotifications({ events, nowDate: NOW });
    const free = n.find((x) => x.id.startsWith("action:free"));
    expect(free).toBeTruthy();
    expect(free).toMatchObject({ title: "2 hours free before your next class.", body: "Statistics lecture · 11:00 · 2.15" });
  });

  it("stays silent when the next class is not today or too close", () => {
    const events = [
      { id: "ev", title: "Late class", type: "class", date: day(0), start_time: "09:05", end_time: "10:00" },
    ];
    const n = buildNotifications({ events, nowDate: NOW });
    expect(n.some((x) => x.id.startsWith("action:free"))).toBe(false);
  });
});

describe("buildNotifications — weekly focus achievement", () => {
  it("emits once when >= 2h of focus this week", () => {
    const focus = [
      { date: day(-1), duration: 75, completed: true },
      { date: day(-2), duration: 60, completed: true },
      { date: day(-20), duration: 999, completed: true },
    ];
    const n = buildNotifications({ focusSessions: focus, nowDate: NOW });
    const a = n.filter((x) => x.kind === "achievement");
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ title: "2 hours focused this week.", group: "milestone", to: "/focus" });
  });

  it("omits the achievement with too little focus", () => {
    const n = buildNotifications({ focusSessions: [{ date: day(-1), duration: 30 }], nowDate: NOW });
    expect(n.filter((x) => x.kind === "achievement")).toHaveLength(0);
  });
});

describe("buildNotifications — community replies", () => {
  it("counts replies to my posts within 7 days", () => {
    const replies = [
      { post_id: "p1", created_at: "2026-09-15T18:00:00Z", content: "try z" },
      { post_id: "p1", created_at: "2026-09-16T08:00:00Z", content: "also works" },
    ];
    const n = buildNotifications({ communityReplies: replies, nowDate: NOW });
    const c = n.filter((x) => x.kind === "community");
    expect(c).toHaveLength(1);
    expect(c[0]).toMatchObject({ title: "2 answers to your post.", group: "community", to: "/community" });
  });

  it("ignores replies older than 7 days", () => {
    const replies = [{ post_id: "p1", created_at: "2026-09-01T18:00:00Z" }];
    const n = buildNotifications({ communityReplies: replies, nowDate: NOW });
    expect(n.filter((x) => x.kind === "community")).toHaveLength(0);
  });
});

describe("read-state store (per device)", () => {
  it("round-trips ids and stays id-unique", () => {
    const store = mkStore();
    saveReadIds(["a", "b", "a"], store);
    expect(loadReadIds(store)).toEqual(["a", "b"]);
  });

  it("markRead appends and returns the new set", () => {
    const store = mkStore();
    markRead("x", store);
    markRead("y", store);
    markRead("x", store);
    expect(loadReadIds(store)).toEqual(["x", "y"]);
  });

  it("markAllRead stores every notification id", () => {
    const store = mkStore();
    const notifs = buildNotifications({
      exams: [{ id: "e1", course_id: null, date: day(1), status: "upcoming" }],
      nowDate: NOW,
    });
    markAllRead(notifs, store);
    expect(loadReadIds(store)).toContain("important:exam:e1");
    expect(unreadCount(notifs, loadReadIds(store))).toBe(0);
  });

  it("unreadCount only counts ids absent from the read set", () => {
    const notifs = buildNotifications({
      exams: [{ id: "e1", course_id: null, date: day(1), status: "upcoming" }],
      tasks: [{ id: "t1", title: "Task", due_date: day(0), status: "todo", course_id: null }],
      nowDate: NOW,
    });
    expect(unreadCount(notifs, ["important:exam:e1"])).toBe(notifs.length - 1);
  });

  it("tolerates corrupt storage", () => {
    const store = mkStore();
    store.setItem("unimate:notif:read", "{not json");
    expect(loadReadIds(store)).toEqual([]);
  });
});

describe("buildNotifications — ordering & shaping", () => {
  it("sorts newest first", () => {
    const n = buildNotifications({
      exams: [
        { id: "later", course_id: null, date: day(3), status: "upcoming" },
        { id: "soon", course_id: null, date: day(1), status: "upcoming" },
      ],
      nowDate: NOW,
    });
    expect(n.map((x) => x.date)).toEqual([day(3), day(1)]);
  });

  it("emits nothing from an empty store", () => {
    expect(buildNotifications({ nowDate: NOW })).toEqual([]);
  });
});