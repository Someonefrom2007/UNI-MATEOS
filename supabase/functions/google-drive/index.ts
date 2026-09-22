// UNI·MATE Google Drive connector — real OAuth2, env-gated.
//
// Mirrors google-calendar-sync: a deployed, configured function runs OAuth and
// imports the user's own Drive files into the `resources` table (the app's real
// study-material surface), deduped by drive_file_id. Without credentials every
// action stays honest with { configured: false }.
//
// Routes:
//   POST (auth'd)  { action: "check" | "connect" | "sync" | "disconnect" }
//   GET  (public)  ?code=...&state=...   -> OAuth callback, 302 back to the app

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
const DRIVE_API = "https://www.googleapis.com/drive/v3/files";

const SCOPES = "https://www.googleapis.com/auth/drive.readonly";

const isConfigured = () =>
  Boolean(
    Deno.env.get("GOOGLE_DRIVE_CLIENT_ID") &&
      Deno.env.get("GOOGLE_DRIVE_CLIENT_SECRET") &&
      Deno.env.get("GOOGLE_DRIVE_REDIRECT_URI")
  );

const landingUrl = () =>
  Deno.env.get("GOOGLE_DRIVE_REDIRECT_URL") || String(Deno.env.get("SUPABASE_URL") || "/");

const randomHex = (bytes = 24) => {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return [...arr].map((b) => b.toString(16).padStart(2, "0")).join("");
};

const nowIso = () => new Date().toISOString();

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
      client_id: Deno.env.get("GOOGLE_DRIVE_CLIENT_ID") || "",
      client_secret: Deno.env.get("GOOGLE_DRIVE_CLIENT_SECRET") || "",
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    console.error("[gdrive] refresh failed:", res.status, data.error_description || data.error);
    return { token: null, error: "refresh-failed" };
  }
  return { token: data.access_token };
};

const updateTokens = async (supabase, userId, tokenData) => {
  const expiresIn = Number(tokenData.expires_in) || 3600;
  const { error } = await supabase
    .from("google_drive_connections")
    .update({
      access_token: tokenData.access_token,
      expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
    })
    .eq("user_id", userId);
  if (error) console.error("[gdrive] token refresh persist failed:", error.message);
};

const MIME_TO_TYPE = [
  ["application/pdf", "pdf"],
  ["application/vnd.google-apps.document", "doc"],
  ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "doc"],
  ["application/msword", "doc"],
  ["application/vnd.google-apps.presentation", "presentation"],
  ["application/vnd.openxmlformats-officedocument.presentationml.presentation", "presentation"],
  ["application/vnd.ms-powerpoint", "presentation"],
  ["application/vnd.google-apps.spreadsheet", "file"],
  ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "file"],
  ["application/vnd.ms-excel", "file"],
  ["text/", "file"],
  ["image/", "image"],
  ["video/", "video"],
];

const resourceTypeFor = (mime) => {
  const m = String(mime || "");
  for (const [prefix, type] of MIME_TO_TYPE) {
    if (m.startsWith(prefix)) return type;
  }
  return "link";
};

// A Drive file object -> resources.row. Folders and binary blobs without a
// web link are skipped and reported, keeping the summary honest.
const toResourceRow = (file) => {
  const id = String(file.id || "");
  if (!id) return null;
  const mime = String(file.mimeType || "");
  if (mime === "application/vnd.google-apps.folder") return { skippedFolder: true };
  if (!file.webViewLink) return { skippedFolder: true };
  return {
    name: String(file.name || "Drive file"),
    type: resourceTypeFor(mime),
    description: mime,
    url: file.webViewLink,
    tags: ["drive"],
    drive_file_id: id,
  };
};

