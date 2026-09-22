// UNI·MATE Google Calendar connector — real OAuth2, env-gated.
//
// A deployed, env-configured function does full OAuth and pulls the user's
// primary calendar into `schedule_events` (idempotent, keyed by
// google_event_id). Without Google credentials the function stays honest: every
// action returns { configured: false } so the UI never pretends to be connected.
//
// Required env (see .env.example / deploy docs):
//   GOOGLE_CALENDAR_CLIENT_ID
//   GOOGLE_CALENDAR_CLIENT_SECRET
//   GOOGLE_CALENDAR_REDIRECT_URI      (this function's callback URL, e.g.
//      https://<project>.supabase.co/functions/v1/google-calendar-sync)
//   GOOGLE_CALENDAR_REDIRECT_URL      (optional landing page after connect,
//      e.g. https://<project>.supabase.co/schedule; falls back to SUPABASE_URL)
//
// Routes:
//   POST (auth'd)  { action: "check" | "connect" | "sync" | "disconnect" }
//   GET  (public)  ?code=...&state=...   -> OAuth callback, 302 back to the app
//
// Flow: connect -> consent URL -> user approves -> Google redirects to this
// function -> we exchange the code, store tokens in google_calendar_connections
// and bounce the browser to the app. sync() refreshes the token if needed and
// upserts events between the last sync and 30 days ahead.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (payload, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const CALENDAR_API = "https://www.googleapis.com/calendar/v3/calendars";

const SCOPES = "https://www.googleapis.com/auth/calendar.readonly";

const isConfigured = () =>
  Boolean(
    Deno.env.get("GOOGLE_CALENDAR_CLIENT_ID") &&
      Deno.env.get("GOOGLE_CALENDAR_CLIENT_SECRET") &&
      Deno.env.get("GOOGLE_CALENDAR_REDIRECT_URI")
  );

const landingUrl = () =>
  Deno.env.get("GOOGLE_CALENDAR_REDIRECT_URL") || String(Deno.env.get("SUPABASE_URL") || "/");

const randomHex = (bytes = 24) => {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return [...arr].map((b) => b.toString(16).padStart(2, "0")).join("");
};

const nowIso = () => new Date().toISOString();

// Refresh the stored access token when it is missing or about to expire.
// Returns { token, error } — token is the valid access token, or null when the
// grant is gone and the user must reconnect.
const freshToken = async (conn) => {
  if (conn.access_token && conn.expires_at) {
    const expires = new Date(conn.expires_at).getTime();
    if (expires - Date.now() > 60_000) return { token: conn.access_token };
  }
  if (!conn.refresh_token) return { token: null, error: "reconnect" };
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: conn.refresh_token,
      client_id: Deno.env.get("GOOGLE_CALENDAR_CLIENT_ID") || "",
      client_secret: Deno.env.get("GOOGLE_CALENDAR_CLIENT_SECRET") || "",
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    console.error("[gcal] refresh failed:", res.status, data.error_description || data.error);
    return { token: null, error: "refresh-failed" };
  }
  return { token: data.access_token, refreshed: data };
};

const updateTokens = async (supabase, userId, tokenData) => {
  const expiresIn = Number(tokenData.expires_in) || 3600;
  const { error } = await supabase
    .from("google_calendar_connections")
    .update({ access_token: tokenData.access_token, expires_at: new Date(Date.now() + expiresIn * 1000).toISOString() })
    .eq("user_id", userId);
  if (error) console.error("[gcal] token refresh persist failed:", error.message);
};

