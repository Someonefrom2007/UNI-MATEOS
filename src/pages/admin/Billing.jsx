import { useState, useEffect, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import { CreditCard, RefreshCw, TriangleAlert, CircleCheck, PlugZap, Info } from "lucide-react";

import { getAppRepo } from "@/lib/repo/select";
import { useAdmin } from "@/lib/admin/useAdmin";
import { can, PERMISSIONS } from "@/lib/admin/permissions";
import { reconcile, normalizeSubscription } from "@/lib/admin/reconcile";
import { withAudit } from "@/lib/admin/auditLog";
import { useToast } from "@/components/ui/use-toast";

const isActiveStatus = (s) => ["active", "on_trial"].includes(String(s || "").toLowerCase());

const statusBadge = (s) => {
  const v = String(s || "").toLowerCase();
  if (isActiveStatus(v)) return "text-teal-400 bg-teal-500/10";
  if (["failed", "unpaid", "expired"].includes(v)) return "text-rose-400 bg-rose-500/10";
  if (["cancelled", "paused", "retrying"].includes(v)) return "text-amber-400 bg-amber-500/10";
  return "text-slate-400 bg-white/5";
};

const timeAgo = (iso) => {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

export default function AdminBilling() {
  const { principal, env } = useAdmin();
  const { toast } = useToast();
  const repo = getAppRepo();
  const mayManage = can(principal, PERMISSIONS.BILLING_MANAGE);

  const [subs, setSubs] = useState([]);
  const [hooks, setHooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const [report, setReport] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const [s, h] = await Promise.all([repo.list("Subscription"), repo.list("WebhookEvent")]);
      setSubs(Array.isArray(s) ? s : []);
      setHooks(Array.isArray(h) ? h : []);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [repo]);

  useEffect(() => { load(); }, [load]);

  const failedHooks = useMemo(
    () => hooks.filter((h) => String(h.status || "").toLowerCase() === "failed" || h.error),
    [hooks]
  );
  const staleSubs = useMemo(
    () => subs.filter((s) => {
      const n = normalizeSubscription(s);
      return n.renewsAt && new Date(n.renewsAt).getTime() < Date.now() && isActiveStatus(n.status) && !n.cancelAtPeriodEnd;
    }),
    [subs]
  );

  const runReconcile = async () => {
    if (!mayManage) return;
    setReconciling(true);
    // Reconcile what the browser can actually see: the persisted subscription
    // row (written by Lemon Squeezy webhooks) against window sanity. Live
    // provider state and auth entitlements are server-side — reported as such,
    // never guessed.
    const results = subs.map((s) => {
      const n = normalizeSubscription(s);
      const provider = { tier: n.tier, status: n.status };
      const r = reconcile({ provider, subscription: s, entitlement: "" });
      return { id: s.id, user_id: s.user_id, tier: n.tier, status: n.status, ...r, entitlementKnown: false };
    });
    setReport({
      at: new Date().toISOString(),
      total: results.length,
      ok: results.filter((r) => r.ok).length,
      mismatches: results.filter((r) => !r.ok),
      scope: "subscription-row-vs-row",
      note: "Live Lemon Squeezy state and auth entitlements live server-side; this pass checks the persisted rows only.",
    });
    await withAudit({ repo }, {
      action: "billing.reconcile.run",
      targetType: "Subscriptions",
      targetId: String(results.length),
      actor: principal?.id || null,
      meta: { env: env.name, mismatches: results.filter((r) => !r.ok).length },
    }, async () => ({ ok: true }));
    setReconciling(false);
    toast({ title: "Reconciliation complete", description: `${results.filter((r) => !r.ok).length} mismatch(es) in ${results.length} row(s)` });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-teal-400/80">operations</div>
          <h1 className="font-display text-2xl font-semibold text-slate-50 mt-1 flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-teal-400" /> Billing
          </h1>
          <p className="text-sm text-slate-400 mt-1">Lemon Squeezy is the source of truth for payment state. Nothing here fabricates a payment.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} disabled={loading} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-sm text-slate-300 hover:text-slate-100 disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={runReconcile}
            disabled={!mayManage || loading || reconciling || subs.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-teal-500/15 text-teal-300 text-sm ring-1 ring-teal-400/30 hover:bg-teal-500/20 disabled:opacity-40"
          >
            <PlugZap className="w-4 h-4" /> {reconciling ? "Reconciling…" : "Run reconciliation"}
          </button>
        </div>
      </div>

      {/* Stat strip */}
      <div className="grid sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-slate-500">subscriptions</div>
          <div className="text-2xl font-display font-semibold text-slate-100 mt-1">{loading ? "…" : subs.length}</div>
          <div className="text-xs text-slate-500 mt-1">{loading ? "loading" : `${subs.filter((s) => isActiveStatus(s.status)).length} active`}</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-slate-500">failed webhooks</div>
          <div className={`text-2xl font-display font-semibold mt-1 ${failedHooks.length > 0 ? "text-rose-400" : "text-slate-100"}`}>{loading ? "…" : failedHooks.length}</div>
          <div className="text-xs text-slate-500 mt-1">{hooks.length} events recorded</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-slate-500">past renews (stale)</div>
          <div className={`text-2xl font-display font-semibold mt-1 ${staleSubs.length > 0 ? "text-amber-400" : "text-slate-100"}`}>{loading ? "…" : staleSubs.length}</div>
          <div className="text-xs text-slate-500 mt-1">active but renews_at in the past</div>
        </div>
      </div>

      {report && (
        <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex items-center gap-2 mb-2">
            {report.mismatches.length === 0 ? <CircleCheck className="w-4 h-4 text-teal-400" /> : <TriangleAlert className="w-4 h-4 text-amber-400" />}
            <span className="text-[10px] font-mono uppercase tracking-[0.25em] text-slate-400">reconciliation report · {new Date(report.at).toLocaleTimeString()}</span>
          </div>
          <p className="text-sm text-slate-300">{report.ok}/{report.total} rows consistent. {report.mismatches.length} mismatch(es).</p>
          <ul className="mt-2 space-y-1">
            {report.mismatches.map((m) => (
              <li key={m.id} className="text-xs text-slate-400 font-mono">
                {m.user_id?.slice(0, 8)}… — {m.mismatches.map((x) => `${x.area}: ${x.message}`).join(" · ")}
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-slate-600 mt-2 flex items-start gap-1.5"><Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />{report.note}</p>
        </section>
      )}

      {/* Subscriptions */}
      <section className="rounded-xl border border-white/10 bg-white/[0.03]">
        <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
          <span className="text-[10px] font-mono uppercase tracking-[0.25em] text-slate-400">subscriptions</span>
          <span className="text-[11px] text-slate-600 font-mono ml-auto">entitlement (auth plan) is server-side — not readable per-user from the browser</span>
        </div>
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Loading…</div>
        ) : failed ? (
          <div className="p-8 text-center text-sm text-rose-300">Couldn't read subscriptions — apply the admin read policies.</div>
        ) : subs.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">No subscription records visible.</div>
        ) : (
          <div className="divide-y divide-white/5">
            {subs.map((s) => {
              const n = normalizeSubscription(s);
              const stale = staleSubs.some((x) => x.id === s.id);
              return (
                <div key={s.id} className="px-4 py-3 flex flex-wrap items-center gap-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-xs text-slate-400 truncate">{s.user_id?.slice(0, 13)}…</div>
                    <div className="text-[11px] text-slate-600 font-mono">ls:{s.lemon_squeezy_subscription_id || "—"}</div>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase ${n.tier === "ultimate" ? "text-violet-300 bg-violet-500/10" : n.tier === "pro" ? "text-teal-300 bg-teal-500/10" : "text-slate-400 bg-white/5"}`}>{n.tier}</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase ${statusBadge(n.status)}`}>{n.status}</span>
                  {n.cancelAtPeriodEnd && <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-amber-500/10 text-amber-400">cancels at period end</span>}
                  {stale && <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-rose-500/10 text-rose-400">renewal past due</span>}
                  <span className="text-[11px] text-slate-600 font-mono hidden sm:block">renews {n.renewsAt ? String(n.renewsAt).slice(0, 10) : "—"}</span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Webhook monitor */}
      <section className="rounded-xl border border-white/10 bg-white/[0.03]">
        <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
          <span className="text-[10px] font-mono uppercase tracking-[0.25em] text-slate-400">webhook monitor</span>
          <span className="ml-auto text-[11px] font-mono text-slate-600">{failedHooks.length} failed</span>
        </div>
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Loading…</div>
        ) : hooks.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">No webhook events recorded yet.</div>
        ) : (
          <div className="divide-y divide-white/5 max-h-96 overflow-y-auto">
            {hooks.slice().sort((a, b) => String(b.processed_at || b.created_at || "").localeCompare(String(a.processed_at || a.created_at || ""))).map((h) => {
              const failedRow = String(h.status || "").toLowerCase() === "failed" || h.error;
              return (
                <div key={h.id} className="px-4 py-3 flex items-center gap-3 text-sm">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase ${failedRow ? "bg-rose-500/15 text-rose-300" : "bg-teal-500/15 text-teal-300"}`}>
                    {h.status || "processed"}
                  </span>
                  <span className="font-mono text-xs text-slate-300 truncate">{h.event_name || h.event_id}</span>
                  {h.error && <span className="text-xs text-rose-400/80 truncate flex-1">{h.error}</span>}
                  <span className="ml-auto text-[11px] text-slate-600 font-mono shrink-0">{timeAgo(h.processed_at || h.created_at)}</span>
                  {h.replayed_at && <span className="text-[10px] font-mono uppercase text-teal-400/80">replayed</span>}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {!mayManage && <p className="text-[11px] text-amber-500/80 font-mono">Read-only: your role doesn't grant billing.manage.</p>}
      <p className="text-[11px] text-slate-600 font-mono flex items-start gap-1.5">
        <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        Manual entitlement override and live-provider reconciliation run server-side (admin-gateway) and are audited there — the browser never writes billing or auth metadata. See ADMIN_SECURITY.md.
      </p>
      <Link to="/admin/audit" className="inline-block text-xs text-teal-400/80 hover:text-teal-300">Open audit log →</Link>
    </div>
  );
}