const syncFiles = async (supabase, user, conn) => {
  const { token, error } = await freshToken(conn);
  if (error) {
    return { connected: false, created: 0, updated: 0, total: 0, skipped: 0, message: "Google access expired — reconnect to keep syncing." };
  }

  const q = "trashed = false and 'me' in owners";
  const url = `${DRIVE_API}?q=${encodeURIComponent(q)}&pageSize=100&orderBy=modifiedTime desc&fields=${encodeURIComponent("nextPageToken,files(id,name,mimeType,webViewLink,modifiedTime)")}`;

  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.error("[gdrive] files fetch failed:", res.status, err.error?.message);
    return { connected: false, created: 0, updated: 0, total: 0, skipped: 0, message: `Google API error: ${err.error?.message || res.statusText}` };
  }
  const data = await res.json().catch(() => ({}));
  const files = data.files || [];

  const rows = [];
  let skipped = 0;
  for (const file of files) {
    const row = toResourceRow(file);
    if (!row) continue;
    if (row.skippedFolder) {
      skipped += 1;
      continue;
    }
    rows.push({ ...row, user_id: user.id });
  }

  const existing = new Set();
  if (rows.length) {
    const ids = rows.map((r) => r.drive_file_id);
    try {
      const { data: hits } = await supabase.from("resources").select("drive_file_id").in("drive_file_id", ids);
      (hits || []).forEach((h) => existing.add(String(h.drive_file_id)));
    } catch (e) {
      console.error("[gdrive] existing lookup failed:", e.message);
    }
  }

  const toInsert = rows.filter((r) => !existing.has(String(r.drive_file_id)));
  const toUpdate = rows.filter((r) => existing.has(String(r.drive_file_id)));

  for (const r of toInsert) {
    try {
      await supabase.from("resources").insert(r);
    } catch (e) {
      console.error("[gdrive] insert failed:", e.message);
    }
  }
  for (const r of toUpdate) {
    const { drive_file_id, ...patch } = r;
    try {
      await supabase.from("resources").update(patch).eq("drive_file_id", drive_file_id).eq("user_id", user.id);
    } catch (e) {
      console.error("[gdrive] update failed:", e.message);
    }
  }

  await supabase
    .from("google_drive_connections")
    .update({ last_synced_at: nowIso() })
    .eq("user_id", user.id);

  return { connected: true, created: toInsert.length, updated: toUpdate.length, total: rows.length, skipped };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (req.method === "GET") {
      const url = new URL(req.url);
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");

      if (url.searchParams.get("error") || !code || !state) {
        return Response.redirect(`${landingUrl()}?drive=error`, 302);
      }

      const supabase = createClient(
        Deno.env.get("SUPABASE_URL"),
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
        { auth: { persistSession: false } }
      );

      const { data: pending } = await supabase.from("google_oauth_states").select("user_id").eq("state", state).maybeSingle();
      if (!pending) return Response.redirect(`${landingUrl()}?drive=error`, 302);

      const tokenRes = await fetch(TOKEN_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: Deno.env.get("GOOGLE_DRIVE_CLIENT_ID") || "",
          client_secret: Deno.env.get("GOOGLE_DRIVE_CLIENT_SECRET") || "",
          redirect_uri: Deno.env.get("GOOGLE_DRIVE_REDIRECT_URI") || "",
          grant_type: "authorization_code",
        }),
      });
      const tokens = await tokenRes.json().catch(() => ({}));
      if (!tokenRes.ok || !tokens.access_token) {
        console.error("[gdrive] code exchange failed:", tokenRes.status, tokens.error);
        await supabase.from("google_oauth_states").delete().eq("state", state);
        return Response.redirect(`${landingUrl()}?drive=error`, 302);
      }

      const expiresIn = Number(tokens.expires_in) || 3600;
      await supabase.from("google_drive_connections").upsert(
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

      return Response.redirect(`${landingUrl()}?drive=connected`, 302);
    }

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
        return json({ configured: false, connected: false, message: "Google Drive is not configured for this deployment yet." });
      }
      const { data: conn } = await supabase.from("google_drive_connections").select("*").eq("user_id", user.id).maybeSingle();
      return json({
        configured: true,
        connected: Boolean(conn && conn.access_token),
        email: conn?.google_email || "",
        lastSyncedAt: conn?.last_synced_at || null,
      });
    }

    if (action === "connect") {
      if (!isConfigured()) {
        return json({ configured: false, message: "Google Drive is not configured for this deployment yet." });
      }
      const state = randomHex();
      await supabase.from("google_oauth_states").insert({ state, user_id: user.id });
      const params = new URLSearchParams({
        client_id: Deno.env.get("GOOGLE_DRIVE_CLIENT_ID"),
        redirect_uri: Deno.env.get("GOOGLE_DRIVE_REDIRECT_URI"),
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
        return json({ configured: false, created: 0, updated: 0, total: 0, skipped: 0, message: "Google Drive is not configured for this deployment yet." });
      }
      const { data: conn } = await supabase.from("google_drive_connections").select("*").eq("user_id", user.id).maybeSingle();
      if (!conn || !conn.access_token) {
        return json({ connected: false, created: 0, updated: 0, total: 0, skipped: 0, message: "Connect Google Drive first, then sync." });
      }
      return json(await syncFiles(supabase, user, conn));
    }

    if (action === "disconnect") {
      await supabase.from("google_drive_connections").delete().eq("user_id", user.id);
      return json({ connected: false });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (error) {
    console.error("[gdrive] error:", error.message);
    return json({ error: error.message }, 500);
  }
});