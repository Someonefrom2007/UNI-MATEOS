import { useState, useEffect, useMemo, useCallback } from "react";
import { Flag as FlagIcon, Plus, RefreshCw, Eye, EyeOff } from "lucide-react";

import { getAppRepo } from "@/lib/repo/select";
import { useAdmin } from "@/lib/admin/useAdmin";
import { can, PERMISSIONS } from "@/lib/admin/permissions";
import { DEFAULT_FLAGS, PLAN_FLOORS, normalizeFlag, evaluateFlag, flagRow } from "@/lib/admin/featureFlags";
import { withAudit } from "@/lib/admin/auditLog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";

const ENVS = ["development", "preview", "production"];

const rolloutColor = (pct) => (pct >= 100 ? "text-teal-400" : pct > 0 ? "text-amber-400" : "text-slate-500");

export default function AdminFlags() {
  const { principal, env } = useAdmin();
  const { toast } = useToast();
  const repo = getAppRepo();
  const mayManage = can(principal, PERMISSIONS.FEATURE_FLAGS_MANAGE);

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(null);
  const [creating, setCreating] = useState(null);
  const [form, setForm] = useState({ key: "", description: "", planFloor: "free", rolloutPct: 100, envs: [] });

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const list = await repo.list("FeatureFlag");
      setRows(Array.isArray(list) ? list : []);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [repo]);

  useEffect(() => { load(); }, [load]);

  const flags = useMemo(
    () => rows.map(normalizeFlag).sort((a, b) => a.key.localeCompare(b.key)),
    [rows]
  );

  const persist = async (flag, action) => {
    setBusy(flag.key);
    const row = flagRow(flag);
    try {
      const existing = rows.find((r) => r.key === flag.key);
      if (existing) await repo.update("FeatureFlag", existing.id, row);
      else await repo.create("FeatureFlag", row);
      await withAudit({ repo }, {
        action: `flag.${action}`,
        targetType: "FeatureFlag",
        targetId: flag.key,
        actor: principal?.id || null,
        meta: { env: env.name, enabled: row.enabled, plan_floor: row.plan_floor, rollout_pct: row.rollout_pct, envs: row.envs },
      }, async () => ({ ok: true }));
      toast({ title: `Flag ${action}d`, description: flag.key });
      await load();
    } catch (e) {
      toast({ title: "Couldn't save", description: e?.message || "RLS rejected the write" });
    }
    setBusy(null);
  };

  const toggle = (flag) => persist({ ...flag, enabled: !flag.enabled }, flag.enabled ? "disable" : "enable");

  const submitCreate = async () => {
    const key = form.key.trim();
    if (!/^[a-z][a-z0-9_]*$/.test(key)) {
      toast({ title: "Invalid key", description: "lowercase letters, digits and underscores only" });
      return;
    }
    if (rows.some((r) => r.key === key)) {
      toast({ title: "Already exists", description: key });
      return;
    }
    setCreating(null);
    await persist({ key, description: form.description, planFloor: form.planFloor, rolloutPct: Number(form.rolloutPct), envs: form.envs, enabled: false }, "create");
    setForm({ key: "", description: "", planFloor: "free", rolloutPct: 100, envs: [] });
  };

  // Merge defaults not yet persisted so the operator sees the shipped set too.
  const known = new Set(flags.map((f) => f.key));
  const display = [
    ...Object.entries(DEFAULT_FLAGS).map(([key, def]) => ({ key, ...def, shipped: true, persisted: known.has(key) })),
    ...flags.filter((f) => !DEFAULT_FLAGS[f.key]).map((f) => ({ ...f, shipped: false, persisted: true })),
  ].sort((a, b) => a.key.localeCompare(b.key));

  const evalCtx = { env: env.name === "local" ? "development" : env.name, isAdmin: principal?.isAdmin, userId: principal?.id };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-teal-400/80">configure</div>
          <h1 className="font-display text-2xl font-semibold text-slate-50 mt-1 flex items-center gap-2">
            <FlagIcon className="w-6 h-6 text-teal-400" /> Feature flags
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Flags toggle features — they never grant access. Plans, roles and RLS remain the authorization layer.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} disabled={loading} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-sm text-slate-300 hover:text-slate-100 disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          {mayManage && (
            <button onClick={() => setCreating({})} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-teal-500/15 text-teal-300 text-sm ring-1 ring-teal-400/30 hover:bg-teal-500/20">
              <Plus className="w-4 h-4" /> New flag
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-8 text-center text-sm text-slate-500">Loading flags…</div>
      ) : failed ? (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-8 text-center text-sm text-rose-300">Couldn't read feature_flags — apply the schema's admin policies first.</div>
      ) : display.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-8 text-center text-sm text-slate-500">No flags defined yet.</div>
      ) : (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] divide-y divide-white/5">
          {display.map((flag) => {
            const evaluation = evaluateFlag(flag, evalCtx);
            return (
              <div key={flag.key} className="px-4 py-3 flex flex-wrap items-center gap-3">
                <button
                  onClick={() => mayManage && flag.persisted && toggle(flag)}
                  disabled={!mayManage || !flag.persisted || busy === flag.key}
                  aria-label={`${flag.enabled ? "Disable" : "Enable"} ${flag.key}`}
                  className={`w-10 h-6 rounded-full relative transition-colors shrink-0 disabled:opacity-40 ${flag.enabled ? "bg-teal-500/70" : "bg-white/10"}`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${flag.enabled ? "left-[18px]" : "left-0.5"}`} />
                </button>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm text-slate-200">{flag.key}</span>
                    {flag.shipped && <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-white/5 text-slate-500">shipped</span>}
                    {!flag.persisted && <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400">default — toggle to persist</span>}
                  </div>
                  <div className="text-xs text-slate-500 truncate">{flag.description}</div>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-white/5 text-slate-400">{flag.planFloor}</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono ${rolloutColor(flag.rolloutPct)}`}>{flag.rolloutPct}%</span>
                  {flag.envs.length > 0 && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-sky-500/10 text-sky-300">{flag.envs.join("/")}</span>
                  )}
                </div>

                <div className={`flex items-center gap-1.5 text-[10px] font-mono uppercase ${evaluation.enabled ? "text-teal-400" : "text-slate-500"}`} title={`reason: ${evaluation.reason}`}>
                  {evaluation.enabled ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  {evaluation.enabled ? "on here" : evaluation.reason}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={Boolean(creating)} onOpenChange={(v) => !v && setCreating(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New feature flag</DialogTitle>
            <DialogDescription>Created disabled. Enable it when you're ready — the write is audited.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <label className="block text-sm">
              <span className="text-slate-400">Key</span>
              <Input value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} placeholder="new_dashboard_v2" className="mt-1 font-mono" autoFocus />
            </label>
            <label className="block text-sm">
              <span className="text-slate-400">Description</span>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What it toggles" className="mt-1" />
            </label>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <label className="block">
                <span className="text-slate-400">Plan floor</span>
                <select
                  value={form.planFloor}
                  onChange={(e) => setForm({ ...form, planFloor: e.target.value })}
                  className="mt-1 w-full h-9 rounded-md border border-white/10 bg-[#0c1426] px-2 text-sm"
                >
                  {PLAN_FLOORS.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-slate-400">Rollout %</span>
                <Input type="number" min={0} max={100} value={form.rolloutPct} onChange={(e) => setForm({ ...form, rolloutPct: Number(e.target.value) })} className="mt-1 font-mono" />
              </label>
            </div>
            <div className="text-sm">
              <span className="text-slate-400">Environments</span>
              <div className="flex gap-2 mt-1">
                {ENVS.map((e) => (
                  <button
                    key={e}
                    onClick={() => setForm({ ...form, envs: form.envs.includes(e) ? form.envs.filter((x) => x !== e) : [...form.envs, e] })}
                    className={`px-2.5 py-1 rounded-md text-xs font-mono ${form.envs.includes(e) ? "bg-teal-500/15 text-teal-300 ring-1 ring-teal-400/30" : "bg-white/5 text-slate-400"}`}
                  >{e}</button>
                ))}
              </div>
              <p className="text-[11px] text-slate-600 mt-1">No environments selected = all environments.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreating(null)}>Cancel</Button>
            <Button onClick={submitCreate}>Create flag</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <p className="text-[11px] text-slate-600 font-mono">
        {rows.length} persisted flag(s) · writes RLS-scoped to admins + audited · evaluation shown for: {env.label}
      </p>
    </div>
  );
}