// Convert a Google event item into a schedule_events row. All-day events are
// skipped (the rest of the app treats the timetable as time-based) and reported
// separately so the summary stays honest.
const toScheduleRow = (item) => {
  const id = String(item.id || "");
  if (!id) return null;
  const start = item.start || {};
  const end = item.end || {};
  if (!start.dateTime) return { skippedAllDay: true };
  const tz = start.timeZone || "UTC";
  const fmt = (iso) => {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
    // en-CA -> "2026-10-05, 10:30"
    const [, date, time] = parts.match(/(\d{4}-\d{2}-\d{2})[,\s]+(\d{2}:\d{2})/) || [];
    return { date, time };
  };
  const s = fmt(start.dateTime);
  const e = end.dateTime ? fmt(end.dateTime) : { ...s, time: null };
  if (!s.date || !s.time || !e.time) return null;
  return {
    user_id: undefined, // filled by caller
    title: String(item.summary || "Google event"),
    type: "personal",
    course_id: null,
    day_of_week: null,
    start_time: s.time,
    end_time: e.time,
    date: s.date,
    room: item.location || "",
    description: item.description || "",
    recurring: false,
    google_event_id: id,
  };
};

const syncEvents = async (supabase, user, conn) => {
  const { token, error } = await freshToken(conn);
  if (error) {
    return { connected: false, created: 0, updated: 0, total: 0, skippedAllDay: 0, message: "Google access expired — reconnect to keep syncing." };
  }

  const timeMin = conn.last_synced_at || new Date(Date.now() - 14 * 86400_000).toISOString();
  const timeMax = new Date(Date.now() + 30 * 86400_000).toISOString();
  const calendar = encodeURIComponent(conn.calendar_id || "primary");
  const url = `${CALENDAR_API}/${calendar}/events?singleEvents=true&orderBy=startTime&maxResults=2500&timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}`;

  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.error("[gcal] events fetch failed:", res.status, err.error?.message);
    return { connected: false, created: 0, updated: 0, total: 0, skippedAllDay: 0, message: `Google API error: ${err.error?.message || res.statusText}` };
  }
  const data = await res.json().catch(() => ({}));
  const items = (data.items || []).slice(0, 2500);

  const rows = [];
  let skippedAllDay = 0;
  for (const item of items) {
    const row = toScheduleRow(item);
    if (!row) continue;
    if (row.skippedAllDay) {
      skippedAllDay += 1;
      continue;
    }
    rows.push({ ...row, user_id: user.id });
  }

  // Idempotent sync: split existing vs new so counts are honest.
  const existing = new Set();
  if (rows.length) {
    const ids = rows.map((r) => r.google_event_id);
    try {
      const { data: hits } = await supabase.from("schedule_events").select("google_event_id").in("google_event_id", ids);
      (hits || []).forEach((h) => existing.add(String(h.google_event_id)));
    } catch (e) {
      console.error("[gcal] existing lookup failed:", e.message);
    }
  }
  const toInsert = rows.filter((r) => !existing.has(String(r.google_event_id)));
  const toUpdate = rows.filter((r) => existing.has(String(r.google_event_id)));

  for (const r of toInsert) {
    try {
      await supabase.from("schedule_events").insert(r);
    } catch (e) {
      console.error("[gcal] insert failed:", e.message);
    }
  }
  for (const r of toUpdate) {
    try {
      await supabase.from("schedule_events").update({ ...r, user_id: undefined }).eq("google_event_id", r.google_event_id).eq("user_id", user.id);
    } catch (e) {
      console.error("[gcal] update failed:", e.message);
    }
  }

  await supabase
    .from("google_calendar_connections")
    .update({ last_synced_at: nowIso() })
    .eq("user_id", user.id);

  return {
    connected: true,
    created: toInsert.length,
    updated: toUpdate.length,
    total: rows.length,
    skippedAllDay,
  };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // ---- OAuth callback (GET from Google, no JWT) ---------------------------
    if (req.method === "GET") {
      const url = new URL(req.url);
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");

      if (url.searchParams.get("error")) {
        return Response.redirect(`${landingUrl()}?google=error`, 302);
      }
      if (!code || !state) {
        return Response.redirect(`${landingUrl()}?google=error`, 302);
      }

      const supabase = createClient(
        Deno.env.get("SUPABASE_URL"),
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
        { auth: { persistSession: false } }
      );

      const { data: pending } = await supabase.from("google_oauth_states").select("user_id").eq("state", state).maybeSingle();
      if (!pending) return Response.redirect(`${landingUrl()}?google=error`, 302);

      const tokenRes = await fetch(TOKEN_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: Deno.env.get("GOOGLE_CALENDAR_CLIENT_ID") || "",
          client_secret: Deno.env.get("GOOGLE_CALENDAR_CLIENT_SECRET") || "",
          redirect_uri: Deno.env.get("GOOGLE_CALENDAR_REDIRECT_URI") || "",
          grant_type: "authorization_code",
        }),
      });
      const tokens = await tokenRes.json().catch(() => ({}));
      if (!tokenRes.ok || !tokens.access_token) {
        console.error("[gcal] code exchange failed:", tokenRes.status, tokens.error);
        await supabase.from("google_oauth_states").delete().eq("state", state);
        return Response.redirect(`${landingUrl()}?google=error`, 302);
      }

      const expiresIn = Number(tokens.expires_in) || 3600;
      await supabase.from("google_calendar_connections").upsert(
        {
          user_id: pending.user_id,
          google_email: String(tokens.email || ""),
          refresh_token: tokens.refresh_token || null,
          access_token: tokens.access_token,
          expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
        },
        { onConflict: "user_id" }
      );
      await supabase.from("google_oauth_states").delete().eq("state", state);

      return Response.redirect(`${landingUrl()}?google=connected`, 302);
    }

    // ---- Authenticated client actions ---------------------------------------
    const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!jwt) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL"),
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
      { global: { headers: { Authorization: `Bearer ${jwt}` } }, auth: { persistSession: false } }
    );
    const { data: { user } } = await supabase.auth.getUser(jwt);
    if (!user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const action = body.action || "check";

    if (action === "check") {
      if (!isConfigured()) {
        return json({ configured: false, connected: false, message: "Google Calendar is not configured for this deployment yet." });
      }
      const { data: conn } = await supabase.from("google_calendar_connections").select("*").eq("user_id", user.id).maybeSingle();
      const connected = Boolean(conn && conn.access_token);
      return json({
        configured: true,
        connected,
        email: conn?.google_email || "",
        lastSyncedAt: conn?.last_synced_at || null,
      });
    }

    if (action === "connect") {
      if (!isConfigured()) {
        return json({ configured: false, message: "Google Calendar is not configured for this deployment yet." });
      }
      const state = randomHex();
      await supabase.from("google_oauth_states").insert({ state, user_id: user.id });
      const params = new URLSearchParams({
        client_id: Deno.env.get("GOOGLE_CALENDAR_CLIENT_ID"),
        redirect_uri: Deno.env.get("GOOGLE_CALENDAR_REDIRECT_URI"),
        response_type: "code",
        scope: SCOPES,
        access_type: "offline",
        prompt: "consent",
        include_granted_scopes: "true",
        state,
      });
      return json({ configured: true, redirectUrl: `${AUTH_ENDPOINT}?${params.toString()}` });
    }

    if (action === "sync") {
      if (!isConfigured()) {
        return json({ configured: false, created: 0, updated: 0, total: 0, skippedAllDay: 0, message: "Google Calendar is not configured for this deployment yet." });
      }
      const { data: conn } = await supabase.from("google_calendar_connections").select("*").eq("user_id", user.id).maybeSingle();
      if (!conn || !conn.access_token) {
        return json({ connected: false, created: 0, updated: 0, total: 0, skippedAllDay: 0, message: "Connect Google Calendar first, then sync." });
      }
      const result = await syncEvents(supabase, user, conn);
      return json(result);
    }

    if (action === "disconnect") {
      await supabase.from("google_calendar_connections").delete().eq("user_id", user.id);
      return json({ connected: false });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (error) {
    console.error("[gcal] error:", error.message);
    return json({ error: error.message }, 500);
  }
});