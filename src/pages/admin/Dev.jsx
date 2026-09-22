import { useState, useEffect, useCallback } from "react";
import { Wrench, Database, Server, Info } from "lucide-react";

import { getAppRepo, hasSupabaseEnv, isLocalWorkspace } from "@/lib/repo/select";
import { useAdmin } from "@/lib/admin/useAdmin";
import { can, PERMISSIONS } from "@/lib/admin/permissions";
import { withAudit } from "@/lib/admin/auditLog";
import { probeDatabase, probeAdminGate } from "@/lib/admin/probes";
import { useToast } from "@/components/ui/use-toast";

const safeList = async (repo, table) => {
  try {
    const rows = await repo.list(table);
    return { rows: Array.isArray(rows) ? rows : [], failed: false };
  } catch (e) {
    return { rows: [], failed: true, error: e?.message };
  }
};

export default function AdminDev() {
  const { principal, env } = useAdmin();
  const { toast } = useToast();
  const repo = getAppRepo();
  const mayTouch = can(principal, PERMISSIONS.SYSTEM_MANAGE);

  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [db, gate] = await Promise.all([probeDatabase(), probeAdminGate()]);
    const tables = ["User", "Subscription", "WebhookEvent", "AuditLog", "FeatureFlag", "Announcement", "CommunityReport"];
    const counts = {};
    for (const t of tables) counts[t] = await safeList(repo, t);
    setInfo({ db, gate, counts, env, hasSupabase: hasSupabaseEnv(), local: isLocalWorkspace() });
    setLoading(false);
  }, [repo, env]);

  useEffect(() => { load(); }, [load]);

  const seedDemoFlag = async () => {
    if (!mayTouch) return;
    try {
      const existing = await safeList(repo, "FeatureFlag");
      const already = existing.rows.find((r) => r.key === "dev_playground");
      if (already) {
        toast({ title: "Already exists", description: "dev_playground flag is present." });
        return;
      }
      await repo.create("FeatureFlag", {
        key: "dev_playground",
        enabled: false,
        scope: "admins",
        rollout_pct: 100,
        description: "Local development playground flag.",
      });
      await withAudit({ repo }, {
        action: "feature_flag.create",
        targetType: "FeatureFlag",
        targetId: "dev_playground",
        actor: principal?.id || null,
        meta: { env: env.name, via: "dev page" },
      }, async () => ({ ok: true }));
      toast({ title: "Created dev_playground", description: "Disabled by default; audited." });
      await load();
    } catch (e) {
      toast({ title: "Failed", description: e?.message || "write rejected" });
    }
  };

  const Row = ({ label, value, mono = true }) => (
    <div className="flex justify-between gap-4 border-b border-white/5 py-1.5 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className={`${mono ? "font-mono text-xs" : ""} text-slate-300 truncate text-right`}>{String(value)}</span>
    </div>
  );

  return (
    <div className="space-y-5">
      <div>
        <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-teal-400/80">dev</div>
        <h1 className="font-display text-2xl font-semibold text-slate-50 mt-1 flex items-center gap-2">
          <Wrench className="w-6 h-6 text-teal-400" /> Developer tools
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Diagnostics only. There is deliberately no raw SQL console — dangerous operations belong to migrations, not the browser.
        </p>
      </div>

      {loading || !info ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-8 text-center text-sm text-slate-500">Collecting…</div>
      ) : (
        <>
          <section className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
            <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-slate-400 mb-3 flex items-center gap-2">
              <Database className="w-3.5 h-3.5" /> connectivity
            </div>
            <Row label="Supabase env present" value={info.hasSupabase ? "yes" : "no"} />
            <Row label="Mode" value={info.local ? "local workspace" : "hosted"} />
            <Row label="Database probe" value={info.db.detail} />
            <Row label="Admin gate probe" value={info.gate.detail} />
          </section>

          <section className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
            <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-slate-400 mb-3 flex items-center gap-2">
              <Server className="w-3.5 h-3.5" /> table visibility (row counts in your scope)
            </div>
            {Object.entries(info.counts).map(([table, res]) => (
              <Row
                key={table}
                label={table}
                value={res.failed ? `error — ${res.error || "not readable"}` : `${res.rows.length} rows`}
              />
            ))}
          </section>

          <section className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
            <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-slate-400 mb-3">safe actions</div>
            <button
              onClick={seedDemoFlag}
              disabled={!mayTouch}
              className="px-3 py-2 rounded-lg bg-white/5 ring-1 ring-white/10 text-sm text-slate-200 hover:bg-white/10 disabled:opacity-40"
            >
              Ensure dev_playground flag
            </button>
            <p className="text-[11px] text-slate-600 font-mono mt-2 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5" /> Creates a disabled feature flag if missing. Audited. Requires system.manage (super-admin).
            </p>
          </section>

          <p className="text-[11px] text-slate-600 font-mono">
            Destructive maintenance (purging auth users, replaying all webhooks, rotating keys) is intentionally absent — it belongs in server-side admin-gateway flows with typed confirmations.
          </p>
        </>
      )}
    </div>
  );
}