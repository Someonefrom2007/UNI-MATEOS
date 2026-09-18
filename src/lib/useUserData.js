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
import { TABLE, getTable } from "@/lib/tables";
import { createLocalRepo } from "@/lib/repo/localRepo";
import { isLocalWorkspace } from "@/lib/repo/select";

const FETCH_ENTITIES = [
  "Course", "ScheduleEvent", "Task", "Exam", "Grade", "Note", "Resource",
  "FocusSession", "Goal", "Habit", "HabitLog", "Project", "Attendance", "StickyNote",
];

const REALTIME_TABLES = ["tasks", "courses", "focus_sessions", "exams", "habit_logs", "sticky_notes"];

// Writes that don't go through `mutate` (the quick-add sheet talks to the repo
// directly) still have to refresh every mounted hook. One broadcast event keeps
// pages from showing a stale list right after the user added something.
export const DATA_CHANGED_EVENT = "unimate:data-changed";

export const notifyDataChanged = () => {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(DATA_CHANGED_EVENT));
};

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
const repo = LOCAL ? createLocalRepo() : null;

export const useUserData = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAll = async () => {
    const results = {};
    if (repo) {
      FETCH_ENTITIES.forEach((key) => {
        results[key] = repo.list(getTable(key));
      });
      return results;
    }
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

  const fetchOne = async (key) => {
    if (repo) return repo.list(getTable(key));
    try {
      const { data: rows, error: err } = await supabase.from(getTable(key)).select("*");
      return err ? null : rows || [];
    } catch {
      return null;
    }
  };

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

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onChange = () => load();
    window.addEventListener(DATA_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(DATA_CHANGED_EVENT, onChange);
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
    if (!hasData || repo) return;
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

  // Run several writes as one unit and reload once. Used by flows that touch
  // many rows at once (deleting a course and everything scoped to it); doing
  // that through `mutate` in a loop would reload every table per row.
  const mutateBatch = useCallback(async (ops = []) => {
    const results = [];
    for (const op of ops) {
      const { entity, op: kind, id, payload } = op || {};
      const table = getTable(entity);
      if (!table) throw new Error(`Unknown entity: ${entity}`);
      if (repo) {
        if (kind === "create") results.push(repo.create(table, toSnakeCase(payload || {})));
        else if (kind === "update") results.push(repo.update(table, id, toSnakeCase(payload || {})));
        else if (kind === "delete") results.push(repo.delete(table, id));
        else throw new Error(`Unknown op: ${kind}`);
      } else if (kind === "create") {
        const { data: rows, error } = await supabase.from(table).insert(toSnakeCase(payload || {})).select();
        if (error) throw error;
        results.push(rows?.[0] ?? null);
      } else if (kind === "update") {
        const { data: rows, error } = await supabase.from(table).update(toSnakeCase(payload || {})).eq("id", id).select();
        if (error) throw error;
        results.push(rows?.[0] ?? null);
      } else if (kind === "delete") {
        const { error } = await supabase.from(table).delete().eq("id", id);
        if (error) throw error;
        results.push(null);
      } else {
        throw new Error(`Unknown op: ${kind}`);
      }
    }
    await load();
    return results;
  }, [load]);

  const mutate = useCallback(async (entityName, op, ...args) => {
    const table = getTable(entityName);
    if (!table) throw new Error(`Unknown entity: ${entityName}`);
    const [id, payload] = args;
    let result = null;
    try {
      if (repo) {
        if (op === "create") result = repo.create(table, toSnakeCase(payload || {}));
        else if (op === "update") result = repo.update(table, id, toSnakeCase(payload || {}));
        else if (op === "delete") result = repo.delete(table, id);
        else throw new Error(`Unknown op: ${op}`);
      } else if (op === "create") {
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

  return { data, loading, error, refresh, mutate, mutateBatch };
};