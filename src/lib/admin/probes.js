// UNI·MATE Control Center — real system probes.
//
// Every check answers only from what actually happened: an RPC that answered,
// a function that reported configured:true/false, or an error that threw.
// Nothing is assumed reachable; nothing is invented. The AI probe is no-cost:
// it sends an EMPTY question, which the edge rejects before any LLM call —
// a 400 proves the function is deployed, the session verifies, and the plan
// gate passed. We never fire a real completion from the console.

import { hasSupabaseEnv } from "@/lib/repo/select";
import { supabase } from "@/lib/supabase";
import { classify, PULSE, check } from "@/lib/admin/pulse";
import { getBillingService } from "@/lib/billing/lemonSqueezy";
import { recentAudit } from "@/lib/admin/auditLog";

/**
 * Read recent audit entries through the RIGHT channel: hosted mode goes via
 * the SECURITY DEFINER audit_recent() RPC (audit_log has no client policies);
 * the local workspace reads its own ledger through the repo.
 */
export const readAudit = async (repo, limit = 100) => {
  if (hasSupabaseEnv()) {
    try {
      const { data, error } = await supabase.rpc("audit_recent", { p_limit: limit });
      if (!error && Array.isArray(data)) return { entries: data };
    } catch {
      /* fall through to the repo path */
    }
  }
  return recentAudit({ repo }, limit);
};

const result = (id, label, status, detail) => check({ id, label, status, detail });

export const probeDatabase = async () => {
  if (!hasSupabaseEnv()) {
    return result("database", "Database (Supabase)", classify({ configured: false }), "Local workspace — on-device storage only");
  }
  try {
    const { error } = await supabase.from("user_profiles").select("id", { count: "exact", head: true });
    if (error) return result("database", "Database (Supabase)", PULSE.DEGRADED, `${error.code || "error"} — reachable but degraded`);
    return result("database", "Database (Supabase)", PULSE.OPERATIONAL, "reachable — RLS-scoped query ok");
  } catch (e) {
    return result("database", "Database (Supabase)", PULSE.UNAVAILABLE, e?.message || "network unreachable");
  }
};

export const probeAdminGate = async () => {
  if (!hasSupabaseEnv()) {
    return result("adminGate", "Admin gate (RLS)", classify({ configured: false }), "no server — auth not enforced");
  }
  try {
    const { error } = await supabase.rpc("is_admin");
    if (error) return result("adminGate", "Admin gate (RLS)", PULSE.UNAVAILABLE, "is_admin() missing — schema not applied");
    return result("adminGate", "Admin gate (RLS)", PULSE.OPERATIONAL, "is_admin() verified this session");
  } catch (e) {
    return result("adminGate", "Admin gate (RLS)", PULSE.UNAVAILABLE, e?.message || "unreachable");
  }
};

export const probeBilling = async () => {
  if (!hasSupabaseEnv()) {
    return result("billing", "Billing (Lemon Squeezy)", classify({ configured: false }), "local workspace — no provider");
  }
  try {
    const { configured } = await getBillingService().status();
    if (configured) return result("billing", "Billing (Lemon Squeezy)", PULSE.OPERATIONAL, "edge function configured");
    return result("billing", "Billing (Lemon Squeezy)", classify({ configured: false }), "no provider secrets on the deployment");
  } catch (e) {
    return result("billing", "Billing (Lemon Squeezy)", PULSE.UNAVAILABLE, e?.message || "edge function error");
  }
};

export const probeGoogle = async () => {
  if (!hasSupabaseEnv()) {
    return result("google", "Google connectors", classify({ configured: false }), "local workspace — no provider");
  }
  try {
    const res = await supabase.functions.invoke("google-calendar-sync", { body: { action: "check" } });
    if (res.error) return result("google", "Google connectors", PULSE.UNAVAILABLE, res.error.message || "edge function error");
    const data = res.data || {};
    if (data.configured) return result("google", "Google connectors", PULSE.OPERATIONAL, "OAuth app configured");
    return result("google", "Google connectors", classify({ configured: false }), "no Google OAuth secrets on the deployment");
  } catch (e) {
    return result("google", "Google connectors", PULSE.UNAVAILABLE, e?.message || "unreachable");
  }
};

const edgeStatus = (error) => {
  if (!error) return null;
  if (typeof error.context?.status === "number") return error.context.status;
  if (typeof error.status === "number") return error.status;
  const hit = String(error.message || "").match(/\b([45]\d\d)\b/);
  return hit ? Number(hit[1]) : null;
};

/**
 * AI assistant reachability — a no-cost probe. Invoking with an empty body is
 * rejected BEFORE the LLM is contacted, so the state is classified from the
 * rejected response: 400 = deployed + authenticated + entitled; 402 = entitled
 * gate failed for this session; 401/404/etc = reachable but gated / not deployed.
 */
export const probeAssistant = async () => {
  if (!hasSupabaseEnv()) {
    return result("assistant", "AI assistant", classify({ configured: false }), "local workspace — no edge functions");
  }
  try {
    const res = await supabase.functions.invoke("ai-assistant", { body: {} });
    if (res.error) {
      const status = edgeStatus(res.error);
      if (status === 400) return result("assistant", "AI assistant", PULSE.OPERATIONAL, "edge reachable — JWT + plan gate verified (no-cost empty-body probe)");
      if (status === 402) return result("assistant", "AI assistant", PULSE.DEGRADED, "edge reachable — this session isn't on an entitled (pro+) plan");
      if (status === 401) return result("assistant", "AI assistant", PULSE.DEGRADED, "edge reachable — no valid session was attached");
      if (status === 404) return result("assistant", "AI assistant", PULSE.UNAVAILABLE, "ai-assistant edge function is not deployed on this project");
      return result("assistant", "AI assistant", PULSE.DEGRADED, status ? `edge reachable — unexpected status ${status}` : (res.error.message || "edge returned an error"));
    }
    return result("assistant", "AI assistant", PULSE.OPERATIONAL, "edge responded to the probe (empty reply — no LLM call made)");
  } catch (e) {
    return result("assistant", "AI assistant", PULSE.UNAVAILABLE, e?.message || "edge function unreachable");
  }
};

/** Number of independent checks the suite reports (drives skeleton counts). */
export const PROBE_COUNT = 5;

/** Run the full suite concurrently. */
export const runSystemProbes = () =>
  Promise.all([probeDatabase(), probeAdminGate(), probeBilling(), probeGoogle(), probeAssistant()]);