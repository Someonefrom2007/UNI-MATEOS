/// <reference types="vite/client" />

// Central data hook — loads all UNI·MATE tables once and keeps them in sync
// via Supabase postgres_changes. The exported API surface is unchanged:
//   data.<EntityKey>  -> array of rows (snake_case columns)
//   refresh           -> reload everything
//   mutate(entity, op, ...args) with op in create | update | delete
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { TABLE, getTable } from "@/lib/tables";

const FETCH_ENTITIES = [
  "Course", "ScheduleEvent", "Task", "Exam", "Grade", "Note", "Resource",
  "FocusSession", "Goal", "Habit", "HabitLog", "Project", "Attendance", "StickyNote",
];

const REALTIME_TABLES = ["tasks", "courses", "focus_sessions", "exams", "habit_logs", "sticky_notes"];

// Each hook lifecycle gets its own channel instance: React StrictMode and
// hot-reload re-run effects, and reusing a fixed channel name can collide with
// a previous instance that is still in the SUBSCRIBED state.
let realtimeChannelSeq = 0;
const realtimeChannelName = () => `unimate-user-data-${Date.now()}-${realtimeChannelSeq++}`;

const snakeCase = (key) => key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

const toSnakeCase = (obj) => {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return obj;
  const out = {};
  Object.keys(obj).forEach((k) => {
    out[snakeCase(k)] = obj[k];
  });
  return out;
};

export const useUserData = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAll = async () => {
    const results = {};
    await Promise.all(
      FETCH_ENTITIES.map(async (key) => {
        try {
          const { data: rows, error: err } = await supabase.from(getTable(key)).select("*");
          results[key] = err ? null : rows || [];
        } catch {
          results[key] = null;
        }
      })
    );
    return results;
  };

  const load = useCallback(async (attempt = 0) => {
    setLoading(true);
    try {
      const results = await fetchAll();
      let failed = FETCH_ENTITIES.filter((k) => results[k] === null);
      if (failed.length && attempt < 2) {
        await new Promise((r) => setTimeout(r, 600));
        for (const key of failed) {
          try {
            const { data: rows, error: err } = await supabase.from(getTable(key)).select("*");
            results[key] = err ? null : rows || [];
          } catch {
            results[key] = null;
          }
        }
        failed = FETCH_ENTITIES.filter((k) => results[k] === null);
        if (failed.length) return load(attempt + 1);
      }
      const obj = {};
      FETCH_ENTITIES.forEach((key) => {
        obj[key] = results[key] || [];
      });
      setData(obj);
      setError(null);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Realtime: subscribe to the live tables and refresh on any change.
  // IMPORTANT: Supabase's channel API requires every .on('postgres_changes', ...)
  // handler to be attached BEFORE .subscribe() — handlers registered after
  // subscribe are ignored (some SDK builds even throw). All listeners are
  // chained first on the freshly-created channel, then .subscribe() is called
  // once as the terminal step.
  const hasData = data !== null;

  useEffect(() => {
    if (!hasData) return;
    // Unique name per lifecycle: StrictMode/HMR double-invoke must never reuse
    // a channel that is still subscribed.
    const channel = supabase.channel(realtimeChannelName());
    REALTIME_TABLES.forEach((table) => {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, () => load());
    });
    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // Subscribe once the first load completes; keep the same channel across
    // subsequent refreshes instead of tearing it down on every data change.
  }, [hasData, load]);

  const refresh = load;

  const mutate = useCallback(async (entityName, op, ...args) => {
    const table = getTable(entityName);
    if (!table) throw new Error(`Unknown entity: ${entityName}`);
    const [id, payload] = args;
    let result = null;
    try {
      if (op === "create") {
        const { data: rows, error } = await supabase.from(table).insert(toSnakeCase(payload || {})).select();
        if (error) throw error;
        result = rows?.[0] ?? null;
      } else if (op === "update") {
        const { data: rows, error } = await supabase.from(table).update(toSnakeCase(payload || {})).eq("id", id).select();
        if (error) throw error;
        result = rows?.[0] ?? null;
      } else if (op === "delete") {
        const { error } = await supabase.from(table).delete().eq("id", id);
        if (error) throw error;
      } else {
        throw new Error(`Unknown op: ${op}`);
      }
    } catch (e) {
      await load();
      throw e;
    }
    await load();
    return result;
  }, [load]);

  return { data, loading, error, refresh, mutate };
};