// UNI·MATE Admin Gateway — the server-side channel for the Control Center.
//
// The console pages read and write through this endpoint instead of touching
// admin tables directly. It is a thin, read-only envelope TODAY and stays that
// way until a future milestone adds specific, env-gated operations:
//
//   whoami  -> { admin, role, permissions }  (SECURITY DEFINER RPCs; a non-admin
//              is answered honestly with admin:false, never with an error)
//   audit   -> recent audit entries      (audit_recent(), admin-only inside)
//   roster  -> admin membership rows     (admin_roster(), admin-only inside)
//   config  -> { opsEnabled: false }     (honest: NO destructive ops yet)
//
// MUTATIONS (entitlement override, webhook replay, auth-user purge, …) are NOT
// implemented. Any action-name that looks destructive returns 400 with an
// explicit "ops not enabled" so the console can never half-run a dangerous op.
//
// Security model:
//   * Identity comes from the caller's JWT (forwarded to the RPCs) — the client
//     can never claim a role; is_admin()/current_admin_role() read
//     public.admin_accounts via SECURITY DEFINER functions that re-verify the
//     caller internally.
//   * The service-role key never leaves Deno.environment and is never used to
//     impersonate any user.
//   * Ops that would mutate billing/accounts require an explicit
//     ADMIN_GATEWAY_OPS_SECRET to be configured AND a signed-by-token request —
//     none of that surface exists in this build, so it is absent here too.

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

// Names that a future ops milestone would implement — recognized so the console
// gets an explicit "not enabled" instead of a generic unknown-action error.
const KNOWN_OPS = new Set(["entitlement", "reconcile", "webhook-replay", "purge-user", "delete-user"]);
const knownOps = (action) => KNOWN_OPS.has(action);

const call = async (supabase, fn, args = {}) => {
  const { data, error } = await supabase.rpc(fn, args);
  return { data, error };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

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
    const action = String(body.action || "whoami");

    if (knownOps(action)) {
      // Deliberately absent: the mutating surface is future work, and no
      // half-implemented op is ever exposed. Action names are recognized so the
      // console can show the honest "not enabled" state.
      return json({ ok: false, opsEnabled: false, error: `${action} is not enabled in this build`, hint: "OPS surface is future work behind ADMIN_GATEWAY_OPS_SECRET." }, 400);
    }

    if (action === "whoami") {
      const { data: isAdmin, error: adminError } = await call(supabase, "is_admin");
      if (adminError) return json({ error: "Admin schema not applied", detail: adminError.message }, 503);
      if (!isAdmin) return json({ admin: false, role: "user", source: "hosted" });
      const { data: role } = await call(supabase, "current_admin_role");
      const { data: permissions } = await call(supabase, "current_admin_permissions");
      return json({ admin: true, role: role || "admin", permissions: Array.isArray(permissions) ? permissions : [], source: "hosted" });
    }

    if (action === "audit") {
      const { data: isAdmin, error } = await call(supabase, "is_admin");
      if (error) return json({ error: "Admin schema not applied", detail: error.message }, 503);
      if (!isAdmin) return json({ error: "Forbidden" }, 403);
      const limit = Math.max(1, Math.min(Number(body.limit) || 100, 500));
      const { data: entries } = await call(supabase, "audit_recent", { p_limit: limit });
      return json({ entries: Array.isArray(entries) ? entries : [] });
    }

    if (action === "roster") {
      const { data, error } = await call(supabase, "admin_roster");
      if (error) return json({ error: "Forbidden" }, 403);
      return json({ roster: Array.isArray(data) ? data : [] });
    }

    if (action === "config") {
      return json({ configured: true, opsEnabled: false, source: "hosted" });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (error) {
    return json({ error: error.message }, 500);
  }
});