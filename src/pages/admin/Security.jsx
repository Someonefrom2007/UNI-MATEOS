import { useState, useEffect, useCallback } from "react";
import { ShieldCheck, RefreshCw, Users, KeyRound, FileLock2, CircleHelp } from "lucide-react";

import { getAppRepo, hasSupabaseEnv } from "@/lib/repo/select";
import { useAdmin } from "@/lib/admin/useAdmin";
import { PERMISSIONS, permissionsFor, ROLES } from "@/lib/admin/permissions";
import { probeAdminGate } from "@/lib/admin/probes";

const safeCount = async (repo, table) => {
  try {
    const rows = await repo.list(table);
    return Array.isArray(rows) ? rows.length : null;
  } catch {
    return null;
  }
};

export default function AdminSecurity() {
  const { principal, env } = useAdmin();
  const repo = getAppRepo();

  const [facts, setFacts] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const gate = await probeAdminGate();
    const [adminAccounts, profiles, subscriptions] = await Promise.all([
      safeCount(repo, "AdminAccount"),
      safeCount(repo, "User"),
      safeCount(repo, "Subscription"),
    ]);
    setFacts({
      gate,
      adminAccounts,
      profiles,
      subscriptions,
      session: {
        id: principal?.id || null,
        role: principal?.role || "none",
        source: principal?.source || "none",
        permissions: principal ? permissionsFor(principal.role) : [],
      },
    });
    setLoading(false);
  }, [repo, principal]);

  useEffect(() => { load(); }, [load]);

  const Stat = ({ icon: Icon, label, value, hint }) => (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center gap-2 text-slate-400">
        <Icon className="w-4 h-4" />
        <span className="text-[10px] font-mono uppercase tracking-[0.2em]">{label}</span>
      </div>
      <div className="text-2xl font-display font-semibold text-slate-100 mt-2">{value}</div>
      {hint && <div className="text-xs text-slate-500 mt-1">{hint}</div>}
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-teal-400/80">system</div>
          <h1 className="font-display text-2xl font-semibold text-slate-50 mt-1 flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-teal-400" /> Security posture
          </h1>
          <p className="text-sm text-slate-400 mt-1">What is actually enforced right now — not a checklist of intentions.</p>
        </div>
        <button onClick={load} disabled={loading} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-sm text-slate-300 hover:text-slate-100 disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {loading || !facts ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-8 text-center text-sm text-slate-500">Inspecting…</div>
      ) : (
        <>
          <div className="grid sm:grid-cols-3 gap-3">
            <Stat icon={KeyRound} label="admin_accounts" value={facts.adminAccounts ?? "—"} hint={facts.adminAccounts == null ? "not readable / not applied" : "server-side admin registry"} />
            <Stat icon={Users} label="profiles visible" value={facts.profiles ?? "—"} hint="user_profiles rows in scope" />
            <Stat icon={FileLock2} label="subscriptions visible" value={facts.subscriptions ?? "—"} hint="billing rows in scope" />
          </div>

          <section className="rounded-xl border border-white/10 bg-white/[0.03] p-5 space-y-4">
            <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-slate-400">authorization checks</div>
            <ul className="space-y-2.5 text-sm">
              <li className="flex items-start gap-2.5">
                <span className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${facts.gate.ok ? "bg-teal-400" : "bg-rose-400"}`} />
                <div>
                  <span className="text-slate-200">Server-side admin gate (is_admin RPC + admin_accounts)</span>
                  <div className="text-xs text-slate-500">{facts.gate.detail}</div>
                </div>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="mt-0.5 w-2 h-2 rounded-full shrink-0 bg-teal-400" />
                <div>
                  <span className="text-slate-200">Role self-escalation blocked</span>
                  <div className="text-xs text-slate-500">guard_admin_role trigger rejects any client update to user_profiles.role.</div>
                </div>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="mt-0.5 w-2 h-2 rounded-full shrink-0 bg-teal-400" />
                <div>
                  <span className="text-slate-200">No service-role / billing secrets in the client bundle</span>
                  <div className="text-xs text-slate-500">Only VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY reach the browser; Lemon Squeezy + OpenAI keys live in edge functions.</div>
                </div>
              </li>
              <li className="flex items-start gap-2.5">
                <span className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${env.enforced ? "bg-teal-400" : "bg-amber-400"}`} />
                <div>
                  <span className="text-slate-200">Console enforcement: {env.enforced ? "server (RLS + admin_accounts)" : "DEV-ONLY (local workspace)"}</span>
                  <div className="text-xs text-slate-500">
                    {env.enforced
                      ? "Every admin read/write goes through RLS policies keyed on is_admin()."
                      : "Local mode has no auth — the banner says so. Never ship this configuration."}
                  </div>
                </div>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="mt-0.5 w-2 h-2 rounded-full shrink-0 bg-slate-500" />
                <div>
                  <span className="text-slate-200">Impersonation: not implemented</span>
                  <div className="text-xs text-slate-500">Deferred until a safe server-side flow exists (admin-gateway). No client-side "become user" shortcut is exposed.</div>
                </div>
              </li>
            </ul>
          </section>

          <section className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
            <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-slate-400 mb-3">your session</div>
            <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <div className="flex justify-between border-b border-white/5 pb-1.5">
                <dt className="text-slate-500 font-mono text-xs">principal</dt>
                <dd className="text-slate-300 font-mono text-xs truncate">{facts.session.id || "—"}</dd>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-1.5">
                <dt className="text-slate-500 font-mono text-xs">role</dt>
                <dd className="text-slate-300 font-mono text-xs">{facts.session.role} ({facts.session.source})</dd>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-1.5 sm:col-span-2">
                <dt className="text-slate-500 font-mono text-xs">permissions</dt>
                <dd className="text-slate-300 font-mono text-xs text-right">
                  {facts.session.permissions.length === 0 ? "—" : facts.session.permissions.join(", ")}
                </dd>
              </div>
            </dl>
            <p className="text-[11px] text-slate-600 font-mono mt-3 flex items-center gap-1.5">
              <CircleHelp className="w-3.5 h-3.5" /> Role {ROLES.SUPER_ADMIN} implies every permission in {Object.keys(PERMISSIONS).length} catalog entries.
            </p>
          </section>

          {!hasSupabaseEnv() && (
            <p className="text-[11px] text-amber-500/80 font-mono">
              No Supabase env in this workspace — hosted enforcement cannot be verified from here.
            </p>
          )}
        </>
      )}
    </div>
  );
}