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

// Stub for the Google Calendar connector. A production version should:
//   1. Store a refresh token per user (e.g. google_calendar_connections table).
//   2. Serve the Google OAuth consent URL from a `connect` action and exchange
//      the code on redirect (a handler route, not a button click).
//   3. Fetch primary-calendar events and upsert them into `schedule_events`
//      with a `google_event_id` column for idempotent import.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
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
      return json({ connected: false, message: "Google Calendar OAuth is not configured yet." });
    }

    if (action === "connect") {
      return json({ connected: false, message: "Google Calendar OAuth is not configured yet." });
    }

    if (action === "disconnect") {
      return json({ connected: false });
    }

    if (action === "sync") {
      return json({ created: 0, updated: 0, total: 0, message: "Google Calendar OAuth is not configured yet." });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (error) {
    return json({ error: error.message }, 500);
  }
});