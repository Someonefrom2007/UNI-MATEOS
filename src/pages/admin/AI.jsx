import { useState, useEffect, useCallback } from "react";
import { Brain, RefreshCw, CircleHelp, CircleAlert, CircleCheck, CircleMinus } from "lucide-react";

import { getAppRepo } from "@/lib/repo/select";
import { useAdmin } from "@/lib/admin/useAdmin";
import { can, PERMISSIONS } from "@/lib/admin/permissions";
import { normalizeFlag, flagRow, evaluateFlag } from "@/lib/admin/featureFlags";
import { withAudit } from "@/lib/admin/auditLog";
import { probeAssistant } from "@/lib/admin/probes";
import { useToast } from "@/components/ui/use-toast";

const PULSE_UI = {
  operational: { icon: CircleCheck, color: "text-teal-400", label: "operational" },
  degraded: { icon: CircleMinus, color: "text-amber-400", label: "degraded" },
  unavailable: { icon: CircleAlert, color: "text-rose-400", label: "unavailable" },
  not_configured: { icon: CircleMinus, color: "text-slate-500", label: "not configured" },
  unknown: { icon: CircleHelp, color: "text-slate-500", label: "unknown" },
};

export default function AdminAI() {
  const { principal, env } = useAdmin();
  const { toast } = useToast();
  const repo = getAppRepo();
  const mayManage = can(principal, PERMISSIONS.AI_MANAGE);

  const [status, setStatus] = useState(
    /** @type {{ id: string, label: string, status: string, detail?: string }} */
    ({ id: "ai.assistant", label: "AI assistant", status: "unknown", detail: "Probing…" })
  );
  const [flag, setFlag] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const s = await probeAssistant();
    setStatus(s);
    try {
      const rows = await repo.list("FeatureFlag");
      const row = (Array.isArray(rows) ? rows : []).find((r) => r.key === "ai_assistant");
      setFlag(row ? normalizeFlag(row) : normalizeFlag({ key: "ai_assistant", enabled: true, scope: "all" }));
    } catch {
      setFlag(normalizeFlag({ key: "ai_assistant", enabled: true, scope: "all" }));
    }
    setLoading(false);
  }, [repo]);

  useEffect(() => { load(); }, [load]);

  const preview = flag
    ? evaluateFlag(flag, { env: env.name, plan: "free", isAdmin: false, userId: "preview-user" })
    : null;

  const toggle = async () => {
    if (!mayManage || !flag) return;
    setBusy(true);
    const next = { ...flag, enabled: !flag.enabled };
    try {
      const rows = await repo.list("FeatureFlag");
      const existing = (Array.isArray(rows) ? rows : []).find((r) => r.key === "ai_assistant");
      if (existing) await repo.update("FeatureFlag", existing.id, flagRow(next));
      else await repo.create("FeatureFlag", flagRow(next));
      await withAudit({ repo }, {
        action: `feature_flag.${next.enabled ? "enable" : "disable"}`,
        targetType: "FeatureFlag",
        targetId: "ai_assistant",
        actor: principal?.id || null,
        meta: { env: env.name, enabled: next.enabled },
      }, async () => ({ ok: true }));
      setFlag(next);
      toast({ title: `AI assistant ${next.enabled ? "enabled" : "disabled"}`, description: "Audited. Entitlements still gate paid AI features." });
    } catch (e) {
      toast({ title: "Failed", description: e?.message || "write rejected" });
    }
    setBusy(false);
  };

  const Icon = PULSE_UI[status.status]?.icon || CircleHelp;
  const color = PULSE_UI[status.status]?.color || "text-slate-500";

  return (
    <div className="space-y-5">
      <div>
        <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-teal-400/80">configure</div>
        <h1 className="font-display text-2xl font-semibold text-slate-50 mt-1 flex items-center gap-2">
          <Brain className="w-6 h-6 text-teal-400" /> AI assistant
        </h1>
        <p className="text-sm text-slate-400 mt-1">OpenAI runs server-side (edge function). The browser never sees the API key.</p>
      </div>

      <section className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
        <div className="flex items-center gap-3">
          <Icon className={`w-6 h-6 ${color}`} />
          <div>
            <div className="text-slate-200 font-medium">Provider status: <span className={color}>{PULSE_UI[status.status]?.label || status.status}</span></div>
            <div className="text-sm text-slate-500">{status.detail}</div>
          </div>
          <button onClick={load} disabled={loading} className="ml-auto flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-sm text-slate-300 hover:text-slate-100 disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Re-probe
          </button>
        </div>
        <p className="text-[11px] text-slate-600 font-mono mt-3">
          The probe sends an empty question — the edge rejects it before any LLM call, so it costs nothing. A live completion test is never run from the console.
        </p>
      </section>

      <section className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
        <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-slate-400 mb-4">feature flag · ai_assistant</div>
        {loading || !flag ? (
          <div className="text-sm text-slate-500">Loading flag…</div>
        ) : (
          <div className="flex flex-wrap items-center gap-4">
            <button
              onClick={toggle}
              disabled={!mayManage || busy}
              className={`w-14 h-7 rounded-full transition-colors relative disabled:opacity-50 ${flag.enabled ? "bg-teal-500/70" : "bg-white/10"}`}
              aria-pressed={flag.enabled}
            >
              <span className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all ${flag.enabled ? "left-8" : "left-1"}`} />
            </button>
            <div className="text-sm">
              <div className="text-slate-200">{flag.enabled ? "Enabled" : "Disabled"} (rollout {flag.rolloutPct ?? 100}%)</div>
              <div className="text-xs text-slate-500">
                Preview (free plan, preview-user): <span className={preview ? "text-teal-400" : "text-slate-500"}>{preview ? "ON" : "OFF"}</span>
              </div>
            </div>
          </div>
        )}
        <p className="text-[11px] text-slate-600 font-mono mt-3">
          Flags are delivery switches, not authorization — paid AI still requires a Pro+ entitlement, enforced server-side by the edge function.
        </p>
        {!mayManage && <p className="text-[11px] text-amber-500/80 font-mono mt-1">Read-only: ai.manage required to flip flags.</p>}
      </section>
    </div>
  );
}