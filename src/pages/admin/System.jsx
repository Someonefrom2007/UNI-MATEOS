import { useState, useEffect, useCallback } from "react";
import { Activity, RefreshCw, CircleCheck, CircleAlert, CircleHelp, CircleMinus } from "lucide-react";

import { useAdmin } from "@/lib/admin/useAdmin";
import { PULSE, PULSE_LABELS, worstOf, overallLabel } from "@/lib/admin/pulse";
import { runSystemProbes } from "@/lib/admin/probes";

const ICONS = {
  [PULSE.OPERATIONAL]: CircleCheck,
  [PULSE.DEGRADED]: CircleMinus,
  [PULSE.UNAVAILABLE]: CircleAlert,
  [PULSE.NOT_CONFIGURED]: CircleMinus,
  [PULSE.UNKNOWN]: CircleHelp,
};
const COLORS = {
  [PULSE.OPERATIONAL]: "text-teal-400",
  [PULSE.DEGRADED]: "text-amber-400",
  [PULSE.UNAVAILABLE]: "text-rose-400",
  [PULSE.NOT_CONFIGURED]: "text-slate-500",
  [PULSE.UNKNOWN]: "text-slate-500",
};

export default function AdminSystem() {
  const { env } = useAdmin();
  const [checks, setChecks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [versions, setVersions] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const results = await runSystemProbes();
    setChecks(results);
    // Build/runtime facts we can state honestly.
    const info = {
      environment: env.name,
      enforcement: env.enforced ? "server (RLS + admin_accounts)" : "client-only (local workspace)",
      supabaseEnv: Boolean(import.meta.env?.VITE_SUPABASE_URL),
      mode: env.hosted ? "hosted" : "local",
      builtAt: typeof import.meta.env?.VITE_BUILD_TIME !== "undefined" ? import.meta.env.VITE_BUILD_TIME : "not exposed",
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "n/a",
      checkedAt: new Date().toISOString(),
    };
    setVersions(info);
    setLoading(false);
  }, [env]);

  useEffect(() => { load(); }, [load]);

  const overall = checks.length ? worstOf(checks.map((c) => c.status)) : PULSE.UNKNOWN;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-teal-400/80">system</div>
          <h1 className="font-display text-2xl font-semibold text-slate-50 mt-1 flex items-center gap-2">
            <Activity className="w-6 h-6 text-teal-400" /> System health
          </h1>
          <p className="text-sm text-slate-400 mt-1">Every status below comes from a live probe this session — nothing is presumed healthy.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-[11px] font-mono uppercase tracking-widest ${COLORS[overall]}`}>{overallLabel(overall)}</span>
          <button onClick={load} disabled={loading} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-sm text-slate-300 hover:text-slate-100 disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Re-probe
          </button>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        {(loading && checks.length === 0 ? Array.from({ length: 5 }, (_, i) => ({ id: `s${i}`, label: "probing…", status: PULSE.UNKNOWN, detail: "running checks" })) : checks).map((c) => {
          const Icon = ICONS[c.status] || CircleHelp;
          return (
            <div key={c.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center gap-2 mb-2">
                <Icon className={`w-5 h-5 ${COLORS[c.status]}`} />
                <span className="text-slate-200 font-medium">{c.label}</span>
                <span className={`ml-auto text-[10px] font-mono uppercase ${COLORS[c.status]}`}>{PULSE_LABELS[c.status]}</span>
              </div>
              <p className="text-sm text-slate-500">{c.detail}</p>
            </div>
          );
        })}
      </div>

      {versions && (
        <section className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
          <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-slate-400 mb-3">runtime facts</div>
          <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
            {Object.entries(versions).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3 border-b border-white/5 pb-1.5">
                <dt className="text-slate-500 font-mono text-xs">{k}</dt>
                <dd className="text-slate-300 font-mono text-xs truncate">{String(v)}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <p className="text-[11px] text-slate-600 font-mono">Probes: head-count query · is_admin() RPC · billing status · Google OAuth check · AI assistant (no-cost empty-body edge probe — never a live LLM call).</p>
    </div>
  );
}