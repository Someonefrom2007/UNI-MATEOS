import { useState, useEffect, useCallback } from "react";
import { Plug, RefreshCw, CircleCheck, CircleAlert, CircleMinus, CircleHelp } from "lucide-react";

import { useAdmin } from "@/lib/admin/useAdmin";
import { probeGoogle, probeBilling } from "@/lib/admin/probes";

const STATUS_UI = {
  operational: { icon: CircleCheck, color: "text-teal-400", label: "connected" },
  degraded: { icon: CircleMinus, color: "text-amber-400", label: "degraded" },
  unavailable: { icon: CircleAlert, color: "text-rose-400", label: "unavailable" },
  not_configured: { icon: CircleMinus, color: "text-slate-500", label: "not configured" },
  unknown: { icon: CircleHelp, color: "text-slate-500", label: "unknown" },
};

const Row = ({ name, description, probe }) => {
  const ui = STATUS_UI[probe.status] || STATUS_UI.unknown;
  const Icon = ui.icon;
  return (
    <div className="px-5 py-4 flex flex-wrap items-center gap-3">
      <Icon className={`w-5 h-5 shrink-0 ${ui.color}`} />
      <div className="min-w-0 flex-1">
        <div className="text-slate-200 font-medium">{name}</div>
        <div className="text-xs text-slate-500">{description}</div>
        <div className="text-[11px] text-slate-600 font-mono mt-1">{probe.detail}</div>
      </div>
      <span className={`text-[10px] font-mono uppercase tracking-wider ${ui.color}`}>{ui.label}</span>
    </div>
  );
};

export default function AdminIntegrations() {
  const { env } = useAdmin();
  const [probes, setProbes] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [google, billing] = await Promise.all([probeGoogle(), probeBilling()]);
    setProbes({ google, billing });
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-teal-400/80">configure</div>
          <h1 className="font-display text-2xl font-semibold text-slate-50 mt-1 flex items-center gap-2">
            <Plug className="w-6 h-6 text-teal-400" /> Integrations
          </h1>
          <p className="text-sm text-slate-400 mt-1">Live probes for external services. Secrets stay server-side — only presence/status is reported.</p>
        </div>
        <button onClick={load} disabled={loading} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-sm text-slate-300 hover:text-slate-100 disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Re-probe
        </button>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.03] divide-y divide-white/5">
        {loading || !probes ? (
          <div className="p-8 text-center text-sm text-slate-500">Probing…</div>
        ) : (
          <>
            <Row
              name="Lemon Squeezy (billing)"
              description="Source of truth for subscriptions and entitlements."
              probe={probes.billing}
            />
            <Row
              name="Google Calendar / OAuth"
              description="Calendar sync + sign-in. Checks env + a lightweight endpoint call."
              probe={probes.google}
            />
          </>
        )}
      </div>

      <p className="text-[11px] text-slate-600 font-mono">
        {env.hosted
          ? "Hosted: configured = secrets present in the edge functions; verified = a safe probe succeeded."
          : "Local: no server secrets — reported as not configured rather than faking a connection."}
      </p>
      <p className="text-[11px] text-slate-600 font-mono">
        OpenAI is configured under AI assistant. No Stripe integration exists — Lemon Squeezy is the only billing provider.
      </p>
    </div>
  );
}