/// <reference types="vite/client" />

// Central data hook — loads all UNI·MATE tables once and keeps them in sync.
// The exported API surface is unchanged:
//   data.<EntityKey>  -> array of rows (snake_case columns)
//   refresh           -> reload everything
//   mutate(entity, op, ...args) with op in create | update | delete
//
// Adapter is chosen by environment: with Supabase env vars present rows come
// from the hosted backend with realtime (today's behavior); without them the
// local repo serves everything (see src/lib/repo). Call sites never branch.
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { getTable } from "@/lib/tables";
import { isLocalWorkspace, getAppRepo } from "@/lib/repo/select";

const FETCH_ENTITIES = [
  "Course", "ScheduleEvent", "Task", "Exam", "Grade", "Note", "Resource", "Topic",
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

const LOCAL = isLocalWorkspace();
// Single shared repository — the app data layer in both modes (see select.js).
const repo = getAppRepo();

// Repository wrapper preserving the tuned semantics of the historical hosted
// path: a failing entity reads as null so load() can retry it individually.
const listOrNull = async (r, table) => {
  try {
    return await r.list(table);
  } catch {
    return null;
  }
};

export const useUserData = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAll = async () => {
    const results = {};
    await Promise.all(
      FETCH_ENTITIES.map(async (key) => {
        results[key] = await listOrNull(repo, getTable(key));
      })
    );
    return results;
  };

  const fetchOne = async (key) => listOrNull(repo, getTable(key));

  const load = useCallback(async (attempt = 0) => {
    setLoading(true);
    try {
      const results = await fetchAll();
      let failed = FETCH_ENTITIES.filter((k) => results[k] === null);
      if (failed.length && attempt < 2) {
        await new Promise((r) => setTimeout(r, 600));
        for (const key of failed) {
          results[key] = await fetchOne(key);
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

  // Realtime is a hosted-backend feature: local mode owns its storage and has
  // nothing to subscribe to, so the channel is only built when using Supabase.
  // IMPORTANT: Supabase's channel API requires every .on('postgres_changes', ...)
  // handler to be attached BEFORE .subscribe() — handlers registered after
  // subscribe are ignored (some SDK builds even throw). All listeners are
  // chained first on the freshly-created channel, then .subscribe() is called
  // once as the terminal step.
  const hasData = data !== null;

  useEffect(() => {
    if (!hasData || LOCAL) return;
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
      if (op === "create") result = await repo.create(table, toSnakeCase(payload || {}));
      else if (op === "update") result = await repo.update(table, id, toSnakeCase(payload || {}));
      else if (op === "delete") result = await repo.delete(table, id);
      else throw new Error(`Unknown op: ${op}`);
    } catch (e) {
      await load();
      throw e;
    }
    await load();
    return result;
  }, [load]);

  return { data, loading, error, refresh, mutate };
};